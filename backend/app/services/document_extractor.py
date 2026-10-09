from pathlib import Path

from docx import Document as DocxDocument
from openpyxl import load_workbook
from pypdf import PdfReader


def extract_pdf(file_path: Path) -> list[dict]:
    reader = PdfReader(str(file_path))
    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        if text.strip():
            pages.append({
                "text": text.strip(),
                "page_number": page_number,
                "paragraph_number": None,
            })

    return pages


def extract_docx(file_path: Path) -> list[dict]:
    document = DocxDocument(str(file_path))
    paragraphs = []

    for paragraph_number, paragraph in enumerate(
        document.paragraphs,
        start=1,
    ):
        text = paragraph.text.strip()

        if text:
            paragraphs.append({
                "text": text,
                "page_number": None,
                "paragraph_number": paragraph_number,
            })

    return paragraphs


def extract_xlsx(file_path: Path) -> list[dict]:
    workbook = load_workbook(
        filename=file_path,
        read_only=True,
        data_only=True,
    )

    rows = []

    for worksheet in workbook.worksheets:
        for row_number, row in enumerate(
            worksheet.iter_rows(values_only=True),
            start=1,
        ):
            values = [
                str(value).strip()
                for value in row
                if value is not None and str(value).strip()
            ]

            if not values:
                continue

            text = " | ".join(values)

            rows.append({
                "text": f"{worksheet.title}: {text}",
                "page_number": None,
                "paragraph_number": row_number,
            })

    workbook.close()

    return rows


def extract_document(
    file_path: Path,
    file_type: str,
) -> list[dict]:

    if file_type == "pdf":
        return extract_pdf(file_path)

    if file_type == "docx":
        return extract_docx(file_path)

    if file_type == "xlsx":
        return extract_xlsx(file_path)

    raise ValueError(
        f"Unsupported document type for extraction: {file_type}"
    )
