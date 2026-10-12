"""
Local embedding provider (no API key, no data leaves the server).

Uses `fastembed` (ONNX, no PyTorch) with BAAI/bge-small-en-v1.5 -> 384 dims.
The model downloads once on first use and is then cached.
"""
from app.ai.errors import AIProviderError
from app.ai.interfaces import EmbeddingProviderInterface
from app.ai.schemas import EmbeddingRequest, EmbeddingResult
from app.core.config import settings

_model = None  # loaded once per process


def _get_model():
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding
        except ImportError as exc:
            raise AIProviderError(
                "fastembed is not installed. Run: pip install fastembed"
            ) from exc
        _model = TextEmbedding(model_name=settings.EMBEDDING_MODEL)
    return _model


class LocalEmbeddingProvider(EmbeddingProviderInterface):
    def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        if not request.texts:
            return EmbeddingResult(embeddings=[])

        vectors = [list(map(float, v)) for v in _get_model().embed(request.texts)]

        if vectors and len(vectors[0]) != settings.EMBEDDING_DIM:
            raise AIProviderError(
                f"Embedding size is {len(vectors[0])} but EMBEDDING_DIM is "
                f"{settings.EMBEDDING_DIM}. Fix EMBEDDING_DIM in .env."
            )

        return EmbeddingResult(embeddings=vectors)
