// STATIC DESIGN DATA (Phase 2 · Screen 4)
// Replace with API calls in lib/api.ts when the backend is ready.

export type Category =
  | "deadlines"
  | "lots"
  | "requirements"
  | "evidence"
  | "references";

export type FieldStatus = "pending" | "confirmed" | "corrected";

export type Citation = {
  documentName: string;
  page: number;
  paragraph: number;
  text: string; // the paragraph from the original document
  highlight: string; // the part of `text` that the value came from
};

export type ExtractedField = {
  id: string;
  category: Category;
  label: string;
  value: string;
  originalValue: string; // what the system extracted, kept after edits
  confidence: number; // 0 - 1
  flag?: string; // human-readable warning
  status: FieldStatus;
  citation: Citation;
};

export const CATEGORY_ORDER: Category[] = [
  "deadlines",
  "lots",
  "requirements",
  "evidence",
  "references",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  deadlines: "Deadlines",
  lots: "Lots / Bundles",
  requirements: "Requirements & Evaluation",
  evidence: "Required Evidence",
  references: "Document References",
};

export const mockCaseInfo = {
  id: "TC-2026-014",
  name: "Municipal IT Services Tender",
};

export const mockFields: ExtractedField[] = [
  {
    id: "f1",
    category: "deadlines",
    label: "Bid submission deadline",
    value: "14 November 2026, 12:00",
    originalValue: "14 November 2026, 12:00",
    confidence: 0.97,
    status: "pending",
    citation: {
      documentName: "01_tender_notice.pdf",
      page: 2,
      paragraph: 4,
      text: "Completed tenders must be submitted through the e-procurement portal no later than 14 November 2026, 12:00 (UK time). Late submissions will not be accepted under any circumstances.",
      highlight: "14 November 2026, 12:00",
    },
  },
  {
    id: "f2",
    category: "deadlines",
    label: "Clarification questions deadline",
    value: "30 October 2026",
    originalValue: "30 October 2026",
    confidence: 0.58,
    flag: "Two documents give different dates (30 Oct and 2 Nov).",
    status: "pending",
    citation: {
      documentName: "clarification_questions_v2.pdf",
      page: 1,
      paragraph: 2,
      text: "Bidders may submit clarification questions in writing. All questions must be received by 30 October 2026 to be answered before the submission deadline.",
      highlight: "30 October 2026",
    },
  },
  {
    id: "f3",
    category: "lots",
    label: "Lot 1",
    value: "Network infrastructure and managed services",
    originalValue: "Network infrastructure and managed services",
    confidence: 0.93,
    status: "pending",
    citation: {
      documentName: "01_tender_notice.pdf",
      page: 5,
      paragraph: 1,
      text: "This tender is divided into two lots. Lot 1: Network infrastructure and managed services, estimated value £1.8M over 36 months.",
      highlight: "Network infrastructure and managed services",
    },
  },
  {
    id: "f4",
    category: "lots",
    label: "Lot 2",
    value: "End-user devices and helpdesk",
    originalValue: "End-user devices and helpdesk",
    confidence: 0.9,
    status: "pending",
    citation: {
      documentName: "01_tender_notice.pdf",
      page: 5,
      paragraph: 2,
      text: "Lot 2: End-user devices and helpdesk support, estimated value £0.9M over 36 months. Bidders may bid for one or both lots.",
      highlight: "End-user devices and helpdesk",
    },
  },
  {
    id: "f5",
    category: "requirements",
    label: "Mandatory: security certification",
    value: "ISO 27001 certification required",
    originalValue: "ISO 27001 certification required",
    confidence: 0.95,
    status: "pending",
    citation: {
      documentName: "02_technical_specification.pdf",
      page: 12,
      paragraph: 3,
      text: "The supplier must hold a valid ISO 27001 certification at the time of submission. Bids without this certification will be excluded.",
      highlight: "ISO 27001 certification",
    },
  },
  {
    id: "f6",
    category: "requirements",
    label: "Mandatory: response time",
    value: "Critical incidents: 1 hour",
    originalValue: "Critical incidents: 1 hour",
    confidence: 0.62,
    flag: "Value looks different from the SLA annex (30 minutes).",
    status: "pending",
    citation: {
      documentName: "02_technical_specification.pdf",
      page: 18,
      paragraph: 2,
      text: "Critical incidents shall receive an initial response within 1 hour, 24 hours a day, 7 days a week, as set out in the service level schedule.",
      highlight: "within 1 hour",
    },
  },
  {
    id: "f7",
    category: "requirements",
    label: "Evaluation criteria",
    value: "Quality 60% / Price 40%",
    originalValue: "Quality 60% / Price 40%",
    confidence: 0.88,
    status: "pending",
    citation: {
      documentName: "03_terms_and_conditions.docx",
      page: 7,
      paragraph: 1,
      text: "Tenders will be evaluated on the most economically advantageous basis: quality 60% and price 40%.",
      highlight: "quality 60% and price 40%",
    },
  },
  {
    id: "f8",
    category: "evidence",
    label: "Past experience",
    value: "3 public sector references in the last 5 years",
    originalValue: "3 public sector references in the last 5 years",
    confidence: 0.84,
    status: "pending",
    citation: {
      documentName: "06_declaration_forms.docx",
      page: 3,
      paragraph: 2,
      text: "Bidders must provide at least three references for comparable public sector contracts delivered within the last five years.",
      highlight: "at least three references",
    },
  },
  {
    id: "f9",
    category: "evidence",
    label: "Financial standing",
    value: "Annual turnover of at least £2M",
    originalValue: "Annual turnover of at least £2M",
    confidence: 0.48,
    flag: "Amount was inferred; not stated exactly in the source.",
    status: "pending",
    citation: {
      documentName: "03_terms_and_conditions.docx",
      page: 9,
      paragraph: 4,
      text: "The bidder shall demonstrate sufficient financial standing, normally an annual turnover of at least twice the annual contract value.",
      highlight: "annual turnover of at least twice the annual contract value",
    },
  },
  {
    id: "f10",
    category: "references",
    label: "Pricing template",
    value: "04_price_sheet.xlsx",
    originalValue: "04_price_sheet.xlsx",
    confidence: 0.96,
    status: "pending",
    citation: {
      documentName: "01_tender_notice.pdf",
      page: 8,
      paragraph: 3,
      text: "Pricing must be entered in the supplied price sheet (04_price_sheet.xlsx). Prices submitted in any other format will not be evaluated.",
      highlight: "04_price_sheet.xlsx",
    },
  },
];