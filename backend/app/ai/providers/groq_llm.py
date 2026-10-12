"""
Groq implementation of LLMProviderInterface.

Groq exposes an OpenAI-compatible REST API, so we call it with plain
`httpx`. No vendor SDK is installed (spec: no vendor SDKs in the code).
The API key is read only from settings (.env).
"""
import json

import httpx
from pydantic import ValidationError

from app.ai.errors import AIProviderError
from app.ai.interfaces import LLMProviderInterface
from app.ai.schemas import (
    DocumentChunk,
    ExtractedRequirement,
    ExtractionRequest,
    ExtractionResult,
)
from app.core.config import settings

ALLOWED_CATEGORIES = {
    "deadlines",
    "lots",
    "requirements",
    "evidence",
    "references",
}

SYSTEM_PROMPT = """You extract structured information from tender (RFP/bid) documents.

You receive text chunks. Each chunk has a chunk_id. Return ONLY a JSON object:
{"requirements": [
  {"requirement": "<short text in your own words>",
   "category": "deadlines|lots|requirements|evidence|references",
   "mandatory": true|false,
   "confidence": <number 0..1>,
   "source_chunk_id": "<chunk_id the item came from>"}
]}

Categories:
- deadlines: submission dates, clarification dates, contract dates
- lots: lots / bundles / packages and what they cover
- requirements: mandatory requirements and evaluation criteria
- evidence: documents or proof the bidder must provide
- references: references to other documents, annexes, forms

Rules:
- Use ONLY the given text. Never invent facts.
- source_chunk_id MUST be copied exactly from the input.
- mandatory=true only if the text says must / shall / required / mandatory.
- confidence: how sure you are the item is correct (0 to 1).
- If a chunk has nothing relevant, skip it.
- Output JSON only. No markdown, no explanation."""


class GroqLLMProvider(LLMProviderInterface):
    def __init__(self) -> None:
        if not settings.GROQ_API_KEY:
            raise AIProviderError(
                "GROQ_API_KEY is not set. Add it to your .env file."
            )

        self._client = httpx.Client(
            base_url=settings.GROQ_BASE_URL,
            timeout=settings.LLM_TIMEOUT_SECONDS,
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        )

    # ------------------------------------------------------------------
    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        chunks = [c for c in request.chunks if c.text.strip()]
        size = max(1, settings.LLM_MAX_CHUNKS_PER_CALL)

        requirements: list[ExtractedRequirement] = []
        for start in range(0, len(chunks), size):
            batch = chunks[start : start + size]
            requirements.extend(self._extract_batch(batch))

        return ExtractionResult(requirements=requirements)

    # ------------------------------------------------------------------
    def _extract_batch(
        self, batch: list[DocumentChunk]
    ) -> list[ExtractedRequirement]:
        by_id = {c.chunk_id: c for c in batch}

        user_content = "\n\n".join(
            f"[chunk_id={c.chunk_id}]\n{c.text}" for c in batch
        )

        raw = self._chat_json(user_content)

        items = raw.get("requirements")
        if not isinstance(items, list):
            raise AIProviderError(
                "The AI returned an unexpected format (no 'requirements' list)."
            )

        results: list[ExtractedRequirement] = []
        for item in items:
            if not isinstance(item, dict):
                continue

            chunk = by_id.get(item.get("source_chunk_id"))
            if chunk is None:
                # Model gave a chunk_id we did not send -> cannot cite it.
                # Spec: every result needs a visible source, so drop it.
                continue

            category = str(item.get("category", "")).lower()
            if category not in ALLOWED_CATEGORIES:
                category = "requirements"

            try:
                results.append(
                    ExtractedRequirement(
                        requirement=str(item.get("requirement", "")).strip(),
                        category=category,
                        mandatory=bool(item.get("mandatory", False)),
                        confidence=_clamp(item.get("confidence", 0.0)),
                        # Source info comes from OUR chunk, never from the LLM
                        source_chunk_id=chunk.chunk_id,
                        source_document=chunk.document_name,
                        source_page=chunk.page_number,
                        source_paragraph=chunk.paragraph_number,
                    )
                )
            except ValidationError:
                continue

        return [r for r in results if r.requirement]

    # ------------------------------------------------------------------
    def _chat_json(self, user_content: str) -> dict:
        payload = {
            "model": settings.GROQ_MODEL,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        }

        last_error = "unknown error"
        for _attempt in range(2):  # 1 try + 1 retry
            try:
                response = self._client.post("/chat/completions", json=payload)
            except httpx.TimeoutException:
                last_error = "The AI service timed out."
                continue
            except httpx.HTTPError as exc:
                last_error = f"Could not reach the AI service ({exc.__class__.__name__})."
                continue

            if response.status_code == 401:
                raise AIProviderError(
                    "The AI service rejected the API key. Check GROQ_API_KEY."
                )
            if response.status_code == 429:
                last_error = "The AI service rate limit was reached. Try again later."
                continue
            if response.status_code >= 400:
                last_error = (
                    f"The AI service returned an error ({response.status_code}): "
                    f"{_error_detail(response)} [model={settings.GROQ_MODEL}]"
                )
                continue

            try:
                content = response.json()["choices"][0]["message"]["content"]
                return json.loads(content)
            except (KeyError, IndexError, ValueError):
                last_error = "The AI returned invalid JSON."
                continue

        raise AIProviderError(last_error)


def _clamp(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, number))


def _error_detail(response: httpx.Response) -> str:
    """Short, safe error text from the provider (never contains our key)."""
    try:
        return str(response.json()["error"]["message"])[:200]
    except (KeyError, TypeError, ValueError):
        return response.text[:200] or "no details"