"""Parser, chunking and ZIP safety unit tests (no database required)."""
import re
import zipfile

import pytest

from app.processing.chunking import CHUNK_SIZE, chunk_paragraphs
from app.processing.parsers import (
    DocumentParseError,
    ParsedParagraph,
    original_name,
    parse_file,
    split_pdf_page_into_paragraphs,
    unpack_zip,
)
from app.processing.pipeline import GENERIC_ERROR, process_file, readable_error
from tests import factories as f


def write(tmp_path, name, content):
    path = tmp_path / name
    path.write_bytes(content)
    return path


def test_pdf_paragraph_splitting_heuristics():
    text = "Section 1 Scope\nThe supplier shall deliver hardware\nand install it on site.\n- first item\n- second item\n\nNew paragraph"
    assert split_pdf_page_into_paragraphs(text) == [
        "Section 1 Scope",
        "The supplier shall deliver hardware and install it on site.",
        "- first item",
        "- second item",
        "New paragraph",
    ]


def test_pdf_page_and_paragraph_numbers(tmp_path):
    path = write(tmp_path, "rfp.pdf", f.simple_rfp_pdf())
    paragraphs = parse_file(path)
    cites = [(p.page, p.paragraph) for p in paragraphs]
    assert cites == [(1, 1), (1, 2), (1, 3), (2, 1), (2, 2), (2, 3)]
    assert paragraphs[1].text == "The submission deadline is 14 November 2026 at 12:00 CET."


def test_docx_keeps_table_rows_in_document_order(tmp_path):
    content = f.docx_bytes(["Intro paragraph.", "Second paragraph."], [["Req", "Detail"], ["R1", "Must be green"]])
    paragraphs = parse_file(write(tmp_path, "a.docx", content))
    assert [p.text for p in paragraphs] == ["Intro paragraph.", "Second paragraph.", "Req | Detail", "R1 | Must be green"]
    assert [p.paragraph for p in paragraphs] == [1, 2, 3, 4]


def test_xlsx_rows_with_sheet_names_and_types(tmp_path):
    content = f.xlsx_bytes({"Lots": [["Lot", "Qty"], ["Lot 1", 3.0], [None, None], ["Lot 2", 2.5]], "Empty": []})
    paragraphs = parse_file(write(tmp_path, "a.xlsx", content))
    assert [(p.sheet, p.paragraph, p.text) for p in paragraphs] == [
        ("Lots", 1, "Lots: Lot | Qty"),
        ("Lots", 2, "Lots: Lot 1 | 3"),
        ("Lots", 4, "Lots: Lot 2 | 2.5"),
    ]


@pytest.mark.parametrize(
    "name,content,message",
    [
        ("a.pdf", b"garbage", "could not be read as a PDF"),
        ("a.docx", b"garbage", "Word (DOCX)"),
        ("a.xlsx", b"garbage", "Excel (XLSX)"),
        ("a.pdf", b"", "empty"),
        ("a.doc", b"anything", "Unsupported file type"),
    ],
)
def test_parse_errors_are_readable(tmp_path, name, content, message):
    with pytest.raises(DocumentParseError, match=re.escape(message)):
        parse_file(write(tmp_path, name, content))


def test_empty_docx_and_xlsx(tmp_path):
    with pytest.raises(DocumentParseError, match="does not contain any text"):
        parse_file(write(tmp_path, "e.docx", f.docx_bytes([])))
    with pytest.raises(DocumentParseError, match="does not contain any data"):
        parse_file(write(tmp_path, "e.xlsx", f.xlsx_bytes({"S": []})))


def test_encrypted_pdf_message(tmp_path):
    from pypdf import PdfReader, PdfWriter

    source = write(tmp_path, "plain.pdf", f.simple_rfp_pdf())
    writer = PdfWriter()
    for page in PdfReader(str(source)).pages:
        writer.add_page(page)
    writer.encrypt(user_password="secret", owner_password="owner")
    encrypted = tmp_path / "locked.pdf"
    with encrypted.open("wb") as handle:
        writer.write(handle)
    with pytest.raises(DocumentParseError, match="password-protected"):
        parse_file(encrypted)


