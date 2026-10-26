"""Tenant-partitioned file storage on a local/private volume.

Layout (all paths relative to ``DOCUMENT_STORAGE_PATH`` are stored in the DB):

    <tenant_id>/cases/<case_id>/<uuid>.<ext>
    <tenant_id>/cases/<case_id>/extracted/<parent_document_id>/<prefix>_<name>
    <tenant_id>/knowledge-base/<uuid>.<ext>
    <tenant_id>/knowledge-base/extracted/<parent_document_id>/<prefix>_<name>
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.constants import SUPPORTED_UPLOAD_TYPES

BASE_STORAGE_DIR = Path(settings.DOCUMENT_STORAGE_PATH)

ALLOWED_EXTENSIONS = {f".{ext}" for ext in SUPPORTED_UPLOAD_TYPES}


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def validate_extension(filename: str) -> str:
    extension = get_extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: {extension or 'unknown'}. "
            "Allowed types: PDF, DOCX, XLSX, ZIP."
        )
    return extension


def clean_display_name(filename: str) -> str:
    """Bare file name for display (no client-side directory components)."""
    name = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    return name[:255] or "document"


def case_directory(tenant_id: uuid.UUID, tender_case_id: uuid.UUID) -> Path:
    return BASE_STORAGE_DIR / str(tenant_id) / "cases" / str(tender_case_id)


def knowledge_base_directory(tenant_id: uuid.UUID) -> Path:
    return BASE_STORAGE_DIR / str(tenant_id) / "knowledge-base"


def get_relative_storage_path(path: Path) -> str:
    return str(Path(path).resolve().relative_to(BASE_STORAGE_DIR.resolve()))


def resolve_storage_path(relative_path: str) -> Path:
    """Absolute path for a stored relative path; refuses traversal."""
    base = BASE_STORAGE_DIR.resolve()
    candidate = (base / relative_path).resolve()
    if candidate != base and base not in candidate.parents:
        raise ValueError("Invalid storage path")
    return candidate


async def _stream_to_disk(upload_file: UploadFile, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    limit = settings.max_upload_bytes
    total = 0
    try:
        with destination.open("wb") as output:
            while True:
                chunk = await upload_file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise ValueError(
                        f"'{clean_display_name(upload_file.filename or '')}' exceeds the "
                        f"{settings.MAX_UPLOAD_SIZE_MB} MB upload limit."
                    )
                output.write(chunk)
        if total == 0:
            raise ValueError(f"'{clean_display_name(upload_file.filename or '')}' is empty.")
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload_file.close()
    return total


async def save_uploaded_file(
    upload_file: UploadFile,
    tenant_id: uuid.UUID,
    tender_case_id: uuid.UUID,
) -> tuple[Path, int]:
    extension = validate_extension(upload_file.filename or "")
    destination = case_directory(tenant_id, tender_case_id) / f"{uuid.uuid4()}{extension}"
    size = await _stream_to_disk(upload_file, destination)
    return destination, size


async def save_historical_uploaded_file(
    upload_file: UploadFile,
    tenant_id: uuid.UUID,
) -> tuple[Path, int]:
    extension = validate_extension(upload_file.filename or "")
    destination = knowledge_base_directory(tenant_id) / f"{uuid.uuid4()}{extension}"
    size = await _stream_to_disk(upload_file, destination)
    return destination, size


def delete_stored_file(relative_path: str | None) -> None:
    """Best-effort removal of a stored file."""
    if not relative_path:
        return
    try:
        resolve_storage_path(relative_path).unlink(missing_ok=True)
    except (ValueError, OSError):
        pass


def delete_directory(path: Path) -> None:
    base = BASE_STORAGE_DIR.resolve()
    target = Path(path).resolve()
    if target == base or base not in target.parents:
        return
    shutil.rmtree(target, ignore_errors=True)
