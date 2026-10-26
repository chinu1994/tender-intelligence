"""Cross-cutting constants shared by models, migrations and AI adapters."""

# Dimension of every stored embedding vector (document_chunks and
# historical_document_chunks). Any embedding adapter must return vectors of
# exactly this size. Changing it requires a migration + `python -m app.cli reindex`.
EMBEDDING_DIMENSION = 384

# Canonical requirement categories persisted by the extraction pipeline.
REQUIREMENT_CATEGORIES = (
    "deadline",
    "lots",
    "mandatory",
    "evaluation",
    "evidence",
    "document_reference",
    "general",
)

REVIEW_STATUSES = ("pending", "verified", "rejected")

HISTORICAL_SOURCE_TYPES = (
    "past_tender",
    "past_bid",
    "successful_bid",
    "unsuccessful_bid",
    "completed",
)

HISTORICAL_OUTCOMES = ("won", "lost", "completed", "pending", "cancelled")

SUPPORTED_DOCUMENT_TYPES = ("pdf", "docx", "xlsx")
SUPPORTED_UPLOAD_TYPES = SUPPORTED_DOCUMENT_TYPES + ("zip",)
