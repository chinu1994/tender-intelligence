// STATIC DESIGN DATA (Phase 3 · Screen 8)
// Replace with API calls in lib/api.ts when the backend is ready.

export type ProposalState = "approved" | "draft";

export type ExportCase = {
  id: string;
  name: string;
  proposalState: ProposalState;
  sectionsComplete: number;
  sectionsTotal: number;
  openIssues: number;
  lots: number;
  positions: number;
  requirements: number;
};

export const mockExportCases: ExportCase[] = [
  {
    id: "TC-2026-014",
    name: "Municipal IT Services Tender",
    proposalState: "approved",
    sectionsComplete: 6,
    sectionsTotal: 6,
    openIssues: 0,
    lots: 4,
    positions: 128,
    requirements: 27,
  },
  {
    id: "TC-2026-009",
    name: "Hospital Network Upgrade",
    proposalState: "draft",
    sectionsComplete: 4,
    sectionsTotal: 6,
    openIssues: 3,
    lots: 3,
    positions: 86,
    requirements: 19,
  },
  {
    id: "TC-2026-003",
    name: "Smart Street Lighting",
    proposalState: "draft",
    sectionsComplete: 1,
    sectionsTotal: 5,
    openIssues: 5,
    lots: 2,
    positions: 41,
    requirements: 12,
  },
];

/* ------------------------------ DOCX ------------------------------ */

export type DocxTemplate = { id: string; name: string; description: string };

export const docxTemplates: DocxTemplate[] = [
  {
    id: "standard",
    name: "Standard tender response",
    description: "Full formatted response with headings, numbering and header/footer.",
  },
  {
    id: "compact",
    name: "Compact response",
    description: "Shorter layout for small tenders. No cover page spacing.",
  },
];

export type DocxOption = { id: string; label: string; hint: string; defaultOn: boolean };

export const docxOptions: DocxOption[] = [
  { id: "cover", label: "Cover page", hint: "Case title, reference and submission date", defaultOn: true },
  { id: "toc", label: "Table of contents", hint: "Linked list of all sections", defaultOn: true },
  { id: "compliance", label: "Compliance table", hint: "Each requirement with the section that answers it", defaultOn: true },
  { id: "sources", label: "Source references", hint: "Document, page and paragraph for past answers used", defaultOn: false },
];

export const docxOutline = [
  "Executive summary",
  "Company profile",
  "Technical approach",
  "Delivery plan and timeline",
  "Pricing and commercial terms",
  "References and evidence",
];

/* ------------------------------ XLSX ------------------------------ */

export type XlsxSheet = {
  id: "positions" | "lots" | "compliance";
  name: string;
  description: string;
  columns: string[];
};

export const xlsxSheets: XlsxSheet[] = [
  {
    id: "positions",
    name: "Tender positions",
    description: "Every priced position from the tender, one row each.",
    columns: ["Pos.", "Description", "Qty", "Unit", "Lot"],
  },
  {
    id: "lots",
    name: "Lot breakdown",
    description: "Lots and bundles with their positions and estimated value.",
    columns: ["Lot", "Title", "Positions", "Est. value"],
  },
  {
    id: "compliance",
    name: "Compliance matrix",
    description: "Each requirement, our response and where it is answered.",
    columns: ["Requirement", "Type", "Response section", "Status", "Source"],
  },
];

/* ----------------------------- History ----------------------------- */

export type ExportRecord = {
  id: string;
  caseId: string;
  format: "docx" | "xlsx";
  fileName: string;
  size: string;
  by: string;
  createdAt: string;
  draft: boolean;
};

export const mockExportHistory: ExportRecord[] = [
  {
    id: "x1",
    caseId: "TC-2026-014",
    format: "docx",
    fileName: "TC-2026-014_proposal_v2.docx",
    size: "412 KB",
    by: "reviewer@acme.com",
    createdAt: "Yesterday",
    draft: false,
  },
  {
    id: "x2",
    caseId: "TC-2026-014",
    format: "xlsx",
    fileName: "TC-2026-014_tender_data_v1.xlsx",
    size: "168 KB",
    by: "editor@acme.com",
    createdAt: "Yesterday",
    draft: false,
  },
  {
    id: "x3",
    caseId: "TC-2026-009",
    format: "docx",
    fileName: "TC-2026-009_proposal_DRAFT_v1.docx",
    size: "288 KB",
    by: "editor@acme.com",
    createdAt: "3 days ago",
    draft: true,
  },
  {
    id: "x4",
    caseId: "TC-2026-009",
    format: "xlsx",
    fileName: "TC-2026-009_tender_data_v1.xlsx",
    size: "124 KB",
    by: "editor@acme.com",
    createdAt: "3 days ago",
    draft: false,
  },
];