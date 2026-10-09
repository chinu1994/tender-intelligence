export type CaseStatus =
  | "new"
  | "analysis"
  | "review_required"
  | "proposal_draft"
  | "approved"
  | "completed";

export const CASE_STAGES: CaseStatus[] = [
  "new",
  "analysis",
  "review_required",
  "proposal_draft",
  "approved",
  "completed",
];

export type CaseItem = {
  id: string;
  title: string;
  reference: string;
  deadline: string | null; // YYYY-MM-DD
  status: CaseStatus;
  owner: string;
  updated: string;
  docsTotal: number;
  docsProcessed: number;
  docsFailed: number;
};

export const mockCases: CaseItem[] = [
  {
    id: "case-1",
    title: "Municipal IT Infrastructure Refresh",
    reference: "TND-2026-0117",
    deadline: "2026-10-14",
    status: "review_required",
    owner: "Priya Sharma",
    updated: "2 hours ago",
    docsTotal: 14,
    docsProcessed: 13,
    docsFailed: 1,
  },
  {
    id: "case-2",
    title: "Campus Wi-Fi Replacement",
    reference: "TND-2026-0142",
    deadline: "2026-10-30",
    status: "new",
    owner: "Rahul Verma",
    updated: "Yesterday",
    docsTotal: 0,
    docsProcessed: 0,
    docsFailed: 0,
  },
  {
    id: "case-3",
    title: "Regional Hospital Network Upgrade",
    reference: "TND-2026-0098",
    deadline: "2026-10-21",
    status: "analysis",
    owner: "Priya Sharma",
    updated: "35 minutes ago",
    docsTotal: 9,
    docsProcessed: 6,
    docsFailed: 0,
  },
  {
    id: "case-4",
    title: "City Library Server Migration",
    reference: "TND-2026-0089",
    deadline: "2026-11-12",
    status: "proposal_draft",
    owner: "Anita Das",
    updated: "3 days ago",
    docsTotal: 11,
    docsProcessed: 11,
    docsFailed: 0,
  },
  {
    id: "case-5",
    title: "School District Digital Classroom",
    reference: "TND-2026-0076",
    deadline: "2026-11-28",
    status: "approved",
    owner: "Anita Das",
    updated: "1 week ago",
    docsTotal: 8,
    docsProcessed: 8,
    docsFailed: 0,
  },
  {
    id: "case-6",
    title: "Public Transport Ticketing System",
    reference: "TND-2026-0061",
    deadline: "2026-09-18",
    status: "completed",
    owner: "Rahul Verma",
    updated: "3 weeks ago",
    docsTotal: 22,
    docsProcessed: 22,
    docsFailed: 0,
  },
  {
    id: "case-7",
    title: "Police Storage Expansion",
    reference: "TND-2026-0150",
    deadline: "2026-10-12",
    status: "analysis",
    owner: "Rahul Verma",
    updated: "10 minutes ago",
    docsTotal: 5,
    docsProcessed: 2,
    docsFailed: 2,
  },
  {
    id: "case-8",
    title: "Water Utility SCADA Upgrade",
    reference: "TND-2026-0153",
    deadline: "2026-12-15",
    status: "new",
    owner: "Priya Sharma",
    updated: "Today",
    docsTotal: 3,
    docsProcessed: 0,
    docsFailed: 0,
  },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Fixed format so server and browser render the same text.
export function formatDeadline(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function daysUntil(iso: string, from: Date = new Date()) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - today) / 86_400_000);
}