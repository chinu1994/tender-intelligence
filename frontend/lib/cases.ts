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

// "35 minutes ago", "Yesterday", "3 weeks ago" ...
export function timeAgo(iso: string, now: Date = new Date()) {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;

  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}