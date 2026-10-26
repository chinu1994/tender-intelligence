"""OpenAI-compatible chat-completions LLM adapter (Groq preset).

Implements ``LLMProviderInterface`` over plain HTTP (httpx) - no vendor SDK.
``GroqLLMProvider`` reads the ``GROQ_*`` settings; the generic
``OpenAICompatibleLLMProvider`` (see ``openai_compatible.py``) reuses this
class with the ``LLM_*`` settings for any compatible endpoint.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.ai.errors import AIProviderError
from app.ai.interfaces import LLMProviderInterface
from app.ai.schemas import (
    DraftRequest,
    DraftResult,
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
    "document_reference",
    "general",
}

MAX_CHUNKS_PER_CALL = 40


class GroqLLMProvider(LLMProviderInterface):
    PROVIDER_NAME = "Groq"
    KEY_ENV = "GROQ_API_KEY"
    REQUIRES_KEY = True

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        api_key = settings.GROQ_API_KEY if api_key is None else api_key
        base_url = base_url or settings.GROQ_BASE_URL
        model = model or settings.GROQ_MODEL

        if self.REQUIRES_KEY and not api_key:
            raise AIProviderError(
                f"{self.KEY_ENV} is required for the {self.PROVIDER_NAME} provider. "
                "Set it in the environment or .env file."
            )
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=90.0,
        )
        self._model = model

    # ------------------------------------------------------------------ extract
    def extract(self, request: ExtractionRequest) -> ExtractionResult:
        if not request.chunks:
            return ExtractionResult(requirements=[])

        results: list[ExtractedRequirement] = []
        for start in range(0, len(request.chunks), MAX_CHUNKS_PER_CALL):
            batch = request.chunks[start:start + MAX_CHUNKS_PER_CALL]
            results.extend(self._extract_batch(batch))
        return ExtractionResult(requirements=results)

    def _extract_batch(self, chunks) -> list[ExtractedRequirement]:
        chunk_map = {c.chunk_id: c for c in chunks}
        system = (
            "You are a tender/RFP analyst. Extract structured requirements from the "
            "given document chunks. Return ONLY valid JSON of the form:\n"
            '{"requirements": [{"requirement": "...", "category": "deadlines|lots|'
            'evaluation|evidence|requirements|document_reference|general", '
            '"mandatory": true/false, "confidence": 0.0-1.0, '
            '"source_chunk_id": "<exact chunk_id from input>", '
            '"deadline_value": null or string, "lot_bundle": null or string, '
            '"evaluation_criteria": null or string, "document_reference": null or string, '
            '"required_evidence": []}]}\n'
            "Rules:\n"
            "- Use only source_chunk_id values that appear in the input.\n"
            "- category must be one of the allowed values above.\n"
            "- confidence between 0 and 1.\n"
            "- Do not invent citations; source metadata will be filled from the chunk."
        )
        user_parts = [
            f"[chunk_id={c.chunk_id} doc={c.document_name} "
            f"page={c.page_number} para={c.paragraph_number}]\n{c.text}"
            for c in chunks
        ]
        user_content = "Extract requirements from these chunks:\n\n" + "\n\n---\n\n".join(user_parts)

        content = self._chat_json(system, user_content)
        raw_reqs = content.get("requirements") or []
        if not isinstance(raw_reqs, list):
            raise AIProviderError(f"{self.PROVIDER_NAME} response missing requirements list")

        results: list[ExtractedRequirement] = []
        for item in raw_reqs:
            if not isinstance(item, dict):
                continue
            chunk_id = str(item.get("source_chunk_id") or "").strip()
            if chunk_id not in chunk_map:
                continue  # never accept citations to chunks we did not send
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

            def _opt(key: str) -> str | None:
                value = item.get(key)
                return str(value)[:500] if value not in (None, "") else None

            results.append(
                ExtractedRequirement(
                    requirement=str(item.get("requirement") or "").strip() or chunk.text[:300],
                    category=category,
                    mandatory=bool(item.get("mandatory", False)),
                    deadline_value=_opt("deadline_value"),
                    lot_bundle=_opt("lot_bundle"),
                    evaluation_criteria=_opt("evaluation_criteria"),
                    document_reference=_opt("document_reference"),
                    required_evidence=[str(e) for e in evidence],
                    confidence=confidence,
                    source_chunk_id=chunk.chunk_id,
                    source_document=chunk.document_name,
                    source_page=chunk.page_number,
                    source_paragraph=chunk.paragraph_number,
                )
            )
        return results

    # ------------------------------------------------------------------- draft
    def draft_section(self, request: DraftRequest) -> DraftResult:
        system = (
            "You are a bid writer. Draft the requested proposal section in clear, "
            "professional English. Address each listed requirement explicitly. You may "
            "reuse precedent snippets and must cite them as [Source: <document>, page N]. "
            "Never invent certifications, figures or commitments; mark unknowns as "
            "[To be confirmed]. Return ONLY JSON: {\"content\": \"...\"}"
        )
        reqs = "\n".join(
            f"- {'(mandatory) ' if r.mandatory else ''}{r.requirement} [{r.source or 'n/a'}]"
            for r in request.requirements[:40]
        ) or "(none)"
        snippets = "\n".join(
            f"- {s.text} [Source: {s.document_name}"
            f"{', page ' + str(s.page_number) if s.page_number else ''}]"
            for s in request.snippets[:8]
        ) or "(none)"
        user = (
            f"Tender: {request.case_name}\nSection: {request.section_title}\n\n"
            f"Requirements:\n{reqs}\n\nPrecedent snippets:\n{snippets}\n\n"
            f"Existing draft (may be empty):\n{request.existing_content}"
        )
        content = self._chat_json(system, user)
        text = content.get("content")
        if not isinstance(text, str) or not text.strip():
            raise AIProviderError(f"{self.PROVIDER_NAME} returned an empty draft")
        return DraftResult(content=text.strip())

    # -------------------------------------------------------------- transport
    def _chat_json(self, system: str, user: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for _attempt in range(2):
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
                raise AIProviderError(f"{self.PROVIDER_NAME} request failed: {exc}") from exc

            if resp.status_code == 401:
                raise AIProviderError(
                    f"{self.KEY_ENV} is invalid or unauthorized (401 from {self.PROVIDER_NAME})"
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
                raise AIProviderError(f"{self.PROVIDER_NAME} error {resp.status_code}: {msg}")

            try:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return self._parse_json_content(content)
            except (KeyError, IndexError, TypeError, json.JSONDecodeError, AIProviderError) as exc:
                last_error = exc
                continue

        raise AIProviderError(
            f"{self.PROVIDER_NAME} returned invalid JSON after retries: {last_error}"
        )

    @staticmethod
    def _parse_json_content(content: str) -> dict[str, Any]:
        content = (content or "").strip()
        if not content:
            raise AIProviderError("empty content")
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
        if fence:
            content = fence.group(1).strip()
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise AIProviderError(f"invalid JSON: {exc}") from exc
        if not isinstance(parsed, dict):
            raise AIProviderError("invalid JSON: expected an object")
        return parsed
