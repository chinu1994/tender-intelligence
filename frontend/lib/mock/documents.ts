// STATIC DESIGN DATA (Phase 2 · Screen 1)
// Replace with API calls in lib/api.ts when the backend is ready.

export type DocumentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DocumentType = "pdf" | "docx" | "xlsx" | "zip";

export type TenderDocument = {
  id: string;
  name: string;
  type: DocumentType;
  size: string;
  status: DocumentStatus;
  stage: string;
  progress?: number; // 0-100, only while processing
  error?: string; // human-readable, only when failed
  uploadedAt: string;
  parentId?: string; // set for files extracted from a ZIP
};

export const mockCases = [
  { id: "TC-2026-014", name: "Municipal IT Services Tender" },
  { id: "TC-2026-009", name: "Hospital Network Upgrade" },
  { id: "TC-2026-003", name: "Smart Street Lighting" },
];

export const mockDocuments: TenderDocument[] = [
  {
    id: "d1",
    name: "tender_package_full.zip",
    type: "zip",
    size: "42.8 MB",
    status: "completed",
    stage: "Unpacked · 6 files",
    uploadedAt: "2 min ago",
  },
  {
    id: "d2",
    name: "01_tender_notice.pdf",
    type: "pdf",
    size: "1.2 MB",
    status: "completed",
    stage: "Indexed · 24 pages",
    uploadedAt: "2 min ago",
    parentId: "d1",
  },
  {
    id: "d3",
    name: "02_technical_specification.pdf",
    type: "pdf",
    size: "8.4 MB",
    status: "processing",
    stage: "Extracting text",
    progress: 64,
    uploadedAt: "2 min ago",
    parentId: "d1",
  },
  {
    id: "d4",
    name: "03_terms_and_conditions.docx",
    type: "docx",
    size: "540 KB",
    status: "processing",
    stage: "Indexing vectors",
    progress: 88,
    uploadedAt: "2 min ago",
    parentId: "d1",
  },
  {
    id: "d5",
    name: "04_price_sheet.xlsx",
    type: "xlsx",
    size: "310 KB",
    status: "completed",
    stage: "Indexed · 3 sheets",
    uploadedAt: "2 min ago",
    parentId: "d1",
  },
  {
    id: "d6",
    name: "05_annex_scanned_drawings.pdf",
    type: "pdf",
    size: "28.1 MB",
    status: "failed",
    stage: "Text extraction failed",
    error:
      "No readable text found. This PDF looks like a scanned image. Upload a text-based PDF or an OCR'd version.",
    uploadedAt: "2 min ago",
    parentId: "d1",
  },
  {
    id: "d7",
    name: "06_declaration_forms.docx",
    type: "docx",
    size: "96 KB",
    status: "completed",
    stage: "Indexed · 7 pages",
    uploadedAt: "2 min ago",
    parentId: "d1",
  },
  {
    id: "d8",
    name: "clarification_questions_v2.pdf",
    type: "pdf",
    size: "420 KB",
    status: "pending",
    stage: "Waiting in queue (#2)",
    uploadedAt: "just now",
  },
  {
    id: "d9",
    name: "bill_of_quantities.xlsx",
    type: "xlsx",
    size: "1.1 MB",
    status: "pending",
    stage: "Waiting in queue (#3)",
    uploadedAt: "just now",
  },
];