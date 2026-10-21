"""Groq LLM provider implementing LLMProviderInterface."""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

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
    "deadline",
    "lots",
    "evaluation",
    "evidence",
    "requirements",
    "mandatory",
    "general",
}


class GroqLLMProvider(LLMProviderInterface):
    def __init__(self) -> None:
        if not settings.GROQ_API_KEY:
            raise AIProviderError(
                "GROQ_API_KEY is required when AI_PROVIDER=groq. "
                "Set it in the environment or .env file."
            )
        self._client = httpx.Client(
            base_url=settings.GROQ_BASE_URL.rstrip("/"),
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=90.0,
        )
        self._model = settings.GROQ_MODEL

    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        if not request.chunks:
            return ExtractionResult(requirements=[])

        chunk_map = {c.chunk_id: c for c in request.chunks}
        # Limit payload size – send a reasonable number of chunks
        chunks_for_prompt = request.chunks[:40]
        system = (
            "You are a tender/RFP analyst. Extract structured requirements from the "
            "given document chunks. Return ONLY valid JSON of the form:\n"
            '{"requirements": [{"requirement": "...", "category": "deadlines|lots|'
            'evaluation|evidence|requirements|general", "mandatory": true/false, '
            '"confidence": 0.0-1.0, "source_chunk_id": "<exact chunk_id from input>", '
            '"deadline_value": null or string, "lot_bundle": null or string, '
            '"evaluation_criteria": null or string, "required_evidence": []}]}\n'
            "Rules:\n"
            "- Use only source_chunk_id values that appear in the input.\n"
            "- category must be one of the allowed values above.\n"
            "- confidence between 0 and 1.\n"
            "- Do not invent citations; source metadata will be filled from the chunk."
        )
        user_parts = []
        for c in chunks_for_prompt:
            user_parts.append(
                f"[chunk_id={c.chunk_id} doc={c.document_name} "
                f"page={c.page_number} para={c.paragraph_number}]\n{c.text}"
            )
        user_content = "Extract requirements from these chunks:\n\n" + "\n\n---\n\n".join(user_parts)

        content = self._chat_json(system, user_content)
        raw_reqs = content.get("requirements") or []
        if not isinstance(raw_reqs, list):
            raise AIProviderError("Groq response missing requirements list")

        results: list[ExtractedRequirement] = []
        for item in raw_reqs:
            if not isinstance(item, dict):
                continue
            chunk_id = str(item.get("source_chunk_id") or "").strip()
            if chunk_id not in chunk_map:
                continue  # drop unknown chunk ids (test expectation)
            chunk = chunk_map[chunk_id]

            category = str(item.get("category") or "requirements").lower().strip()
            if category not in ALLOWED_CATEGORIES:
                category = "requirements"
            if category == "deadline":
                category = "deadlines"

            try:
                confidence = float(item.get("confidence", 0.7))
            except (TypeError, ValueError):
                confidence = 0.7
            confidence = max(0.0, min(1.0, confidence))

            evidence = item.get("required_evidence") or []
            if not isinstance(evidence, list):
                evidence = [str(evidence)] if evidence else []

            results.append(
                ExtractedRequirement(
                    requirement=str(item.get("requirement") or "").strip() or chunk.text[:300],
                    category=category,
                    mandatory=bool(item.get("mandatory", False)),
                    deadline_value=item.get("deadline_value"),
                    lot_bundle=item.get("lot_bundle"),
                    evaluation_criteria=item.get("evaluation_criteria"),
                    required_evidence=[str(e) for e in evidence],
                    confidence=confidence,
                    source_chunk_id=chunk.chunk_id,
                    source_document=chunk.document_name,
                    source_page=chunk.page_number,
                    source_paragraph=chunk.paragraph_number,
                )
            )

        return ExtractionResult(requirements=results)

    def _chat_json(self, system: str, user: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                resp = self._client.post(
                    "/chat/completions",
                    json={
                        "model": self._model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                    },
                )
            except httpx.HTTPError as exc:
                raise AIProviderError(f"Groq request failed: {exc}") from exc

            if resp.status_code == 401:
                raise AIProviderError(
                    "GROQ_API_KEY is invalid or unauthorized (401 from Groq)"
                )
            if resp.status_code >= 400:
                try:
                    body = resp.json()
                    msg = (
                        body.get("error", {}).get("message")
                        or body.get("message")
                        or resp.text
                    )
                except Exception:
                    msg = resp.text
                raise AIProviderError(f"Groq error {resp.status_code}: {msg}")

            try:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return self._parse_json_content(content)
            except (KeyError, IndexError, TypeError, json.JSONDecodeError, AIProviderError) as exc:
                last_error = exc
                continue

        raise AIProviderError(f"Groq returned invalid JSON after retries: {last_error}")

    @staticmethod
    def _parse_json_content(content: str) -> dict[str, Any]:
        content = (content or "").strip()
        if not content:
            raise AIProviderError("empty content")
        # strip markdown fences if present
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
        if fence:
            content = fence.group(1).strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise AIProviderError(f"invalid JSON: {exc}") from exc