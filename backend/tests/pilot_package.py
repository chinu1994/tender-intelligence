"""Reference tender package for the pilot acceptance case.

Generates a realistic, fully synthetic tender (no real organisation) as a ZIP
of five documents plus two historical bids for the knowledge base:

    python -m tests.pilot_package ../samples      # from backend/

The acceptance test (tests/test_pilot_acceptance.py) uses the same builder,
so the sample files and the automated test can never drift apart.
"""
from __future__ import annotations

import sys
from pathlib import Path

from tests import factories as f

AUTHORITY = "Municipality of Eastbrook (fictitious)"
TITLE = "Managed Network and Helpdesk Services"
REFERENCE = "EB-IT-2026-041"

ITT_PAGES = [
    [
        "Invitation to Tender",
        f"{TITLE}",
        "",
        f"Contracting authority: {AUTHORITY}. Reference: {REFERENCE}.",
        "",
        "Tenders must be received no later than 14 November 2026, 12:00 CET.",
        "",
        "Clarification questions must be submitted by 30 October 2026.",
        "",
        "The authority intends to award a framework agreement for five years.",
    ],
    [
        "Lots",
        "",
        "Lot 1 covers supply and installation of network hardware at 12 sites.",
        "",
        "Lot 2 covers a 24x7 helpdesk and managed network support for five years.",
        "",
        "Bidders may submit a tender for one or both lots.",
    ],
    [
        "Mandatory requirements",
        "",
        "The bidder must hold a valid ISO 27001 certificate.",
        "",
        "The bidder shall provide three client references from the last five years.",
        "",
        "The bidder must demonstrate an annual turnover of at least EUR 2 million.",
        "",
        "The bidder shall complete the price schedule in Annex B (02_Price_Schedule.xlsx).",
    ],
    [
        "Evaluation",
        "",
        "Award criteria: price 40%, technical quality 45% and sustainability 15%.",
        "",
        "Tenders that do not meet a mandatory requirement will be excluded.",
    ],
]

EVIDENCE_PAGES = [
    [
        "Evidence checklist",
        "",
        "Attach proof of public liability insurance of at least EUR 5 million.",
        "",
        "Provide a copy of the company registration certificate.",
    ]
]

PRICE_SCHEDULE = {
    "Positions": [
        ["Pos", "Description", "Unit", "Qty", "Lot"],
        ["1.1", "Core switch, 48 ports, 10G uplinks", "pcs", 24, "Lot 1"],
        ["1.2", "Access point, Wi-Fi 6E", "pcs", 180, "Lot 1"],
        ["1.3", "Installation and configuration", "days", 60, "Lot 1"],
        ["2.1", "24x7 helpdesk service", "months", 60, "Lot 2"],
        ["2.2", "Managed network monitoring", "months", 60, "Lot 2"],
    ]
}

REQUIREMENTS_MATRIX = {
    "Requirements": [
        ["ID", "Requirement", "Type"],
        ["TR-01", "The solution must support IPv6 on all core devices.", "Mandatory"],
        ["TR-02", "The helpdesk shall respond to priority 1 incidents within 15 minutes.", "Mandatory"],
        ["TR-03", "Monthly service reports are appreciated.", "Optional"],
    ]
}

RESPONSE_TEMPLATE_PARAGRAPHS = [
    "Tender response template",
    "Section A - Company information",
    "Section B - Technical response",
    "Bidders must use this template for their response.",
]
RESPONSE_TEMPLATE_TABLE = [
    ["Form", "Instruction"],
    ["Form 1", "The declaration of compliance must be signed by an authorised signatory."],
]

HISTORICAL_WON = [
    "Riverside County - managed network services bid (won, 2024).",
    "We operate a 24x7 helpdesk and respond to priority 1 incidents within 15 minutes.",
    "Our information security management system is ISO 27001 certified; the certificate is attached.",
    "All core network devices we deploy support IPv6 natively.",
    "Three public-sector references are provided in Annex 2.",
]
HISTORICAL_LOST = [
    ["Lakeside Utilities - network refresh bid (lost, 2023)."],
    ["Our price was 18% above the winning bid; the technical score was rated good."],
]

PACKAGE_MEMBERS = {
    "EB-IT-2026-041/01_Invitation_to_Tender.pdf": lambda: f.pdf_bytes(ITT_PAGES),
    "EB-IT-2026-041/02_Price_Schedule.xlsx": lambda: f.xlsx_bytes(PRICE_SCHEDULE),
    "EB-IT-2026-041/03_Requirements_Matrix.xlsx": lambda: f.xlsx_bytes(REQUIREMENTS_MATRIX),
    "EB-IT-2026-041/04_Response_Template.docx": lambda: f.docx_bytes(RESPONSE_TEMPLATE_PARAGRAPHS, RESPONSE_TEMPLATE_TABLE),
    "EB-IT-2026-041/05_Evidence_Checklist.pdf": lambda: f.pdf_bytes(EVIDENCE_PAGES),
    "EB-IT-2026-041/readme.txt": lambda: b"Unsupported file types are ignored during unpacking.",
}


def tender_package_zip() -> bytes:
    return f.zip_bytes({name: build() for name, build in PACKAGE_MEMBERS.items()})


def historical_bids() -> dict[str, bytes]:
    return {
        "Bid_Riverside_2024.docx": f.docx_bytes(HISTORICAL_WON),
        "Bid_Lakeside_2023.pdf": f.pdf_bytes(HISTORICAL_LOST),
    }


def write_samples(directory: Path) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    written = [directory / "pilot-tender-package.zip"]
    written[0].write_bytes(tender_package_zip())
    for name, content in historical_bids().items():
        path = directory / f"historical-{name}"
        path.write_bytes(content)
        written.append(path)
    return written


if __name__ == "__main__":
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "samples")
    for path in write_samples(target):
        print(path)
