// STATIC DESIGN DATA (Phase 3 · Screen 7)
// Replace with API calls in lib/api.ts when the backend is ready.

export type SectionStatus = "draft" | "complete";

export type ProposalSection = {
  id: string;
  title: string;
  content: string;
  status: SectionStatus;
};

export type ReqType = "mandatory" | "evaluation" | "evidence";

export type ProposalRequirement = {
  id: string;
  type: ReqType;
  text: string;
  sectionId: string; // where this requirement should be answered
};

export type Snippet = {
  id: string;
  sectionId: string;
  score: number; // similarity 0 - 1
  text: string;
  documentName: string;
  page: number;
  paragraph: number;
  tenderTitle: string;
  outcome: "won" | "lost" | "completed";
};

export type Severity = "high" | "medium" | "low";

export type Issue = {
  id: string;
  text: string;
  severity: Severity;
  sectionId: string;
  resolved: boolean;
};

export const mockProposalCase = {
  id: "TC-2026-014",
  name: "Municipal IT Services Tender",
  deadline: "14 Nov 2026",
};

export const mockSections: ProposalSection[] = [
  {
    id: "s1",
    title: "Executive summary",
    status: "complete",
    content:
      "We are pleased to submit our proposal for the Municipal IT Services contract. Our team combines proven public sector delivery with a secure, resilient service model designed to meet every mandatory requirement in this tender.",
  },
  {
    id: "s2",
    title: "Understanding of requirements",
    status: "draft",
    content:
      "The Council requires a managed network and end-user service across two lots over a 36-month term. We understand the priorities are service continuity, information security and value for money.",
  },
  {
    id: "s3",
    title: "Technical solution",
    status: "draft",
    content: "",
  },
  {
    id: "s4",
    title: "Security & data protection",
    status: "draft",
    content: "",
  },
  {
    id: "s5",
    title: "Team & experience",
    status: "draft",
    content: "",
  },
  {
    id: "s6",
    title: "Pricing & commercial terms",
    status: "draft",
    content: "",
  },
];

export const mockProposalRequirements: ProposalRequirement[] = [
  {
    id: "pr1",
    type: "mandatory",
    text: "ISO 27001 certification required",
    sectionId: "s4",
  },
  {
    id: "pr2",
    type: "mandatory",
    text: "Critical incidents: response within 1 hour",
    sectionId: "s3",
  },
  {
    id: "pr3",
    type: "evaluation",
    text: "Quality 60% / Price 40%",
    sectionId: "s6",
  },
  {
    id: "pr4",
    type: "evidence",
    text: "3 public sector references in the last 5 years",
    sectionId: "s5",
  },
  {
    id: "pr5",
    type: "evidence",
    text: "Annual turnover of at least £2M",
    sectionId: "s6",
  },
  {
    id: "pr6",
    type: "mandatory",
    text: "Use the supplied price sheet (04_price_sheet.xlsx)",
    sectionId: "s6",
  },
];

export const mockSnippets: Snippet[] = [
  {
    id: "sn1",
    sectionId: "s4",
    score: 0.94,
    text: "The supplier shall comply with all applicable data protection legislation, including the UK GDPR, and shall process personal data only on documented instructions from the Council. All data will be hosted within UK data centres and encrypted at rest and in transit.",
    documentName: "Technical_Response_v3.docx",
    page: 14,
    paragraph: 3,
    tenderTitle: "City Council ERP Modernisation",
    outcome: "won",
  },
  {
    id: "sn2",
    sectionId: "s4",
    score: 0.89,
    text: "Our information security management system is certified to ISO 27001. A named Data Protection Officer oversees compliance, and any breach is reported to the client within 24 hours.",
    documentName: "Quality_and_Security_Annex.pdf",
    page: 6,
    paragraph: 2,
    tenderTitle: "Municipal Cloud Migration",
    outcome: "won",
  },
  {
    id: "sn3",
    sectionId: "s3",
    score: 0.82,
    text: "Critical incidents receive a response within 30 minutes and a resolution target of 4 hours. Monthly service reports are provided and service credits apply when targets are missed.",
    documentName: "SLA_Schedule.xlsx",
    page: 2,
    paragraph: 1,
    tenderTitle: "Regional Hospital Network Upgrade",
    outcome: "lost",
  },
  {
    id: "sn4",
    sectionId: "s5",
    score: 0.77,
    text: "The proposed team includes a certified project manager, two senior engineers and a dedicated service lead, each with at least five years of experience delivering similar public sector projects.",
    documentName: "Technical_Response_v3.docx",
    page: 22,
    paragraph: 1,
    tenderTitle: "City Council ERP Modernisation",
    outcome: "won",
  },
  {
    id: "sn5",
    sectionId: "s6",
    score: 0.68,
    text: "Payment will be made in monthly instalments within 30 days of a valid invoice. Pricing is fixed for the first 24 months and reviewed annually thereafter against an agreed index.",
    documentName: "Commercial_Terms.docx",
    page: 4,
    paragraph: 5,
    tenderTitle: "Smart Street Lighting Rollout",
    outcome: "completed",
  },
];

export const mockIssues: Issue[] = [
  {
    id: "i1",
    text: "Response time conflict: tender says 1 hour, our SLA says 30 minutes. Confirm which to commit to.",
    severity: "high",
    sectionId: "s3",
    resolved: false,
  },
  {
    id: "i2",
    text: "Clarification deadline unclear (30 Oct vs 2 Nov). Check before sending questions.",
    severity: "medium",
    sectionId: "s2",
    resolved: false,
  },
  {
    id: "i3",
    text: "Add two more public sector references to reach the required three.",
    severity: "medium",
    sectionId: "s5",
    resolved: false,
  },
  {
    id: "i4",
    text: "Attach latest ISO 27001 certificate as evidence.",
    severity: "low",
    sectionId: "s4",
    resolved: true,
  },
];