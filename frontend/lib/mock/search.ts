// STATIC DESIGN DATA (Phase 2 · Screen 3)
// Replace with API calls in lib/api.ts when the backend is ready.

import type { Outcome } from "@/lib/mock/knowledge-base";

export type SearchResult = {
  id: string;
  score: number; // similarity, 0 - 1
  snippet: string;
  // Source reference (always shown with every result)
  documentName: string;
  page: number;
  paragraph: number;
  // Parent historical tender
  tenderTitle: string;
  client: string;
  year: number;
  outcome: Outcome;
};

export const exampleQueries = [
  "data protection and GDPR compliance",
  "service level agreement response times",
  "project team experience and references",
  "payment terms and penalties",
];

export const mockResults: SearchResult[] = [
  {
    id: "r1",
    score: 0.94,
    snippet:
      "The supplier shall comply with all applicable data protection legislation, including the UK GDPR, and shall process personal data only on documented instructions from the Council. All data will be hosted within UK data centres and encrypted at rest and in transit.",
    documentName: "Technical_Response_v3.docx",
    page: 14,
    paragraph: 3,
    tenderTitle: "City Council ERP Modernisation",
    client: "Leeds City Council",
    year: 2025,
    outcome: "won",
  },
  {
    id: "r2",
    score: 0.89,
    snippet:
      "Our data protection framework is certified to ISO 27001. A named Data Protection Officer oversees compliance, and a breach notification process ensures the client is informed within 24 hours of any incident.",
    documentName: "Quality_and_Security_Annex.pdf",
    page: 6,
    paragraph: 2,
    tenderTitle: "Municipal Cloud Migration",
    client: "Manchester City Council",
    year: 2024,
    outcome: "won",
  },
  {
    id: "r3",
    score: 0.82,
    snippet:
      "Service levels: critical incidents receive a response within 30 minutes and a resolution target of 4 hours. Monthly service reports are provided and service credits apply when targets are missed.",
    documentName: "SLA_Schedule.xlsx",
    page: 2,
    paragraph: 1,
    tenderTitle: "Regional Hospital Network Upgrade",
    client: "NHS North West",
    year: 2025,
    outcome: "lost",
  },
  {
    id: "r4",
    score: 0.76,
    snippet:
      "All personal data collected through the ticketing platform is processed in line with data protection law. A data protection impact assessment was completed before go-live and reviewed annually.",
    documentName: "Bid_Submission_Final.pdf",
    page: 31,
    paragraph: 4,
    tenderTitle: "Public Transport Ticketing System",
    client: "Transport for West Midlands",
    year: 2023,
    outcome: "lost",
  },
  {
    id: "r5",
    score: 0.71,
    snippet:
      "The proposed team includes a certified project manager, two senior engineers and a dedicated service lead, each with at least five years of experience delivering similar public sector projects.",
    documentName: "Technical_Response_v3.docx",
    page: 22,
    paragraph: 1,
    tenderTitle: "City Council ERP Modernisation",
    client: "Leeds City Council",
    year: 2025,
    outcome: "won",
  },
  {
    id: "r6",
    score: 0.64,
    snippet:
      "Payment will be made in monthly instalments within 30 days of a valid invoice. Late delivery of milestones may result in a penalty of 0.5% of the monthly charge per week of delay, capped at 10%.",
    documentName: "Commercial_Terms.docx",
    page: 4,
    paragraph: 5,
    tenderTitle: "Smart Street Lighting Rollout",
    client: "Bristol City Council",
    year: 2024,
    outcome: "completed",
  },
];