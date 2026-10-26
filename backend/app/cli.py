"""Operational commands.

    python -m app.cli reindex [--all]   Re-embed stored chunk text (after an
                                        embedding-provider or dimension change).
"""
from __future__ import annotations

import argparse
import sys

from app.ai.schemas import EmbeddingRequest
from app.ai.service import AIService
from app.db.session import SessionLocal
from app.models import DocumentChunk, HistoricalDocumentChunk

BATCH = 256


def reindex(all_chunks: bool = False) -> int:
    ai = AIService()
    with SessionLocal() as db:
        for model in (DocumentChunk, HistoricalDocumentChunk):
            if all_chunks:
                db.query(model).update({model.embedding: None}, synchronize_session=False)
                db.commit()
            done = 0
            while True:
                batch = (
                    db.query(model)
                    .filter(model.embedding.is_(None))
                    .order_by(model.id)
                    .limit(BATCH)
                    .all()
                )
                if not batch:
                    break
                vectors = ai.generate_embeddings(
                    EmbeddingRequest(texts=[c.text for c in batch])
                ).embeddings
                for chunk, vector in zip(batch, vectors):
                    chunk.embedding = vector
                db.commit()
                done += len(batch)
                print(f"{model.__tablename__}: {done} chunk(s) embedded", flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    re_cmd = sub.add_parser("reindex", help="re-embed chunks with missing (or all) vectors")
    re_cmd.add_argument("--all", action="store_true", help="re-embed every chunk, not only missing ones")
    args = parser.parse_args(argv)
    if args.command == "reindex":
        return reindex(all_chunks=args.all)
    return 1


if __name__ == "__main__":
    sys.exit(main())
