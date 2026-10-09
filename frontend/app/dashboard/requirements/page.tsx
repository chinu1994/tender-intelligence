"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import {
  mockCaseInfo,
  mockFields,
  type ExtractedField,
} from "@/lib/mock/review";

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

const SearchIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const XIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const ArrowRightIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
  </svg>
);

const CalendarIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const LayersIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

const ShieldIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const FileIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const AlertIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v4m0 3h.01" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

type ReqType = "mandatory" | "evaluation" | "evidence";
type Tab = "all" | ReqType;

const TYPE_STYLES: Record<
  ReqType,
  { label: string; badge: string; dot: string }
> = {
  mandatory: {
    label: "Mandatory",
    badge: "bg-red-400/10 text-red-300 ring-red-400/20",
    dot: "bg-red-400",
  },
  evaluation: {
    label: "Evaluation",
    badge: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    dot: "bg-violet-400",
  },
  evidence: {
    label: "Evidence",
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    dot: "bg-sky-400",
  },
};

// Static timeline (days are relative to today in the design)
const DEADLINES = [
  {
    id: "dl1",
    label: "Clarification questions deadline",
    date: "30 Oct 2026",
    left: "in 22 days",
    urgent: true,
  },
  {
    id: "dl2",
    label: "Bid submission deadline",
    date: "14 Nov 2026, 12:00",
    left: "in 37 days",
    urgent: false,
  },
];

const GRID = "grid grid-cols-[130px_minmax(0,1fr)_250px_140px] gap-4";

function requirementType(f: ExtractedField): ReqType | null {
  if (f.category === "evidence") return "evidence";
  if (f.category !== "requirements") return null;
  return f.label.toLowerCase().startsWith("mandatory")
    ? "mandatory"
    : "evaluation";
}

function verification(f: ExtractedField) {
  if (f.status !== "pending")
    return {
      label: "Verified",
      badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
      dot: "bg-emerald-400",
      review: false,
    };
  if (f.flag || f.confidence < 0.85)
    return {
      label: "Needs review",
      badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
      dot: "bg-amber-400",
      review: true,
    };
  return {
    label: "Not reviewed",
    badge: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
    dot: "bg-slate-400",
    review: false,
  };
}

// Mark the search text inside a value
function highlight(text: string, q: string) {
  const term = q.trim();
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1) return text;

  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-blue-400/25 px-0.5 text-blue-100">
        {text.slice(i, i + term.length)}
      </mark>
      {text.slice(i + term.length)}
    </>
  );
}

const statCard =
  "rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 text-left transition-all";

/* ------------------------------ Page ------------------------------ */

