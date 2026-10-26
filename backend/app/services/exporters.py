"""DOCX proposal and XLSX compliance/position exports.

Both generators are pure functions of an ``ExportBundle`` so they can be
unit-tested without HTTP or a database.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import re
from collections import OrderedDict
from dataclasses import dataclass, field
from io import BytesIO

from docx import Document as DocxDocument
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

BRAND = RGBColor(0x1F, 0x3A, 0x5F)
BRAND_HEX = "1F3A5F"
LIGHT_HEX = "E8EEF5"


@dataclass
class ExportRequirement:
    id: str
    requirement: str
    category: str
    mandatory: bool
    confidence: float
    review_status: str
    deadline_value: str | None = None
    lot_bundle: str | None = None
    evaluation_criteria: str | None = None
    document_reference: str | None = None
    required_evidence: list[str] = field(default_factory=list)
    source_document: str | None = None
    source_page: int | None = None
    source_paragraph: int | None = None
    review_note: str | None = None


@dataclass
class ExportSection:
    title: str
    content: str
    status: str


@dataclass
class ExportIssue:
    title: str
    description: str | None
    severity: str
    resolved: bool


@dataclass
class ExportPosition:
    document: str
    sheet: str
    row: int | None
    cells: list[str]


@dataclass
class ExportBundle:
    case_name: str
    reference: str | None
    submission_deadline: dt.date | None
    status: str
    organization: str
    sections: list[ExportSection]
    requirements: list[ExportRequirement]
    issues: list[ExportIssue]
    positions: list[ExportPosition] = field(default_factory=list)
    generated_at: dt.datetime = field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


# XML 1.0 forbids most C0 control characters; Word and Excel files containing
# them are rejected (python-docx/openpyxl raise). Text can come from PDFs, LLM
# output or API input, so everything is cleaned before rendering.
_INVALID_XML_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")


def clean_text(value):
    if isinstance(value, str):
        return _INVALID_XML_CHARS.sub("", value)
    if isinstance(value, list):
        return [clean_text(v) for v in value]
    return value


def _clean(obj):
    """Return a copy of a bundle dataclass tree with all strings cleaned."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return type(obj)(**{f.name: _clean(getattr(obj, f.name)) for f in dataclasses.fields(obj)})
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return clean_text(obj)


def citation(item: ExportRequirement) -> str:
    parts = [item.source_document or "Unknown source"]
    if item.source_page:
        parts.append(f"p. {item.source_page}")
    if item.source_paragraph:
        parts.append(f"para./row {item.source_paragraph}")
    return ", ".join(parts)


# ---------------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------------


def _add_field(paragraph, instruction: str) -> None:
    """Insert a Word field (PAGE, NUMPAGES, TOC...)."""
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "1" if "PAGE" in instruction else "Right-click and choose 'Update field' to build the table of contents."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(separate)
    run._r.append(placeholder)
    run._r.append(end)


