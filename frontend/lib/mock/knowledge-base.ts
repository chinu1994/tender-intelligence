// STATIC DESIGN DATA (Phase 2 · Screen 2)
// Replace with API calls in lib/api.ts when the backend is ready.

export type Outcome = "won" | "lost" | "completed";

export type IndexStatus = "indexed" | "indexing" | "pending" | "failed";

export type KnowledgeRecord = {
  id: string;
  title: string;
  client: string;
  year: number;
  outcome: Outcome;
  value: string;
  documents: number;
  indexStatus: IndexStatus;
  chunks: number; // vector chunks stored for similarity search
  indexError?: string; // human-readable, only when failed
  addedAt: string;
};

export const mockRecords: KnowledgeRecord[] = [
  {
    id: "k1",
    title: "City Council ERP Modernisation",
    client: "Leeds City Council",
    year: 2025,
    outcome: "won",
    value: "£1.2M",
    documents: 8,
    indexStatus: "indexed",
    chunks: 412,
    addedAt: "3 days ago",
  },
  {
    id: "k2",
    title: "Regional Hospital Network Upgrade",
    client: "NHS North West",
    year: 2025,
    outcome: "lost",
    value: "£3.4M",
    documents: 12,
    indexStatus: "indexed",
    chunks: 689,
    addedAt: "1 week ago",
  },
  {
    id: "k3",
    title: "Smart Street Lighting Rollout",
    client: "Bristol City Council",
    year: 2024,
    outcome: "completed",
    value: "£860K",
    documents: 6,
    indexStatus: "indexing",
    chunks: 120,
    addedAt: "10 min ago",
  },
  {
    id: "k4",
    title: "Municipal Cloud Migration",
    client: "Manchester City Council",
    year: 2024,
    outcome: "won",
    value: "£2.1M",
    documents: 9,
    indexStatus: "indexed",
    chunks: 534,
    addedAt: "2 weeks ago",
  },
  {
    id: "k5",
    title: "Public Transport Ticketing System",
    client: "Transport for West Midlands",
    year: 2023,
    outcome: "lost",
    value: "£4.8M",
    documents: 14,
    indexStatus: "failed",
    chunks: 0,
    indexError:
      "Some files could not be read. Re-upload the password-protected PDFs without a password.",
    addedAt: "1 month ago",
  },
  {
    id: "k6",
    title: "School Digital Learning Platform",
    client: "Surrey County Council",
    year: 2023,
    outcome: "completed",
    value: "£690K",
    documents: 5,
    indexStatus: "pending",
    chunks: 0,
    addedAt: "just now",
  },
];