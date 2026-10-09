import os
import uuid
import zipfile
from pathlib import Path

from fastapi import UploadFile


BASE_STORAGE_DIR = Path(
    os.getenv("DOCUMENT_STORAGE_PATH", "/app/storage")
)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".xlsx",
    ".zip",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_EXTRACTED_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def validate_extension(filename: str) -> str:
    extension = get_extension(filename)

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: {extension or 'unknown'}. "
            f"Allowed types: PDF, DOCX, XLSX, ZIP."
        )

    return extension


async def save_uploaded_file(
    upload_file: UploadFile,
    tenant_id: uuid.UUID,
    tender_case_id: uuid.UUID,
) -> tuple[Path, int]:
    extension = validate_extension(upload_file.filename or "")

    directory = (
        BASE_STORAGE_DIR
        / str(tenant_id)
        / str(tender_case_id)
    )

    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    stored_filename = f"{uuid.uuid4()}{extension}"
    destination = directory / stored_filename

    total_size = 0

    try:
        with destination.open("wb") as output_file:
            while True:
                chunk = await upload_file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise ValueError(
                        "File size exceeds the 50 MB limit."
                    )

                output_file.write(chunk)

    except Exception:
        if destination.exists():
            destination.unlink()

        raise

    finally:
        await upload_file.close()

    return destination, total_size


def is_safe_zip_path(base_directory: Path, filename: str) -> bool:
    target = (base_directory / filename).resolve()
    base = base_directory.resolve()

    return target == base or base in target.parents


def extract_zip(
    zip_path: Path,
    tenant_id: uuid.UUID,
    tender_case_id: uuid.UUID,
) -> list[tuple[str, Path]]:
    extraction_directory = (
        BASE_STORAGE_DIR
        / str(tenant_id)
        / str(tender_case_id)
        / "extracted"
        / str(uuid.uuid4())
    )

    extraction_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    extracted_files: list[tuple[str, Path]] = []

    with zipfile.ZipFile(zip_path, "r") as archive:
        for member in archive.infolist():

            if member.is_dir():
                continue

            filename = member.filename

            if not is_safe_zip_path(
                extraction_directory,
                filename,
            ):
                raise ValueError(
                    f"Unsafe ZIP path detected: {filename}"
                )

            extension = get_extension(filename)

            if extension not in ALLOWED_EXTENSIONS - {".zip"}:
                continue

            if member.file_size > MAX_EXTRACTED_FILE_SIZE:
                raise ValueError(
                    f"ZIP entry exceeds the 50 MB limit: {filename}"
                )

            safe_name = Path(filename).name

            if not safe_name:
                continue

            destination = extraction_directory / (
                f"{uuid.uuid4()}_{safe_name}"
            )

            with archive.open(member, "r") as source:
                with destination.open("wb") as target:
                    target.write(source.read())

            extracted_files.append(
                (
                    safe_name,
                    destination,
                )
            )

    return extracted_files
def get_relative_storage_path(path: Path) -> str:
    return str(path.relative_to(BASE_STORAGE_DIR))
