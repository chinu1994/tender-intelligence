"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { createCase as createCaseRequest, getCases, getDashboardSummary } from "@/lib/api";
import {
  CASE_STAGES,
  daysUntil,
  formatDeadline,
  type CaseItem,
  type CaseStatus,
} from "@/lib/cases";

/* ----------------------------- Icons ----------------------------- */

type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

const CheckIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} strokeWidth={2.6} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const CheckCircleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const AlertIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v4m0 3h.01" />
  </svg>
);

const FileIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const PlusIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SearchIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const CalendarIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
);

const ArrowRightIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const CloseIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/* ---------------------------- Helpers ----------------------------- */

type Filter = "all" | CaseStatus;

const STAGE_STYLES: Record<
  CaseStatus,
  { label: string; badge: string; dot: string; bar: string }
> = {
  new: {
    label: "New",
    badge: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
  },
  analysis: {
    label: "Analysis",
    badge: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    dot: "bg-blue-400",
    bar: "bg-blue-400",
  },
  review_required: {
    label: "Review required",
    badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  proposal_draft: {
    label: "Proposal draft",
    badge: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    dot: "bg-violet-400",
    bar: "bg-violet-400",
  },
  approved: {
    label: "Approved",
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  completed: {
    label: "Completed",
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    dot: "bg-sky-400",
    bar: "bg-sky-400",
  },
};

// Primary next step for each stage.
function nextAction(c: CaseItem): { label: string; href: string; primary: boolean } {
  switch (c.status) {
    case "new":
      return { label: "Upload documents", href: `/dashboard/cases/${c.id}`, primary: false };
    case "analysis":
      return { label: "View progress", href: `/dashboard/cases/${c.id}`, primary: false };
    case "review_required":
      return { label: "Start review", href: "/dashboard/review", primary: true };
    case "proposal_draft":
      return { label: "Open workspace", href: "/dashboard/proposal", primary: true };
    case "approved":
      return { label: "Export", href: "/dashboard/export", primary: true };
    default:
      return { label: "View case", href: `/dashboard/cases/${c.id}`, primary: false };
  }
}

function isActive(c: CaseItem) {
  return c.status !== "approved" && c.status !== "completed";
}

function deadlineChip(c: CaseItem) {
  if (!c.deadline || !isActive(c)) return null;
  const d = daysUntil(c.deadline);
  if (d < 0)
    return { text: `Overdue by ${-d} day${-d !== 1 ? "s" : ""}`, cls: "bg-red-400/10 text-red-300 ring-red-400/20" };
  if (d === 0) return { text: "Due today", cls: "bg-red-400/10 text-red-300 ring-red-400/20" };
  if (d <= 7)
    return { text: `in ${d} day${d !== 1 ? "s" : ""}`, cls: "bg-amber-400/10 text-amber-300 ring-amber-400/20" };
  return { text: `in ${d} days`, cls: "bg-white/5 text-slate-400 ring-white/10" };
}

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-40";

const btnPrimarySm =
  "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-400 to-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-400/10";

/* ------------------------------ Page ------------------------------ */

export default function CasesPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [deadline, setDeadline] = useState("");
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const result = await getDashboardSummary();
        setUser(result.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load user");
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    async function loadCases() {
      try {
        setCases(await getCases());
      } catch (err) {
        setCasesError(err instanceof Error ? err.message : "Unable to load cases");
      } finally {
        setCasesLoading(false);
      }
    }
    loadCases();
  }, []);

  async function retryLoadCases() {
    setCasesLoading(true);
    setCasesError("");
    try {
      setCases(await getCases());
    } catch (err) {
      setCasesError(err instanceof Error ? err.message : "Unable to load cases");
    } finally {
      setCasesLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-1/2 -right-40 h-[360px] w-[360px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at top, black 20%, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at top, black 20%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-1/2 -right-40 h-[360px] w-[360px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at top, black 20%, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at top, black 20%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <p className="text-sm text-red-300">{error || "Unable to load user"}</p>
        </div>
      </main>
    );
  }

  const canCreate = user.role === "editor" || user.role === "admin";

  const total = cases.length;
  const needReview = cases.filter((c) => c.status === "review_required").length;
  const dueSoon = cases.filter(
    (c) => isActive(c) && c.deadline && daysUntil(c.deadline) <= 7
  ).length;
  const failedDocs = cases.reduce((n, c) => n + c.docsFailed, 0);

  const countOf = (s: CaseStatus) => cases.filter((c) => c.status === s).length;

  const q = query.trim().toLowerCase();
  const visible = cases.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.reference.toLowerCase().includes(q) ||
      c.owner.toLowerCase().includes(q)
    );
  });

  const titleError = touched && title.trim() === "";

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (title.trim() === "" || submitting) return;

    setSubmitting(true);
    setFormError("");

    try {
      const created = await createCaseRequest({
        title: title.trim(),
        reference: reference.trim(),
        deadline,
      });

      setCases((cur) => [created, ...cur]);
      setFilter("all");
      setQuery("");
      setNotice(`Case "${created.title}" created. Open it to upload the tender documents.`);
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to create case");
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setTitle("");
    setReference("");
    setDeadline("");
    setTouched(false);
    setFormError("");
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  const TABS: [Filter, string, number][] = [
    ["all", "All cases", total],
    ...CASE_STAGES.map((s): [Filter, string, number] => [
      s,
      STAGE_STYLES[s].label,
      countOf(s),
    ]),
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 h-[360px] w-[360px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at top, black 20%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <Sidebar active="Cases" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Tender Cases
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs capitalize text-slate-500">
                  {user.role}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-semibold shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
                {user.email.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
            {/* Overview */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight">
                    All tender cases
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    Every tender moves through six stages. Open a case to upload
                    documents, check processing, review extracted data and
                    prepare the proposal.
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] text-slate-500">Total cases</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">
                      {total}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Need review</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-300">
                      {needReview}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Due in 7 days</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-red-300">
                      {dueSoon}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Failed documents</dt>
                    <dd
                      className={`mt-1 text-lg font-semibold tabular-nums ${
                        failedDocs ? "text-red-300" : "text-slate-300"
                      }`}
                    >
                      {failedDocs}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Pipeline */}
              <div className="mt-6">
                <div
                  className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/10"
                  role="img"
                  aria-label="Cases by stage"
                >
                  {CASE_STAGES.map((s) => {
                    const n = countOf(s);
                    if (n === 0) return null;
                    return (
                      <div
                        key={s}
                        className={`h-full ${STAGE_STYLES[s].bar} transition-all duration-500`}
                        style={{ width: `${(n / total) * 100}%` }}
                      />
                    );
                  })}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-400">
                  {CASE_STAGES.map((s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${STAGE_STYLES[s].dot}`} />
                      {STAGE_STYLES[s].label}
                      <span className="tabular-nums text-slate-500">
                        {countOf(s)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {notice && (
              <div
                role="status"
                className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              >
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="flex-1">{notice}</p>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setNotice("")}
                  className="text-emerald-300/70 transition hover:text-emerald-200"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* New case form */}
            {showForm && (
              <form
                onSubmit={createCase}
                noValidate
                className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/[0.04] p-5 shadow-xl shadow-black/10"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Create a tender case</h3>
                  <button
                    type="button"
                    aria-label="Close form"
                    onClick={closeForm}
                    className="text-slate-500 transition hover:text-slate-300"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
                  <div>
                    <label htmlFor="case-title" className="text-xs font-medium text-slate-400">
                      Title
                    </label>
                    <input
                      id="case-title"
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => setTouched(true)}
                      aria-invalid={titleError}
                      placeholder="e.g. Municipal IT Infrastructure Refresh"
                      className={`${inputCls} mt-1.5 aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:ring-red-500/10`}
                    />
                    {titleError && (
                      <p className="mt-1.5 text-[11px] text-red-300">
                        Please enter a title for this case.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="case-ref" className="text-xs font-medium text-slate-400">
                      Reference no. <span className="text-slate-600">(optional)</span>
                    </label>
                    <input
                      id="case-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Auto-generated"
                      className={`${inputCls} mt-1.5`}
                    />
                  </div>

                  <div>
                    <label htmlFor="case-deadline" className="text-xs font-medium text-slate-400">
                      Submission deadline <span className="text-slate-600">(optional)</span>
                    </label>
                    <input
                      id="case-deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className={`${inputCls} mt-1.5 [color-scheme:dark]`}
                    />
                  </div>
                </div>

                {formError && (
                  <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {formError}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={closeForm} className={btnGhost}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-400 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Creating..." : "Create case"}
                  </button>
                </div>
              </form>
            )}

            {/* Tabs + search + new */}
            <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div
                role="tablist"
                aria-label="Filter by stage"
                className="flex max-w-full overflow-x-auto rounded-xl border border-white/10 bg-[#0d1424] p-1"
              >
                {TABS.map(([key, label, n]) => {
                  const active = filter === key;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded-md px-1.5 text-[10px] tabular-nums ${
                          active
                            ? "bg-white/10 text-slate-200"
                            : "bg-white/5 text-slate-500"
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1 xl:w-72 xl:flex-none">
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <label htmlFor="case-search" className="sr-only">
                    Search cases
                  </label>
                  <input
                    id="case-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title, reference or owner"
                    className={`${inputCls} pl-10`}
                  />
                </div>

                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setShowForm((v) => !v)}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                  >
                    <PlusIcon />
                    New case
                  </button>
                )}
              </div>
            </div>

            {/* Case list */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/10">
              {casesLoading ? (
                <div className="px-6 py-16 text-center text-sm text-slate-400">
                  Loading cases...
                </div>
              ) : casesError ? (
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <p role="alert" className="text-sm text-red-300">
                    {casesError}
                  </p>
                  <button type="button" onClick={retryLoadCases} className={btnGhost}>
                    Try again
                  </button>
                </div>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                    <FileIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-slate-300">
                    {cases.length === 0 ? "No cases yet" : "No cases match"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cases.length === 0
                      ? "Create your first tender case to get started."
                      : "Try another stage or clear the search."}
                  </p>
                  {(filter !== "all" || query) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                      }}
                      className={`${btnGhost} mt-2`}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                visible.map((c) => {
                  const st = STAGE_STYLES[c.status];
                  const chip = deadlineChip(c);
                  const action = nextAction(c);
                  const pct = c.docsTotal
                    ? Math.round((c.docsProcessed / c.docsTotal) * 100)
                    : 0;

                  return (
                    <div
                      key={c.id}
                      className="flex flex-col gap-4 border-b border-white/5 p-5 transition last:border-b-0 hover:bg-white/[0.03] lg:flex-row lg:items-center"
                    >
                      {/* Title + deadline */}
                      <div className="min-w-0 lg:flex-[1.6]">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link
                            href={`/dashboard/cases/${c.id}`}
                            className="truncate text-sm font-semibold text-slate-100 transition hover:text-blue-300 focus-visible:outline-none focus-visible:text-blue-300"
                          >
                            {c.title}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {c.reference} · {c.owner} · Updated {c.updated}
                        </p>

                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <CalendarIcon className="h-3.5 w-3.5 text-slate-600" />
                          {c.deadline
                            ? `Deadline ${formatDeadline(c.deadline)}`
                            : "No deadline set"}
                          {chip && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${chip.cls}`}
                            >
                              {chip.text}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Documents */}
                      <div className="lg:w-56 lg:shrink-0">
                        {c.docsTotal === 0 ? (
                          <p className="flex items-center gap-1.5 text-xs text-slate-500">
                            <FileIcon className="h-3.5 w-3.5 text-slate-600" />
                            No documents yet
                          </p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <FileIcon className="h-3.5 w-3.5 text-slate-600" />
                                {c.docsProcessed} of {c.docsTotal} processed
                              </span>
                              <span className="tabular-nums text-slate-500">{pct}%</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pct === 100
                                    ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                                    : "bg-gradient-to-r from-blue-500 to-cyan-300"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {c.docsFailed > 0 && (
                              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-inset ring-red-400/20">
                                <AlertIcon className="h-3 w-3" />
                                {c.docsFailed} failed
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-2 lg:w-60 lg:justify-end">
                        <Link
                          href={action.href}
                          className={action.primary ? btnPrimarySm : btnGhost}
                        >
                          {action.label}
                          <ArrowRightIcon />
                        </Link>
                        {action.primary && (
                          <Link href={`/dashboard/cases/${c.id}`} className={btnGhost}>
                            Open
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-600">
              <CheckIcon className="h-3 w-3" />
              {casesLoading ? "Loading cases..." : `Showing ${visible.length} of ${total} cases`}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}