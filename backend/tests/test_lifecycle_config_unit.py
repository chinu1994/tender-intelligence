"""Lifecycle rules, configuration validation and exporter helpers (unit)."""
import datetime as dt
import io

import docx
import pytest

from app.core.config import Settings
from app.models import TenderCaseStatus as S
from app.models import UserRole
from app.services.exporters import (
    ExportBundle,
    ExportRequirement,
    ExportSection,
    build_compliance_xlsx,
    build_proposal_docx,
    parse_position_row,
)
from app.services.extraction import normalize_category
from app.services.lifecycle import TransitionError, allowed_transitions, validate_transition


def test_allowed_transitions_by_role():
    assert allowed_transitions(S.NEW, UserRole.EDITOR) == [S.ANALYSIS]
    assert allowed_transitions(S.APPROVED, UserRole.EDITOR) == [S.COMPLETED]
    assert allowed_transitions(S.APPROVED, UserRole.REVIEWER) == [S.PROPOSAL_DRAFT, S.COMPLETED]
    assert allowed_transitions(S.COMPLETED, UserRole.ADMIN) == []


@pytest.mark.parametrize("current,target,code", [
    (S.PROPOSAL_DRAFT, S.APPROVED, 400),
    (S.NEW, S.COMPLETED, 409),
    (S.APPROVED, S.PROPOSAL_DRAFT, 403),
])
def test_invalid_transitions(current, target, code):
    with pytest.raises(TransitionError) as exc:
        validate_transition(current, target, UserRole.EDITOR)
    assert exc.value.status_code == code


def test_same_status_is_noop():
    validate_transition(S.COMPLETED, S.COMPLETED, UserRole.EDITOR)


@pytest.mark.parametrize("raw,expected", [
    ("deadlines", "deadline"), ("Requirements", "mandatory"), ("lot", "lots"),
    ("evaluation_criteria", "evaluation"), ("something", "general"), (None, "general"),
])
def test_normalize_category(raw, expected):
    assert normalize_category(raw) == expected


def test_settings_validation(monkeypatch):
    s = Settings()
    s.JWT_SECRET = "short"
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        s.validate()
    s.JWT_SECRET = "x" * 40
    s.validate()
    s.APP_ENV = "production"
    s.CELERY_TASK_ALWAYS_EAGER = True
    with pytest.raises(RuntimeError, match="EAGER"):
        s.validate()
    s.CELERY_TASK_ALWAYS_EAGER = False
    s.ARGON2_TIME_COST = 1
    with pytest.raises(RuntimeError, match="Argon2"):
        s.validate()


def test_cors_origins_parsing(monkeypatch):
    s = Settings()
    s.CORS_ORIGINS = "https://app.example.com, https://admin.example.com ,"
    assert s.cors_origin_list == ["https://app.example.com", "https://admin.example.com"]
    s.CORS_ORIGINS = ""
    assert s.cors_origin_list == ["http://localhost:3000"]


def test_parse_position_row():
    assert parse_position_row("Prices: 1.1 | Switch | 4") == ("Prices", ["1.1", "Switch", "4"])
    assert parse_position_row("no sheet") == ("", ["no sheet"])


def _bundle(**overrides):
    base = dict(
        case_name="Case", reference=None, submission_deadline=dt.date(2026, 1, 2), status="approved",
        organization="Org", sections=[ExportSection("Intro", "", "draft")],
        requirements=[ExportRequirement(id="1", requirement="R", category="mandatory", mandatory=True,
                                        confidence=0.9, review_status="rejected")],
        issues=[],
    )
    base.update(overrides)
    return ExportBundle(**base)


def test_docx_handles_empty_content_and_approved_status():
    document = docx.Document(io.BytesIO(build_proposal_docx(_bundle())))
    text = [p.text for p in document.paragraphs]
    assert "[Content pending]" in text
    assert "No extracted requirements." in text  # rejected ones are excluded
    assert "DRAFT" not in document.sections[0].header.paragraphs[0].text


def test_xlsx_with_no_data_is_still_valid():
    import openpyxl

    workbook = openpyxl.load_workbook(io.BytesIO(build_compliance_xlsx(_bundle(requirements=[]))))
    assert workbook["Compliance Matrix"].max_row == 1