def test_chunking_keeps_citations_and_splits_long_paragraphs():
    long_text = " ".join(f"word{i}" for i in range(600))
    chunks = chunk_paragraphs([ParsedParagraph("short", 3, 7), ParsedParagraph(long_text, 4, 1)], "x.pdf")
    assert chunks[0].text == "short" and (chunks[0].page_number, chunks[0].paragraph_number) == (3, 7)
    long_chunks = chunks[1:]
    assert len(long_chunks) >= 3
    assert all(len(c.text) <= CHUNK_SIZE for c in long_chunks)
    assert all((c.page_number, c.paragraph_number, c.document_name) == (4, 1, "x.pdf") for c in long_chunks)
    # overlap: consecutive chunks share text
    assert long_chunks[0].text.split()[-1] in long_chunks[1].text


def test_unpack_zip_flattens_and_filters(tmp_path):
    archive = write(tmp_path, "a.zip", f.zip_bytes({
        "dir/sub/a.pdf": b"%PDF", "b.DOCX": b"x", "c.txt": b"x", "nested.zip": b"x", "__MACOSX/._a.pdf": b"x", "dir/": b"",
    }))
    out = tmp_path / "out"
    files = unpack_zip(archive, out)
    assert sorted(original_name(p) for p in files) == ["a.pdf", "b.DOCX"]
    assert all(p.parent == out.resolve() for p in files)


def test_unpack_zip_same_names_do_not_overwrite(tmp_path):
    archive = write(tmp_path, "a.zip", f.zip_bytes({"x/a.pdf": b"one", "y/a.pdf": b"two"}))
    files = unpack_zip(archive, tmp_path / "out")
    assert sorted(p.read_bytes() for p in files) == [b"one", b"two"]


def test_unpack_zip_limits(tmp_path):
    many = write(tmp_path, "many.zip", f.zip_bytes({f"{i}.pdf": b"x" for i in range(5)}))
    with pytest.raises(DocumentParseError, match="contains 5 files"):
        unpack_zip(many, tmp_path / "o1", max_members=4)

    big = write(tmp_path, "big.zip", f.zip_bytes({"a.pdf": b"x" * 2000, "b.pdf": b"y" * 2000}))
    with pytest.raises(DocumentParseError, match="per-file limit"):
        unpack_zip(big, tmp_path / "o2", max_member_bytes=1000)
    with pytest.raises(DocumentParseError, match="total size limit"):
        unpack_zip(big, tmp_path / "o3", max_total_bytes=3000)


def test_unpack_zip_rejects_zip_bombs(tmp_path):
    bomb = write(tmp_path, "bomb.zip", f.zip_bytes({"a.pdf": b"\0" * 5_000_000}))
    with pytest.raises(DocumentParseError, match="suspicious compression ratio"):
        unpack_zip(bomb, tmp_path / "out")


def test_unpack_zip_rejects_encrypted_members(tmp_path):
    raw = bytearray(f.zip_bytes({"a.pdf": b"data"}))
    # set the "encrypted" general-purpose flag in the local and central headers
    local = raw.find(b"PK\x03\x04")
    central = raw.find(b"PK\x01\x02")
    raw[local + 6] |= 0x1
    raw[central + 8] |= 0x1
    path = write(tmp_path, "enc.zip", bytes(raw))
    with pytest.raises(DocumentParseError, match="password-protected"):
        unpack_zip(path, tmp_path / "out")


def test_pipeline_reports_empty_archive(tmp_path):
    archive = write(tmp_path, "a.zip", f.zip_bytes({"readme.txt": b"x"}))
    result = process_file(archive, document_id="d")
    assert result[0].error.startswith("The ZIP archive does not contain any supported")


def test_unexpected_errors_are_not_leaked():
    assert readable_error(RuntimeError("psycopg internal: password=secret")) == GENERIC_ERROR
    assert readable_error(DocumentParseError("Clear message")) == "Clear message"
