"""Build small PDF / DOCX / XLSX / ZIP files for tests."""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import docx
import openpyxl
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

TMP: Path = Path(".")


def pdf_bytes(pages: list[list[str]]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    for lines in pages:
        y = 780
        for line in lines:
            if line == "":
                y -= 14
                continue
            pdf.drawString(60, y, line)
            y -= 16
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def docx_bytes(paragraphs: list[str], table: list[list[str]] | None = None) -> bytes:
    document = docx.Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    if table:
        grid = document.add_table(rows=len(table), cols=len(table[0]))
        for r, row in enumerate(table):
            for c, value in enumerate(row):
                grid.cell(r, c).text = value
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def xlsx_bytes(sheets: dict[str, list[list]]) -> bytes:
    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    for title, rows in sheets.items():
        sheet = workbook.create_sheet(title)
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def zip_bytes(members: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ZIP_MIME = "application/zip"


def upload(name: str, content: bytes, mime: str = "application/octet-stream"):
    return ("files", (name, content, mime))


SIMPLE_RFP_PAGES = [
    [
        "Request for Proposal - Managed IT Services",
        "",
        "The submission deadline is 14 November 2026 at 12:00 CET.",
        "",
        "Bidders must hold a valid ISO 27001 certificate and attach a copy.",
    ],
    [
        "Lot 1 covers network hardware supply and installation.",
        "",
        "Evaluation criteria: price 40% and quality 60%.",
        "",
        "The supplier shall complete the pricing schedule in Appendix B.",
    ],
]


def simple_rfp_pdf() -> bytes:
    return pdf_bytes(SIMPLE_RFP_PAGES)
