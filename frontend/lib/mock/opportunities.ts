// STATIC DESIGN DATA (Phase 2 · Screen 6)
// Replace with API calls in lib/api.ts when the backend is ready.

export type Stage =
  | "new"
  | "analysis"
  | "review_required"
  | "proposal_draft"
  | "approved"
  | "completed";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "analysis", label: "Analysis" },
  { key: "review_required", label: "Review Required" },
  { key: "proposal_draft", label: "Proposal Draft" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
];

export type Opportunity = {
  id: string;
  title: string;
  client: string;
  stage: Stage;
  deadline: string; // display text
  daysLeft: number | null; // null when no deadline
  documents: number;
  owner: string;
  createdAt: string;
};

export const mockOpportunities: Opportunity[] = [
  {
    id: "TC-2026-014",
    title: "Municipal IT Services Tender",
    client: "Leeds City Council",
    stage: "review_required",
    deadline: "14 Nov 2026",
    daysLeft: 37,
    documents: 15,
    owner: "editor@acme.com",
    createdAt: "2 days ago",
  },
  {
    id: "TC-2026-013",
    title: "Hospital Network Upgrade",
    client: "NHS North West",
    stage: "analysis",
    deadline: "28 Nov 2026",
    daysLeft: 51,
    documents: 9,
    owner: "editor@acme.com",
    createdAt: "5 days ago",
  },
  {
    id: "TC-2026-012",
    title: "Smart Street Lighting",
    client: "Bristol City Council",
    stage: "proposal_draft",
    deadline: "20 Oct 2026",
    daysLeft: 12,
    documents: 11,
    owner: "editor@acme.com",
    createdAt: "2 weeks ago",
  },
  {
    id: "TC-2026-011",
    title: "School Digital Learning Platform",
    client: "Surrey County Council",
    stage: "approved",
    deadline: "12 Oct 2026",
    daysLeft: 4,
    documents: 7,
    owner: "admin@acme.com",
    createdAt: "3 weeks ago",
  },
  {
    id: "TC-2026-009",
    title: "Municipal Cloud Migration",
    client: "Manchester City Council",
    stage: "completed",
    deadline: "30 Sep 2026",
    daysLeft: null,
    documents: 13,
    owner: "editor@acme.com",
    createdAt: "2 months ago",
  },
  {
    id: "TC-2026-015",
    title: "Public Wi-Fi Rollout",
    client: "Cardiff Council",
    stage: "new",
    deadline: "No deadline set",
    daysLeft: null,
    documents: 0,
    owner: "editor@acme.com",
    createdAt: "just now",
  },
];