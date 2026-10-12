"""
Terminal check for the AI layer (no UI).

Run from the backend/ folder:
    python scripts/test_ai.py                 # uses whatever .env says
    LLM_PROVIDER=groq python scripts/test_ai.py

Checks: extraction (+ source refs), embeddings, similarity ranking.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.errors import AIProviderError
from app.ai.schemas import DocumentChunk, EmbeddingRequest, ExtractionRequest
from app.ai.service import AIService
from app.core.config import settings

SAMPLE = [
    ("The bid submission deadline is 14 November 2026 at 12:00 noon.", 2, 1),
    ("The tender is split into Lot 1 (hardware supply) and Lot 2 (managed support).", 3, 2),
    ("Bidders must provide a valid ISO 27001 certificate with their offer.", 5, 1),
    ("Annex C (Pricing Form) must be completed and attached.", 8, 4),
]


def main() -> int:
    print(f"LLM={settings.LLM_PROVIDER}  EMBEDDING={settings.EMBEDDING_PROVIDER}  DIM={settings.EMBEDDING_DIM}\n")
    ai = AIService()
    ok = True

    chunks = [
        DocumentChunk(chunk_id=f"c{i}", document_id="doc1", document_name="sample_tender.pdf",
                      text=t, page_number=pg, paragraph_number=pa)
        for i, (t, pg, pa) in enumerate(SAMPLE, start=1)
    ]

    print("== 1. Extraction ==")
    try:
        result = ai.extract_requirements(ExtractionRequest(chunks=chunks))
    except AIProviderError as exc:
        print(f"FAIL: {exc}")
        return 1
    for r in result.requirements:
        flag = "mandatory" if r.mandatory else "optional "
        print(f"- [{r.category}] {flag} conf={r.confidence:.2f} | {r.requirement[:70]}")
        print(f"    source: {r.source_document}, page {r.source_page}, para {r.source_paragraph}")
        if r.source_document is None or r.source_page is None:
            ok = False
    if not result.requirements:
        print("FAIL: nothing extracted"); ok = False

    print("\n== 2. Embeddings + similarity ==")
    texts = [c.text for c in chunks]
    vectors = ai.generate_embeddings(EmbeddingRequest(texts=texts)).embeddings
    query = ai.generate_embeddings(EmbeddingRequest(texts=["security certificate required"])).embeddings[0]
    if len(query) != settings.EMBEDDING_DIM:
        print(f"FAIL: vector size {len(query)} != {settings.EMBEDDING_DIM}"); ok = False
    scored = sorted(((sum(a * b for a, b in zip(query, v)), t) for v, t in zip(vectors, texts)), reverse=True)
    for score, text in scored:
        print(f"  {score:+.3f}  {text[:60]}")

    print("\nRESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
