"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import {
  CASE_STAGES,
  daysUntil,
  formatDeadline,
  mockCases,
  type CaseStatus,
} from "@/lib/mock/cases";
import { emptyDetail, mockCaseDetails } from "@/lib/mock/case-detail";

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

const FileIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const ListCheckIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 12.5l3 3 5-6" />
  </svg>
);

const ProposalIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7M8.5 17h5" />
  </svg>
);

const DownloadIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4" />
    <path d="M5 19h14" />
  </svg>
);

const ArrowRightIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ArrowLeftIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M19 12H5m0 0l6-6m-6 6l6 6" />
  </svg>
);

const CalendarIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
);

const PencilIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

const CloseIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/* ---------------------------- Helpers ----------------------------- */

const STAGE_STYLES: Record<
  CaseStatus,
  { label: string; badge: string; dot: string }
> = {
  new: {
    label: "New",
    badge: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
    dot: "bg-slate-400",
  },
  analysis: {
    label: "Analysis",
    badge: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    dot: "bg-blue-400",
  },
  review_required: {
    label: "Review required",
    badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    dot: "bg-amber-400",
  },
  proposal_draft: {
    label: "Proposal draft",
    badge: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    dot: "bg-violet-400",
  },
  approved: {
    label: "Approved",
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    dot: "bg-emerald-400",
  },
  completed: {
    label: "Completed",
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    dot: "bg-sky-400",
  },
};

function chipFor(iso: string) {
  const d = daysUntil(iso);
  if (d < 0)
    return { text: `${-d} day${-d !== 1 ? "s" : ""} ago`, cls: "bg-white/5 text-slate-500 ring-white/10" };
  if (d === 0) return { text: "Today", cls: "bg-red-400/10 text-red-300 ring-red-400/20" };
  if (d <= 7)
    return { text: `in ${d} day${d !== 1 ? "s" : ""}`, cls: "bg-amber-400/10 text-amber-300 ring-amber-400/20" };
  return { text: `in ${d} days`, cls: "bg-white/5 text-slate-400 ring-white/10" };
}

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-40";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-400/10";