export default function RequirementsPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

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

  const rows = useMemo(
    () =>
      mockFields
        .map((f) => ({ field: f, type: requirementType(f) }))
        .filter(
          (r): r is { field: ExtractedField; type: ReqType } =>
            r.type !== null
        ),
    []
  );

  const lots = mockFields.filter((f) => f.category === "lots");

  const count = (t: ReqType) => rows.filter((r) => r.type === t).length;
  const verifiedCount = mockFields.filter((f) => f.status !== "pending").length;
  const needsReview = mockFields.filter(
    (f) => f.status === "pending" && (f.flag || f.confidence < 0.85)
  ).length;
  const rowsNeedReview = rows.filter((r) => verification(r.field).review).length;
  const pct = mockFields.length
    ? Math.round((verifiedCount / mockFields.length) * 100)
    : 0;

  const visible = rows.filter(
    ({ field: f, type }) =>
      (tab === "all" || type === tab) &&
      (!onlyReview || verification(f).review) &&
      `${f.label} ${f.value}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const hasFilters = tab !== "all" || search !== "" || onlyReview;

  function resetFilters() {
    setTab("all");
    setSearch("");
    setOnlyReview(false);
  }

  function focusTab(t: Tab) {
    setTab(t);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
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

  const TABS: [Tab, string, number][] = [
    ["all", "All", rows.length],
    ["mandatory", "Mandatory", count("mandatory")],
    ["evaluation", "Evaluation", count("evaluation")],
    ["evidence", "Evidence", count("evidence")],
  ];

  const STATS = [
    {
      key: "deadlines",
      label: "Deadlines",
      n: DEADLINES.length,
      hint: "Key dates to meet",
      Icon: CalendarIcon,
      iconWrap: "bg-amber-400/10 text-amber-300",
      text: "text-white",
      tab: null,
    },
    {
      key: "lots",
      label: "Lots",
      n: lots.length,
      hint: "Parts of this tender",
      Icon: LayersIcon,
      iconWrap: "bg-blue-400/10 text-blue-400",
      text: "text-blue-400",
      tab: null,
    },
    {
      key: "mandatory",
      label: "Mandatory",
      n: count("mandatory"),
      hint: "Must-have requirements",
      Icon: ShieldIcon,
      iconWrap: "bg-red-400/10 text-red-400",
      text: "text-red-400",
      tab: "mandatory" as Tab,
    },
    {
      key: "evidence",
      label: "Evidence",
      n: count("evidence"),
      hint: "Documents you must provide",
      Icon: FileIcon,
      iconWrap: "bg-sky-400/10 text-sky-400",
      text: "text-sky-400",
      tab: "evidence" as Tab,
    },
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
        <Sidebar active="Requirements" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Requirements
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
            {/* Case bar */}
            <div className="flex flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20 lg:flex-row lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {mockCaseInfo.name}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Review Required
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  <span className="text-slate-500">{mockCaseInfo.id}</span> ·
                  Everything extracted from the tender documents, in one place.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="w-full sm:w-56">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">
                      {verifiedCount} of {mockFields.length} verified
                    </span>
                    <span className="font-semibold tabular-nums text-blue-300">
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
                    <AlertIcon />
                    {needsReview} need review
                  </p>
                </div>

                <Link
                  href="/dashboard/review"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                >
                  Open Review
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((s) => {
                const content = (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400">{s.label}</p>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconWrap}`}
                      >
                        <s.Icon />
                      </span>
                    </div>
                    <p
                      className={`mt-3 text-3xl font-semibold tabular-nums ${s.text}`}
                    >
                      {s.n}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {s.hint}
                      {s.tab && (
                        <span className="text-slate-600"> · click to filter</span>
                      )}
                    </p>
                  </>
                );

                if (!s.tab) {
                  return (
                    <div
                      key={s.key}
                      className={`${statCard} hover:border-white/20`}
                    >
                      {content}
                    </div>
                  );
                }

                const active = tab === s.tab;
                const target = s.tab;

                return (
                  <button
                    type="button"
                    key={s.key}
                    onClick={() => focusTab(active ? "all" : target)}
                    aria-pressed={active}
                    className={`${statCard} hover:-translate-y-0.5 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                      active
                        ? "border-blue-400/50 ring-2 ring-blue-400/30"
                        : "hover:border-white/20"
                    }`}
                  >
                    {content}
                  </button>
                );
              })}
            </div>

            {/* Deadlines + Lots */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Deadlines timeline */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Deadlines</h3>
                  <span className="text-xs text-slate-500">
                    {DEADLINES.length} upcoming
                  </span>
                </div>

                <ol className="relative mt-5 space-y-5">
                  <span
                    aria-hidden
                    className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-amber-400/50 via-blue-400/30 to-transparent"
                  />

                  {DEADLINES.map((d) => (
                    <li key={d.id} className="relative flex items-start gap-4">
                      <span
                        className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-[#0b1220] ${
                          d.urgent ? "bg-amber-400" : "bg-blue-400"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{d.label}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {d.date}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                          d.urgent
                            ? "bg-amber-400/10 text-amber-300 ring-amber-400/20"
                            : "bg-white/5 text-slate-300 ring-white/10"
                        }`}
                      >
                        {d.left}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Lots */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Lots / Bundles</h3>
                  <span className="text-xs text-slate-500">
                    {lots.length} total
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {lots.length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                      No lots found in this tender.
                    </p>
                  )}

                  {lots.map((l, i) => (
                    <div
                      key={l.id}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-semibold text-blue-300 ring-1 ring-inset ring-blue-400/20">
                        {i + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                          {l.label}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-6">
                          {l.value}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                          <span className="truncate">
                            {l.citation.documentName}
                          </span>
                          <span className="shrink-0 text-slate-600">
                            · p.{l.citation.page}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Requirements table */}
            <div
              ref={tableRef}
              className="mt-6 scroll-mt-28 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-6 py-4 xl:flex-row xl:items-center">
                <h3 className="text-base font-semibold">
                  Requirements &amp; evidence
                </h3>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  {/* Segmented type filter */}
                  <div
                    role="tablist"
                    aria-label="Filter by type"
                    className="flex overflow-x-auto rounded-xl border border-white/10 bg-[#0d1424] p-1"
                  >
                    {TABS.map(([key, label, n]) => {
                      const active = tab === key;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          key={key}
                          onClick={() => setTab(key)}
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

                  {/* Needs review toggle */}
                  <button
                    type="button"
                    onClick={() => setOnlyReview((v) => !v)}
                    aria-pressed={onlyReview}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 ${
                      onlyReview
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                        : "border-white/10 bg-[#0d1424] text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                  >
                    <AlertIcon />
                    Needs review
                    <span className="rounded-md bg-white/10 px-1.5 text-[10px] tabular-nums">
                      {rowsNeedReview}
                    </span>
                  </button>

                  {/* Search */}
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search requirements..."
                      aria-label="Search requirements"
                      className="w-full rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-9 pr-8 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 lg:w-60"
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[860px]">
                  <div
                    className={`${GRID} border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500`}
                  >
                    <div>Type</div>
                    <div>Requirement</div>
                    <div>Source</div>
                    <div>Status</div>
                  </div>

                  {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                        <SearchIcon className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium text-slate-300">
                        No requirements found
                      </p>
                      <p className="text-xs text-slate-500">
                        Try a different search or reset the filters.
                      </p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.05]"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    visible.map(({ field: f, type }) => {
                      const v = verification(f);
                      const t = TYPE_STYLES[type];

                      return (
                        <div
                          key={f.id}
                          className={`${GRID} items-center border-b border-white/5 px-6 py-5 transition-colors last:border-b-0 hover:bg-white/[0.03]`}
                        >
                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${t.badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${t.dot}`}
                              />
                              {t.label}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-6 text-slate-100">
                              {highlight(f.value, search)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {f.label}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs text-slate-300">
                              <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                              <span
                                className="truncate"
                                title={f.citation.documentName}
                              >
                                {f.citation.documentName}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Page {f.citation.page}
                              <span className="mx-1.5 text-slate-700">•</span>
                              Paragraph {f.citation.paragraph}
                            </p>
                          </div>

                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${v.badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${v.dot}`}
                              />
                              {v.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-6 py-3 text-xs text-slate-500">
                <span>
                  Showing{" "}
                  <span className="font-medium text-slate-300">
                    {visible.length}
                  </span>{" "}
                  of {rows.length} items
                </span>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-blue-400 transition hover:text-blue-300"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}