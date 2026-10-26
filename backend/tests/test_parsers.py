import zipfile
from pathlib import Path

import docx
import openpyxl
import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.processing.parsers import DocumentParseError, parse_file, unpack_zip
from app.processing.pipeline import process_file


def make_pdf(path: Path):
    c = canvas.Canvas(str(path), pagesize=A4)
    c.drawString(72, 780, "Bid submission deadline is 14 November 2026 at noon.")
    c.showPage()
    c.drawString(72, 780, "Bidders must provide an ISO 27001 certificate.")
    c.save()


def make_docx(path: Path):
    d = docx.Document()
    d.add_paragraph("Lot 1 covers network hardware supply and installation services.")
    d.add_paragraph("Lot 2 covers managed support for five years of operation.")
    d.save(str(path))


def make_xlsx(path: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Positions"
    ws.append(["Item", "Qty"])
    ws.append(["Switch 48 port", 12])
    wb.save(path)


def test_pdf_pages(tmp_path):
    p = tmp_path / "a.pdf"; make_pdf(p)
    paras = parse_file(p)
    assert [x.page for x in paras] == [1, 2]


def test_docx_and_xlsx(tmp_path):
    d = tmp_path / "a.docx"; make_docx(d)
    x = tmp_path / "a.xlsx"; make_xlsx(x)
    assert len(parse_file(d)) == 2
    assert any("Switch 48 port" in q.text for q in parse_file(x))


def test_zip_end_to_end(tmp_path):
    make_pdf(tmp_path / "n.pdf"); make_docx(tmp_path / "s.docx")
    z = tmp_path / "pack.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.write(tmp_path / "n.pdf", "folder/n.pdf")
        zf.write(tmp_path / "s.docx", "s.docx")
        zf.writestr("notes.txt", "ignored")
    results = process_file(z, document_id="doc1")
    assert sorted(r.file_name for r in results) == ["n.pdf", "s.docx"]
    assert all(r.chunks and r.error is None for r in results)
    c = results[0].chunks[0]
    assert c.document_name and c.paragraph_number is not None


def test_zip_slip_is_neutralised(tmp_path):
    z = tmp_path / "evil.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr("../../evil.pdf", "x")
    out = tmp_path / "sub" / "out"
    files = unpack_zip(z, out)
    # path is flattened: file lands INSIDE out/, nothing escapes
    assert [f.parent for f in files] == [out.resolve()]
    assert not (tmp_path / "evil.pdf").exists()
    assert not (tmp_path.parent / "evil.pdf").exists()


def test_bad_files_give_readable_errors(tmp_path):
    bad = tmp_path / "x.pdf"; bad.write_bytes(b"not a pdf")
    r = process_file(bad, document_id="d")[0]
    assert r.error and "PDF" in r.error
    z = tmp_path / "x.zip"; z.write_bytes(b"nope")
    assert "ZIP" in process_file(z, document_id="d")[0].error