const panel =
  "overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/10";

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
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
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct === 100
            ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
            : "bg-gradient-to-r from-blue-500 to-cyan-300"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [overrides, setOverrides] = useState<{
    title?: string;
    reference?: string;
    deadline?: string | null;
  }>({});
  const [editing, setEditing] = useState(false);
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

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  /* ---------- Loading / error ---------- */

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <p className="text-sm text-red-300">{error || "Unable to load user"}</p>
        </div>
      </main>
    );
  }

  const found = mockCases.find((c) => c.id === caseId);
  const detail = mockCaseDetails[caseId] ?? emptyDetail;
  const canEdit = user.role === "editor" || user.role === "admin";

  /* ---------- Not found ---------- */

  if (!found) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen">
          <Sidebar active="Cases" user={user} onSignOut={signOut} />
          <section className="flex min-w-0 flex-1 items-center justify-center px-6">
            <div className="max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 text-center shadow-2xl shadow-black/40">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <FileIcon />
              </span>
              <h1 className="mt-5 text-xl font-semibold tracking-tight">Case not found</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                There is no case with the id &ldquo;{caseId}&rdquo;. It may have
                been removed, or you may not have access to it.
              </p>
              <Link href="/dashboard/cases" className={`${btnPrimary} mt-6`}>
                Back to all cases
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const c = { ...found, ...overrides };
  const st = STAGE_STYLES[c.status];
  const stageIndex = CASE_STAGES.indexOf(c.status);
  const active = c.status !== "approved" && c.status !== "completed";
  const mainChip = c.deadline && active ? chipFor(c.deadline) : null;

  const docPct = c.docsTotal ? Math.round((c.docsProcessed / c.docsTotal) * 100) : 0;
  const fieldPct = detail.fieldsTotal
    ? Math.round((detail.fieldsReviewed / detail.fieldsTotal) * 100)
    : 0;
  const secPct = detail.sectionsTotal
    ? Math.round((detail.sectionsComplete / detail.sectionsTotal) * 100)
    : 0;

  // What should happen next for this case
  const next = (() => {
    switch (c.status) {
      case "new":
        return c.docsTotal === 0
          ? { text: "Upload the tender documents to start the analysis.", label: "Upload documents", href: "/dashboard/documents" }
          : { text: "Documents are queued. Analysis starts when processing finishes.", label: "View documents", href: "/dashboard/documents" };
      case "analysis":
        return c.docsFailed > 0
          ? { text: `${c.docsFailed} document${c.docsFailed !== 1 ? "s" : ""} failed. Check the error and retry.`, label: "Fix failed documents", href: "/dashboard/documents" }
          : { text: "Documents are being processed. Extraction follows automatically.", label: "View progress", href: "/dashboard/documents" };
      case "review_required":
        return { text: "Extraction is done. Check each value against the source and commit.", label: "Start review", href: "/dashboard/review" };
      case "proposal_draft":
        return { text: "Write the proposal sections and resolve open issues, then approve.", label: "Open workspace", href: "/dashboard/proposal" };
      case "approved":
        return { text: "The proposal is approved. Export the Word and Excel files.", label: "Export files", href: "/dashboard/export" };
      default:
        return { text: "This case is completed. You can still download past exports.", label: "View exports", href: "/dashboard/export" };
    }
  })();

  const titleError = touched && title.trim() === "";

  function startEdit() {
    setTitle(c.title);
    setReference(c.reference);
    setDeadline(c.deadline ?? "");
    setTouched(false);
    setEditing(true);
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (title.trim() === "") return;
    // STATIC DESIGN: no API yet
    setOverrides({
      title: title.trim(),
      reference: reference.trim(),
      deadline: deadline || null,
    });
    setEditing(false);
    setNotice("Case details updated.");
  }

  const tiles = [
    {
      key: "documents",
      title: "Documents",
      Icon: FileIcon,
      href: "/dashboard/documents",
      iconWrap: "bg-blue-400/10 text-blue-400 ring-blue-400/20",
      started: c.docsTotal > 0,
      main: `${c.docsProcessed} of ${c.docsTotal} processed`,
      pct: docPct,
      chip:
        c.docsFailed > 0
          ? { text: `${c.docsFailed} failed`, cls: "bg-red-400/10 text-red-300 ring-red-400/20" }
          : null,
      empty: "No documents yet",
    },
    {
      key: "data",
      title: "Extracted data",
      Icon: ListCheckIcon,
      href: "/dashboard/review",
      iconWrap: "bg-violet-400/10 text-violet-400 ring-violet-400/20",
      started: detail.fieldsTotal > 0,
      main: `${detail.fieldsReviewed} of ${detail.fieldsTotal} reviewed`,
      pct: fieldPct,
      chip:
        detail.fieldsFlagged > 0
          ? { text: `${detail.fieldsFlagged} flagged`, cls: "bg-amber-400/10 text-amber-300 ring-amber-400/20" }
          : null,
      empty: "Not extracted yet",
    },
    {
      key: "proposal",
      title: "Proposal",
      Icon: ProposalIcon,
      href: "/dashboard/proposal",
      iconWrap: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
      started: detail.sectionsTotal > 0,
      main: `${detail.sectionsComplete} of ${detail.sectionsTotal} sections complete`,
      pct: secPct,
      chip:
        detail.openIssues > 0
          ? { text: `${detail.openIssues} open issue${detail.openIssues !== 1 ? "s" : ""}`, cls: "bg-amber-400/10 text-amber-300 ring-amber-400/20" }
          : null,
      empty: "Not started yet",
    },
    {
      key: "export",
      title: "Exports",
      Icon: DownloadIcon,
      href: "/dashboard/export",
      iconWrap: "bg-sky-400/10 text-sky-400 ring-sky-400/20",
      started: detail.exportsCount > 0,
      main: `${detail.exportsCount} file${detail.exportsCount !== 1 ? "s" : ""} exported`,
      pct: null as number | null,
      chip: null,
      empty: "Nothing exported yet",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      <AmbientBackground />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar active="Cases" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Case Details
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs capitalize text-slate-500">{user.role}</p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-semibold shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
                {user.email.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
            <Link
              href="/dashboard/cases"
              className="group inline-flex items-center gap-2 rounded-lg text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
            >
              <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              All cases
            </Link>

            {/* Title + next step */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">{c.title}</h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${st.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {c.reference} · {c.owner} · Updated {c.updated}
                  </p>

                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <CalendarIcon className="h-4 w-4 text-slate-600" />
                    {c.deadline
                      ? `Submission deadline ${formatDeadline(c.deadline)}`
                      : "No deadline set"}
                    {mainChip && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${mainChip.cls}`}
                      >
                        {mainChip.text}
                      </span>
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.06] p-5 lg:max-w-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                    Next step
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{next.text}</p>
                  <Link href={next.href} className={`${btnPrimary} mt-4 w-full`}>
                    {next.label}
                    <ArrowRightIcon />
                  </Link>
                </div>
              </div>

              {/* Lifecycle */}
              <ol className="mt-6 flex gap-2 overflow-x-auto" aria-label="Case lifecycle">
                {CASE_STAGES.map((s, i) => {
                  const done = i < stageIndex;
                  const current = i === stageIndex;
                  return (
                    <li
                      key={s}
                      aria-current={current ? "step" : undefined}
                      className={`flex min-w-[130px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${
                        current
                          ? "border-blue-400/40 bg-blue-500/10 text-blue-200"
                          : done
                          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
                          : "border-white/10 bg-white/[0.02] text-slate-500"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums ${
                          current
                            ? "bg-blue-400 text-blue-950"
                            : done
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {done ? <CheckIcon className="h-3 w-3" /> : i + 1}
                      </span>
                      {STAGE_STYLES[s].label}
                    </li>
                  );
                })}
              </ol>
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
                  <CloseIcon />
                </button>
              </div>
            )}

            {/* Progress tiles */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-300">{t.title}</p>
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${t.iconWrap}`}
                    >
                      <t.Icon className="h-5 w-5" />
                    </span>
                  </div>

                  {t.started ? (
                    <>
                      <p className="mt-4 text-sm font-medium text-slate-100">{t.main}</p>
                      {t.pct !== null && <ProgressBar pct={t.pct} />}
                      {t.chip && (
                        <p
                          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${t.chip.cls}`}
                        >
                          <AlertIcon className="h-3 w-3" />
                          {t.chip.text}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">{t.empty}</p>
                  )}

                  <p className="mt-4 flex items-center gap-1 text-xs font-medium text-blue-400 transition group-hover:text-blue-300">
                    Open
                    <ArrowRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
              ))}
            </div>

            {/* Details / dates / lots / activity */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-6">
                {/* Key dates */}
                <div className={panel}>
                  <div className="border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-semibold">Key dates</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Taken from the tender documents.
                    </p>
                  </div>

                  {detail.dates.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">
                      No dates found yet. They appear after extraction.
                    </p>
                  ) : (
                    detail.dates.map((d) => {
                      const chip = active ? chipFor(d.date) : null;
                      return (
                        <div
                          key={d.label}
                          className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4 last:border-b-0"
                        >
                          <p className="text-sm text-slate-200">{d.label}</p>
                          <p className="flex items-center gap-2 text-sm text-slate-400">
                            {formatDeadline(d.date)}
                            {chip && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${chip.cls}`}
                              >
                                {chip.text}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Lots */}
                <div className={panel}>
                  <div className="border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-semibold">Lots</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Lots and bundles found in the tender.
                    </p>
                  </div>

                  {detail.lots.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">
                      No lots found yet. They appear after extraction.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[420px]">
                        <div className="grid grid-cols-[70px_minmax(0,1fr)_150px] gap-4 border-b border-white/10 bg-white/[0.02] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <div>Lot</div>
                          <div>Title</div>
                          <div>Est. value</div>
                        </div>
                        {detail.lots.map((l) => (
                          <div
                            key={l.number}
                            className="grid grid-cols-[70px_minmax(0,1fr)_150px] gap-4 border-b border-white/5 px-5 py-4 text-sm last:border-b-0"
                          >
                            <div className="tabular-nums text-slate-400">{l.number}</div>
                            <div className="text-slate-200">{l.title}</div>
                            <div className="text-slate-400">{l.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* Case details */}
                <div className={panel}>
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-semibold">Case details</h3>
                    {canEdit && !editing && (
                      <button type="button" onClick={startEdit} className={btnGhost}>
                        <PencilIcon />
                        Edit
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <form onSubmit={saveEdit} noValidate className="space-y-4 p-5">
                      <div>
                        <label htmlFor="d-title" className="text-xs font-medium text-slate-400">
                          Title
                        </label>
                        <input
                          id="d-title"
                          autoFocus
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          onBlur={() => setTouched(true)}
                          aria-invalid={titleError}
                          className={`${inputCls} mt-1.5 aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:ring-red-500/10`}
                        />
                        {titleError && (
                          <p className="mt-1.5 text-[11px] text-red-300">
                            Please enter a title for this case.
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="d-ref" className="text-xs font-medium text-slate-400">
                          Reference no.
                        </label>
                        <input
                          id="d-ref"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          className={`${inputCls} mt-1.5`}
                        />
                      </div>

                      <div>
                        <label htmlFor="d-deadline" className="text-xs font-medium text-slate-400">
                          Submission deadline
                        </label>
                        <input
                          id="d-deadline"
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className={`${inputCls} mt-1.5 [color-scheme:dark]`}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setEditing(false)} className={btnGhost}>
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-400 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                        >
                          Save changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <dl className="divide-y divide-white/5 text-sm">
                      {[
                        ["Title", c.title],
                        ["Reference", c.reference || "—"],
                        ["Owner", c.owner],
                        ["Deadline", c.deadline ? formatDeadline(c.deadline) : "Not set"],
                        ["Stage", st.label],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-4 px-5 py-3.5">
                          <dt className="text-slate-500">{k}</dt>
                          <dd className="text-right text-slate-200">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {!canEdit && (
                    <p className="border-t border-white/5 px-5 py-3 text-xs text-slate-500">
                      Only an Editor or Admin can change case details.
                    </p>
                  )}
                </div>

                {/* Activity */}
                <div className={panel}>
                  <div className="border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-semibold">Activity</h3>
                  </div>

                  {detail.activity.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">No activity yet.</p>
                  ) : (
                    <ol className="px-5 py-4">
                      {detail.activity.map((a, i) => (
                        <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                          {i < detail.activity.length - 1 && (
                            <span
                              aria-hidden
                              className="absolute left-[5px] top-4 h-full w-px bg-white/10"
                            />
                          )}
                          <span
                            className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-[#0a0f1c] ${
                              i === 0 ? "bg-blue-400" : "bg-slate-600"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm leading-5 text-slate-200">{a.text}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {a.by} · {a.when}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}