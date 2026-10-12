// STATIC DESIGN DATA (Phase 2 · Screen 9)
// Replace with API calls in lib/api.ts when the backend is ready.
// Keyed by the case id used in lib/mock/cases.ts.

export type CaseDetail = {
  fieldsTotal: number;
  fieldsReviewed: number;
  fieldsFlagged: number;
  sectionsTotal: number;
  sectionsComplete: number;
  openIssues: number;
  exportsCount: number;
  lots: { number: string; title: string; value: string }[];
  dates: { label: string; date: string }[]; // YYYY-MM-DD
  activity: { id: string; text: string; by: string; when: string }[];
};

export const emptyDetail: CaseDetail = {
  fieldsTotal: 0,
  fieldsReviewed: 0,
  fieldsFlagged: 0,
  sectionsTotal: 0,
  sectionsComplete: 0,
  openIssues: 0,
  exportsCount: 0,
  lots: [],
  dates: [],
  activity: [],
};

export const mockCaseDetails: Record<string, CaseDetail> = {
  "case-1": {
    fieldsTotal: 15,
    fieldsReviewed: 6,
    fieldsFlagged: 4,
    sectionsTotal: 0,
    sectionsComplete: 0,
    openIssues: 0,
    exportsCount: 0,
    lots: [
      { number: "1", title: "Network equipment", value: "EUR 420,000" },
      { number: "2", title: "Server and storage", value: "EUR 610,000" },
      { number: "3", title: "Installation and support", value: "To be confirmed" },
    ],
    dates: [
      { label: "Clarification questions", date: "2026-10-07" },
      { label: "Bid submission", date: "2026-10-14" },
      { label: "Contract start", date: "2026-12-01" },
    ],
    activity: [
      { id: "a1", text: "Extraction finished. 15 fields need review.", by: "System", when: "2 hours ago" },
      { id: "a2", text: "1 document failed: Scanned_Letter.pdf has no text layer.", by: "System", when: "2 hours ago" },
      { id: "a3", text: "ZIP package unpacked into 11 files.", by: "System", when: "3 hours ago" },
      { id: "a4", text: "Uploaded 3 documents.", by: "Priya Sharma", when: "3 hours ago" },
      { id: "a5", text: "Case created.", by: "Priya Sharma", when: "3 hours ago" },
    ],
  },
  "case-2": {
    ...emptyDetail,
    dates: [{ label: "Bid submission", date: "2026-10-30" }],
    activity: [{ id: "a1", text: "Case created.", by: "Rahul Verma", when: "Yesterday" }],
  },
  "case-3": {
    ...emptyDetail,
    dates: [{ label: "Bid submission", date: "2026-10-21" }],
    activity: [
      { id: "a1", text: "6 of 9 documents processed.", by: "System", when: "35 minutes ago" },
      { id: "a2", text: "Uploaded 9 documents.", by: "Priya Sharma", when: "1 hour ago" },
      { id: "a3", text: "Case created.", by: "Priya Sharma", when: "1 hour ago" },
    ],
  },
  "case-4": {
    fieldsTotal: 24,
    fieldsReviewed: 24,
    fieldsFlagged: 0,
    sectionsTotal: 6,
    sectionsComplete: 4,
    openIssues: 2,
    exportsCount: 1,
    lots: [
      { number: "1", title: "Server hardware", value: "EUR 310,000" },
      { number: "2", title: "Migration services", value: "EUR 95,000" },
    ],
    dates: [
      { label: "Clarification questions", date: "2026-10-28" },
      { label: "Bid submission", date: "2026-11-12" },
    ],
    activity: [
      { id: "a1", text: "Draft DOCX exported.", by: "Anita Das", when: "3 days ago" },
      { id: "a2", text: "4 of 6 proposal sections marked complete.", by: "Anita Das", when: "3 days ago" },
      { id: "a3", text: "Corrections committed. Case moved to Proposal draft.", by: "Anita Das", when: "5 days ago" },
    ],
  },
  "case-5": {
    fieldsTotal: 19,
    fieldsReviewed: 19,
    fieldsFlagged: 0,
    sectionsTotal: 5,
    sectionsComplete: 5,
    openIssues: 0,
    exportsCount: 2,
    lots: [
      { number: "1", title: "Classroom devices", value: "EUR 540,000" },
      { number: "2", title: "Network and Wi-Fi", value: "EUR 220,000" },
      { number: "3", title: "Teacher training", value: "EUR 60,000" },
    ],
    dates: [{ label: "Bid submission", date: "2026-11-28" }],
    activity: [
      { id: "a1", text: "Proposal approved.", by: "Anita Das", when: "1 week ago" },
      { id: "a2", text: "All sections complete, no open issues.", by: "Anita Das", when: "1 week ago" },
    ],
  },
  "case-6": {
    fieldsTotal: 31,
    fieldsReviewed: 31,
    fieldsFlagged: 0,
    sectionsTotal: 7,
    sectionsComplete: 7,
    openIssues: 0,
    exportsCount: 4,
    lots: [
      { number: "1", title: "Ticketing backend", value: "EUR 1,200,000" },
      { number: "2", title: "Validators and gates", value: "EUR 880,000" },
    ],
    dates: [{ label: "Bid submission", date: "2026-09-18" }],
    activity: [
      { id: "a1", text: "Case marked completed. Bid submitted.", by: "Rahul Verma", when: "3 weeks ago" },
      { id: "a2", text: "Final DOCX and XLSX exported.", by: "Rahul Verma", when: "3 weeks ago" },
    ],
  },
  "case-7": {
    ...emptyDetail,
    dates: [{ label: "Bid submission", date: "2026-10-12" }],
    activity: [
      { id: "a1", text: "2 documents failed to process.", by: "System", when: "10 minutes ago" },
      { id: "a2", text: "Uploaded 5 documents.", by: "Rahul Verma", when: "30 minutes ago" },
    ],
  },
  "case-8": {
    ...emptyDetail,
    dates: [{ label: "Bid submission", date: "2026-12-15" }],
    activity: [
      { id: "a1", text: "Uploaded 3 documents. Waiting in the queue.", by: "Priya Sharma", when: "Today" },
      { id: "a2", text: "Case created.", by: "Priya Sharma", when: "Today" },
    ],
  },
};