def _shade(cell, hex_color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:color"), "auto")
    shading.set(qn("w:fill"), hex_color)
    tc_pr.append(shading)


def _configure_styles(document) -> None:
    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15
    for level, size in ((1, 16), (2, 13), (3, 12)):
        style = document.styles[f"Heading {level}"]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.color.rgb = BRAND
        style.font.bold = True


_HEADING = re.compile(r"^(#{1,3})\s+(.*)$")
_BULLET = re.compile(r"^\s*[-*•]\s+(.*)$")
_NUMBERED = re.compile(r"^\s*\d+[.)]\s+(.*)$")


def _write_rich_text(document, content: str) -> None:
    """Render light markdown: ## headings, - bullets, 1. numbered, **bold**."""
    if not content.strip():
        paragraph = document.add_paragraph("[Content pending]")
        paragraph.runs[0].italic = True
        return
    for raw in content.replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue
        heading = _HEADING.match(line)
        if heading:
            document.add_heading(heading.group(2).strip(), level=min(3, len(heading.group(1)) + 1))
            continue
        bullet = _BULLET.match(line)
        numbered = _NUMBERED.match(line)
        if bullet:
            paragraph = document.add_paragraph(style="List Bullet")
            text = bullet.group(1)
        elif numbered:
            paragraph = document.add_paragraph(style="List Number")
            text = numbered.group(1)
        elif line.startswith("  ") and document.paragraphs:
            paragraph = document.add_paragraph()
            paragraph.paragraph_format.left_indent = Cm(1.27)
            text = line.strip()
        else:
            paragraph = document.add_paragraph()
            text = line
        for index, part in enumerate(re.split(r"\*\*", text)):
            if part:
                run = paragraph.add_run(part)
                run.bold = index % 2 == 1


def build_proposal_docx(bundle: ExportBundle) -> bytes:
    bundle = _clean(bundle)
    document = DocxDocument()
    _configure_styles(document)
    section = document.sections[0]
    section.left_margin = section.right_margin = Cm(2.2)
    section.top_margin = section.bottom_margin = Cm(2.2)

    approved = bundle.status in {"approved", "completed"}
    header = section.header.paragraphs[0]
    header.text = f"{bundle.case_name}" + (f"  |  {bundle.reference}" if bundle.reference else "")
    header.runs[0].font.size = Pt(8)
    header.runs[0].font.color.rgb = RGBColor(0x66, 0x66, 0x66)
    if not approved:
        draft = header.add_run("   DRAFT - NOT APPROVED")
        draft.bold = True
        draft.font.size = Pt(8)
        draft.font.color.rgb = RGBColor(0xC0, 0x39, 0x2B)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("Page ").font.size = Pt(8)
    _add_field(footer, "PAGE")
    footer.add_run(" of ").font.size = Pt(8)
    _add_field(footer, "NUMPAGES")

    # Cover page
    for _ in range(6):
        document.add_paragraph()
    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run(bundle.case_name)
    run.bold = True
    run.font.size = Pt(26)
    run.font.color.rgb = BRAND
    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = subtitle.add_run("Proposal / Bid Response")
    sub.font.size = Pt(14)
    document.add_paragraph()

    meta = document.add_table(rows=0, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta.style = "Table Grid"
    rows = [
        ("Submitted by", bundle.organization),
        ("Tender reference", bundle.reference or "-"),
        ("Submission deadline", bundle.submission_deadline.isoformat() if bundle.submission_deadline else "-"),
        ("Document status", "Approved" if approved else "Draft"),
        ("Generated", bundle.generated_at.strftime("%Y-%m-%d %H:%M UTC")),
    ]
    for label, value in rows:
        cells = meta.add_row().cells
        cells[0].text = label
        cells[1].text = value
        _shade(cells[0], LIGHT_HEX)
        cells[0].paragraphs[0].runs[0].bold = True
    document.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # Table of contents
    document.add_heading("Contents", level=1)
    _add_field(document.add_paragraph(), 'TOC \\o "1-2" \\h \\z \\u')
    document.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    # Proposal sections
    for index, item in enumerate(bundle.sections, start=1):
        document.add_heading(f"{index}. {item.title}", level=1)
        _write_rich_text(document, item.content)

    # Appendix: compliance matrix (landscape)
    appendix = document.add_section()
    appendix.orientation = WD_ORIENT.LANDSCAPE
    appendix.page_width, appendix.page_height = section.page_height, section.page_width
    document.add_heading("Appendix A - Requirement Compliance Matrix", level=1)
    active = [r for r in bundle.requirements if r.review_status != "rejected"]
    if not active:
        document.add_paragraph("No extracted requirements.")
    else:
        table = document.add_table(rows=1, cols=6)
        table.style = "Table Grid"
        headers = ["#", "Requirement", "Category", "Mandatory", "Review status", "Source"]
        for cell, label in zip(table.rows[0].cells, headers):
            cell.text = label
            cell.paragraphs[0].runs[0].bold = True
            cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            _shade(cell, BRAND_HEX)
        for number, item in enumerate(active, start=1):
            cells = table.add_row().cells
            values = [
                str(number),
                item.requirement,
                item.category.replace("_", " "),
                "Yes" if item.mandatory else "No",
                item.review_status,
                citation(item),
            ]
            for cell, value in zip(cells, values):
                cell.text = value
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.font.size = Pt(9)

    open_issues = [i for i in bundle.issues if not i.resolved]
    if open_issues:
        document.add_heading("Appendix B - Open Issues", level=1)
        for issue in open_issues:
            paragraph = document.add_paragraph(style="List Bullet")
            paragraph.add_run(f"[{issue.severity.upper()}] {issue.title}").bold = True
            if issue.description:
                paragraph.add_run(f" - {issue.description}")

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# XLSX
# ---------------------------------------------------------------------------

HEADER_FONT = Font(bold=True, color="FFFFFF")
HEADER_FILL = PatternFill("solid", fgColor=BRAND_HEX)
THIN = Side(style="thin", color="C9D3DF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")


def _set(sheet, row: int, column: int, value):
    cell = sheet.cell(row=row, column=column, value=value)
    if isinstance(value, str):
        # Tender text such as "=== Lot 1 ===" or "=HYPERLINK(...)" must stay
        # text, never become a formula (corruption / formula injection).
        cell.data_type = "s"
    return cell


def _table(sheet, headers: list[str], rows: list[list], widths: list[int], start_row: int = 1) -> None:
    for column, label in enumerate(headers, start=1):
        cell = sheet.cell(row=start_row, column=column, value=label)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = BORDER
    for offset, values in enumerate(rows, start=1):
        for column, value in enumerate(values, start=1):
            cell = _set(sheet, start_row + offset, column, value)
            cell.alignment = WRAP
            cell.border = BORDER
    for column, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes = sheet.cell(row=start_row + 1, column=1)
    last_row = start_row + max(len(rows), 1)
    sheet.auto_filter.ref = f"A{start_row}:{get_column_letter(len(headers))}{last_row}"


def build_compliance_xlsx(bundle: ExportBundle) -> bytes:
    bundle = _clean(bundle)
    workbook = Workbook()
    active = [r for r in bundle.requirements if r.review_status != "rejected"]

    # Summary ---------------------------------------------------------------
    summary = workbook.active
    summary.title = "Summary"
    _set(summary, 1, 1, bundle.case_name)
    summary["A1"].font = Font(bold=True, size=16, color=BRAND_HEX)
    facts = [
        ("Organization", bundle.organization),
        ("Tender reference", bundle.reference or ""),
        ("Submission deadline", bundle.submission_deadline.isoformat() if bundle.submission_deadline else ""),
        ("Case status", bundle.status),
        ("Generated (UTC)", bundle.generated_at.strftime("%Y-%m-%d %H:%M")),
        ("Requirements (excl. rejected)", len(active)),
        ("Mandatory requirements", sum(1 for r in active if r.mandatory)),
        ("Verified", sum(1 for r in active if r.review_status == "verified")),
        ("Pending review", sum(1 for r in active if r.review_status == "pending")),
        ("Lots", len({r.lot_bundle for r in active if r.lot_bundle})),
        ("Tender positions", len(bundle.positions)),
        ("Open issues", sum(1 for i in bundle.issues if not i.resolved)),
    ]
    for row, (label, value) in enumerate(facts, start=3):
        summary.cell(row=row, column=1, value=label).font = Font(bold=True)
        _set(summary, row, 2, value)
    summary.column_dimensions["A"].width = 32
    summary.column_dimensions["B"].width = 48

    # Compliance matrix ------------------------------------------------------
    matrix = workbook.create_sheet("Compliance Matrix")
    headers = [
        "ID", "Requirement", "Category", "Mandatory", "Lot", "Deadline", "Evaluation criterion",
        "Required evidence", "Document reference", "Confidence", "Review status",
        "Source document", "Page", "Paragraph/Row", "Reviewer note",
        "Compliance (Yes/No/Partial)", "Response / comment",
    ]
    rows = [
        [
            f"REQ-{index:03d}",
            r.requirement,
            r.category,
            "Yes" if r.mandatory else "No",
            r.lot_bundle or "",
            r.deadline_value or "",
            r.evaluation_criteria or "",
            "\n".join(r.required_evidence or []),
            r.document_reference or "",
            round(r.confidence, 2),
            r.review_status,
            r.source_document or "",
            r.source_page or "",
            r.source_paragraph or "",
            r.review_note or "",
            "",
            "",
        ]
        for index, r in enumerate(active, start=1)
    ]
    _table(matrix, headers, rows, [10, 60, 14, 11, 10, 18, 30, 30, 20, 11, 13, 28, 7, 13, 28, 18, 40])
    for row in range(2, len(rows) + 2):
        matrix.cell(row=row, column=10).number_format = "0%"
    if rows:
        validation = DataValidation(type="list", formula1='"Yes,No,Partial"', allow_blank=True)
        matrix.add_data_validation(validation)
        validation.add(f"P2:P{len(rows) + 1}")

    # Lots -------------------------------------------------------------------
    lots_sheet = workbook.create_sheet("Lots")
    lots: "OrderedDict[str, list[ExportRequirement]]" = OrderedDict()
    for r in active:
        if r.lot_bundle:
            lots.setdefault(r.lot_bundle, []).append(r)
    lot_rows = [
        [
            name,
            len(items),
            sum(1 for i in items if i.mandatory),
            sum(1 for i in items if i.review_status == "verified"),
            "\n".join(f"- {i.requirement}" for i in items)[:32000],
            "; ".join(sorted({citation(i) for i in items}))[:32000],
        ]
        for name, items in lots.items()
    ]
    _table(lots_sheet, ["Lot / bundle", "Requirements", "Mandatory", "Verified", "Description / scope", "Sources"],
           lot_rows, [16, 13, 11, 10, 80, 50])

    # Positions --------------------------------------------------------------
    positions_sheet = workbook.create_sheet("Positions")
    width = max((len(p.cells) for p in bundle.positions), default=3)
    pos_headers = ["Pos.", "Source document", "Sheet", "Row"] + [f"Column {i}" for i in range(1, width + 1)]
    pos_rows = [
        [index, p.document, p.sheet, p.row or ""] + p.cells + [""] * (width - len(p.cells))
        for index, p in enumerate(bundle.positions, start=1)
    ]
    _table(positions_sheet, pos_headers, pos_rows, [7, 30, 16, 7] + [24] * width)

    # Deadlines --------------------------------------------------------------
    deadlines = workbook.create_sheet("Deadlines")
    _table(
        deadlines,
        ["Deadline", "Context", "Mandatory", "Source"],
        [[r.deadline_value, r.requirement, "Yes" if r.mandatory else "No", citation(r)]
         for r in active if r.deadline_value],
        [26, 80, 11, 40],
    )

    # Evidence ---------------------------------------------------------------
    evidence = workbook.create_sheet("Evidence")
    evidence_rows = []
    for r in active:
        items = r.required_evidence or ([r.requirement] if r.category == "evidence" else [])
        for item in items:
            evidence_rows.append([item, "Yes" if r.mandatory else "No", r.review_status, citation(r), ""])
    _table(evidence, ["Required evidence", "Mandatory", "Review status", "Source", "Provided (file / owner)"],
           evidence_rows, [80, 11, 13, 40, 30])

    # Open issues ------------------------------------------------------------
    issues = workbook.create_sheet("Open Issues")
    _table(
        issues,
        ["Issue", "Description", "Severity", "Resolved"],
        [[i.title, i.description or "", i.severity, "Yes" if i.resolved else "No"] for i in bundle.issues],
        [40, 70, 10, 10],
    )

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def parse_position_row(text: str) -> tuple[str, list[str]]:
    """Split stored spreadsheet chunk text ("Sheet: a | b | c") into cells."""
    sheet, sep, rest = text.partition(": ")
    if not sep:
        return "", [cell.strip() for cell in text.split(" | ")]
    return sheet, [cell.strip() for cell in rest.split(" | ")]
