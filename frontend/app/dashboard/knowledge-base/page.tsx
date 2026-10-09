"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import {
  mockRecords,
  type IndexStatus,
  type Outcome,
} from "@/lib/mock/knowledge-base";

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

const PlusIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const XIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const UploadIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 16V4m0 0L7 9m5-5l5 5" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
);

const ChevronIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const RetryIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 12a9 9 0 0115.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 01-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

const AlertIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5m0 3h.01" />
  </svg>
);

const ClockIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const CheckCircleIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const SpinnerIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={`animate-spin ${className}`}>
    <path d="M21 12a9 9 0 11-6.2-8.55" />
  </svg>
);

const DatabaseIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);

const TrophyIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
    <path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" />
  </svg>
);

const LayersIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

const FileIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

const OUTCOME_STYLES: Record<
  Outcome,
  { badge: string; dot: string; label: string; selected: string }
> = {
  won: {
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    dot: "bg-emerald-400",
    label: "Won",
    selected: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
  },
  lost: {
    badge: "bg-red-400/10 text-red-300 ring-red-400/20",
    dot: "bg-red-400",
    label: "Lost",
    selected: "border-red-400/50 bg-red-400/10 text-red-200",
  },
  completed: {
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    dot: "bg-sky-400",
    label: "Completed",
    selected: "border-sky-400/50 bg-sky-400/10 text-sky-200",
  },
};

const INDEX_STYLES: Record<
  IndexStatus,
  { label: string; text: string; Icon: (p: IconProps) => React.ReactElement }
> = {
  indexed: { label: "Indexed", text: "text-emerald-400", Icon: CheckCircleIcon },
  indexing: { label: "Indexing…", text: "text-blue-400", Icon: SpinnerIcon },
  pending: { label: "Pending", text: "text-slate-400", Icon: ClockIcon },
  failed: { label: "Failed", text: "text-red-400", Icon: AlertIcon },
};

const OUTCOME_TABS = ["all", "won", "lost", "completed"] as const;

const ACCEPTED_EXT = [".pdf", ".docx", ".xlsx", ".zip"];

const GRID =
  "grid grid-cols-[minmax(0,1fr)_130px_110px_90px_230px] items-center gap-4";

type SortKey = "newest" | "oldest" | "title";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10";

/* ------------------------------ Page ------------------------------ */

export default function KnowledgeBasePage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | Outcome>("all");
  const [indexFilter, setIndexFilter] = useState<"all" | IndexStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [year, setYear] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("won");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [touched, setTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const stats = useMemo(() => {
    const won = mockRecords.filter((r) => r.outcome === "won").length;
    const lost = mockRecords.filter((r) => r.outcome === "lost").length;
    const chunks = mockRecords.reduce((sum, r) => sum + r.chunks, 0);
    const failed = mockRecords.filter((r) => r.indexStatus === "failed").length;
    const winRate =
      won + lost === 0 ? 0 : Math.round((won / (won + lost)) * 100);

    return { total: mockRecords.length, won, winRate, chunks, failed };
  }, []);

  const outcomeCounts = useMemo(() => {
    const c: Record<"all" | Outcome, number> = {
      all: mockRecords.length,
      won: 0,
      lost: 0,
      completed: 0,
    };
    mockRecords.forEach((r) => {
      c[r.outcome] += 1;
    });
    return c;
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = mockRecords.filter((r) => {
      const matches =
        r.title.toLowerCase().includes(q) || r.client.toLowerCase().includes(q);

      return (
        matches &&
        (outcomeFilter === "all" || r.outcome === outcomeFilter) &&
        (indexFilter === "all" || r.indexStatus === indexFilter)
      );
    });

    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const diff = Number(a.year) - Number(b.year);
      return sort === "newest" ? -diff : diff;
    });
  }, [search, outcomeFilter, indexFilter, sort]);

  const hasFilters =
    search !== "" || outcomeFilter !== "all" || indexFilter !== "all";

  function resetFilters() {
    setSearch("");
    setOutcomeFilter("all");
    setIndexFilter("all");
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  /* ----- Modal helpers ----- */

  function closeModal() {
    setShowModal(false);
    setTitle("");
    setClient("");
    setYear("");
    setOutcome("won");
    setFiles([]);
    setFileError("");
    setTouched(false);
    setIsDragging(false);
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;

    const incoming = Array.from(list);
    const valid = incoming.filter((f) =>
      ACCEPTED_EXT.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const skipped = incoming.length - valid.length;

    setFileError(
      skipped > 0
        ? `${skipped} unsupported file${skipped > 1 ? "s were" : " was"} skipped.`
        : ""
    );
    setFiles((prev) => [...prev, ...valid]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!title.trim()) return;
    // STATIC DESIGN: no API yet
    closeModal();
  }

  // Esc to close + lock body scroll while modal is open
  useEffect(() => {
    if (!showModal) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showModal]);

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

  const titleInvalid = touched && !title.trim();

  /* ------------------------------ UI ------------------------------ */

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
        <Sidebar
          active="Knowledge Base"
          user={user}
          onSignOut={signOut}
        />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Knowledge Base
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

          {/* Content */}
          <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
            {/* Intro + actions */}
            <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold tracking-tight">
                  Historical tenders
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Past tenders and submitted bids used to suggest answers for
                  new proposals. Only your organisation can see these.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard/knowledge-base/search"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                >
                  <SearchIcon />
                  Search similar
                </Link>

                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                >
                  <PlusIcon />
                  Add historical tender
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-white/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Historical tenders</p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-400/10 text-slate-300">
                    <DatabaseIcon className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {stats.total}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Stored in your knowledge base
                </p>
              </div>

              {/* Won + win rate */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-white/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Bids won</p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                    <TrophyIcon className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold tabular-nums text-emerald-400">
                    {stats.won}
                  </p>
                  <p className="text-xs font-medium text-emerald-300/80">
                    {stats.winRate}% win rate
                  </p>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
                    style={{ width: `${stats.winRate}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">won vs lost</p>
              </div>

              {/* Passages */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-white/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Searchable passages</p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-400">
                    <LayersIcon className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-blue-400">
                  {stats.chunks.toLocaleString()}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Indexed text chunks
                </p>
              </div>

              {/* Needs attention (clickable) */}
              <button
                type="button"
                onClick={() =>
                  setIndexFilter(indexFilter === "failed" ? "all" : "failed")
                }
                aria-pressed={indexFilter === "failed"}
                disabled={stats.failed === 0}
                className={`rounded-2xl border bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 enabled:hover:-translate-y-0.5 ${
                  indexFilter === "failed"
                    ? "border-red-400/50 ring-2 ring-red-400/30"
                    : "border-white/10 enabled:hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Needs attention</p>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      stats.failed > 0
                        ? "bg-red-400/10 text-red-400"
                        : "bg-emerald-400/10 text-emerald-400"
                    }`}
                  >
                    {stats.failed > 0 ? (
                      <AlertIcon className="h-[18px] w-[18px]" />
                    ) : (
                      <CheckCircleIcon className="h-[18px] w-[18px]" />
                    )}
                  </span>
                </div>
                <p
                  className={`mt-3 text-3xl font-semibold tabular-nums ${
                    stats.failed > 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {stats.failed}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {stats.failed === 0
                    ? "Everything is indexed"
                    : indexFilter === "failed"
                    ? "Click to clear filter"
                    : "Click to show failed records"}
                </p>
              </button>
            </div>

            {/* List */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-6 py-4 xl:flex-row xl:items-center">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold">All records</h3>
                  {indexFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setIndexFilter("all")}
                      className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-red-300 ring-1 ring-inset ring-red-400/20 transition hover:bg-red-400/20"
                    >
                      Index: {indexFilter}
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  {/* Segmented outcome filter */}
                  <div
                    role="tablist"
                    aria-label="Filter by outcome"
                    className="flex overflow-x-auto rounded-xl border border-white/10 bg-[#0d1424] p-1"
                  >
                    {OUTCOME_TABS.map((o) => {
                      const active = outcomeFilter === o;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          key={o}
                          onClick={() => setOutcomeFilter(o)}
                          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                            active
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {o === "all" ? "All" : OUTCOME_STYLES[o].label}
                          <span
                            className={`rounded-md px-1.5 text-[10px] tabular-nums ${
                              active
                                ? "bg-white/10 text-slate-200"
                                : "bg-white/5 text-slate-500"
                            }`}
                          >
                            {outcomeCounts[o]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title or client..."
                      aria-label="Search records"
                      className="w-full rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-9 pr-8 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 lg:w-64"
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

                  {/* Sort */}
                  <div className="relative">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      aria-label="Sort records"
                      className="w-full appearance-none rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-3 pr-8 text-xs text-white outline-none transition hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 lg:w-auto"
                    >
                      <option value="newest">Year: newest first</option>
                      <option value="oldest">Year: oldest first</option>
                      <option value="title">Title: A–Z</option>
                    </select>
                    <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div
                    className={`${GRID} border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500`}
                  >
                    <div>Tender</div>
                    <div>Outcome</div>
                    <div>Value</div>
                    <div>Files</div>
                    <div>Index status</div>
                  </div>

                  {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                        <SearchIcon className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium text-slate-300">
                        No records found
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
                    visible.map((r) => {
                      const outcomeStyle = OUTCOME_STYLES[r.outcome];
                      const idx = INDEX_STYLES[r.indexStatus];
                      const IdxIcon = idx.Icon;

                      return (
                        <div
                          key={r.id}
                          className={`${GRID} border-b border-white/5 px-6 py-5 transition-colors last:border-b-0 hover:bg-white/[0.03]`}
                        >
                          {/* Tender */}
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 text-sm font-semibold text-blue-200 ring-1 ring-inset ring-white/10">
                              {r.client.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-medium text-slate-100"
                                title={r.title}
                              >
                                {r.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {r.client}
                                <span className="mx-1.5 text-slate-700">•</span>
                                {r.year}
                                <span className="mx-1.5 text-slate-700">•</span>
                                Added {r.addedAt}
                              </p>
                            </div>
                          </div>

                          {/* Outcome */}
                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${outcomeStyle.badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${outcomeStyle.dot}`}
                              />
                              {outcomeStyle.label}
                            </span>
                          </div>

                          {/* Value */}
                          <div className="text-sm font-medium tabular-nums text-slate-200">
                            {r.value}
                          </div>

                          {/* Files */}
                          <div className="flex items-center gap-1.5 text-sm text-slate-400">
                            <FileIcon className="h-4 w-4 text-slate-600" />
                            <span className="tabular-nums">{r.documents}</span>
                          </div>

                          {/* Index status */}
                          <div className="min-w-0">
                            <p
                              className={`flex items-center gap-1.5 text-xs font-medium ${idx.text}`}
                            >
                              <IdxIcon />
                              <span>
                                {idx.label}
                                {r.indexStatus === "indexed" && (
                                  <span className="font-normal text-slate-500">
                                    {" "}
                                    · {r.chunks.toLocaleString()} passages
                                  </span>
                                )}
                              </span>
                            </p>

                            {r.indexStatus === "failed" && (
                              <div className="mt-2">
                                <p className="text-xs leading-5 text-red-300/90">
                                  {r.indexError}
                                </p>
                                <button
                                  type="button"
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
                                >
                                  <RetryIcon />
                                  Retry
                                </button>
                              </div>
                            )}

                            {r.indexStatus === "indexing" && (
                              <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full w-[55%] animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" />
                              </div>
                            )}
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
                  of {stats.total} records
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

      {/* Add historical tender modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-tender-title"
            onSubmit={handleSubmit}
            noValidate
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c] p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-400/20">
                  <DatabaseIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3
                    id="add-tender-title"
                    className="text-lg font-semibold tracking-tight"
                  >
                    Add historical tender
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Upload a past tender or bid so it can be searched later.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="kb-title"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Tender title <span className="text-red-400">*</span>
                </label>
                <input
                  id="kb-title"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={titleInvalid}
                  placeholder="e.g. City Council ERP Modernisation"
                  className={`${inputCls} ${
                    titleInvalid
                      ? "!border-red-400/60 focus:!ring-red-500/10"
                      : ""
                  }`}
                />
                {titleInvalid && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
                    <AlertIcon />
                    Please enter a title.
                  </p>
                )}
              </div>

              {/* Client + Year */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_130px]">
                <div>
                  <label
                    htmlFor="kb-client"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Client
                  </label>
                  <input
                    id="kb-client"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Client name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label
                    htmlFor="kb-year"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Year
                  </label>
                  <input
                    id="kb-year"
                    value={year}
                    onChange={(e) =>
                      setYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    inputMode="numeric"
                    placeholder="2025"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Outcome */}
              <div>
                <span
                  id="kb-outcome-label"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Outcome
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="kb-outcome-label"
                  className="grid grid-cols-3 gap-2"
                >
                  {(["won", "lost", "completed"] as const).map((o) => {
                    const selected = outcome === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setOutcome(o)}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                          selected
                            ? OUTCOME_STYLES[o].selected
                            : "border-white/10 bg-[#0b1220] text-slate-400 hover:border-white/20 hover:text-slate-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            selected ? OUTCOME_STYLES[o].dot : "bg-slate-600"
                          }`}
                        />
                        {OUTCOME_STYLES[o].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dropzone */}
              <div>
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Files
                </span>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    // ignore leave events fired when moving over child nodes
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setIsDragging(false);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
                    isDragging
                      ? "border-blue-400 bg-blue-500/[0.12]"
                      : "border-blue-400/25 bg-blue-500/[0.03] hover:border-blue-400/50 hover:bg-blue-500/[0.07]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_EXT.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />

                  <div
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-400/20 transition-transform duration-200 ${
                      isDragging ? "-translate-y-1 scale-110" : ""
                    }`}
                  >
                    <UploadIcon className="h-5 w-5" />
                  </div>

                  <p className="mt-3 text-sm font-medium">
                    {isDragging ? "Drop files to add them" : "Drop files here"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    PDF, DOCX, XLSX or ZIP · or{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded font-medium text-blue-400 underline underline-offset-4 transition hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                    >
                      browse
                    </button>
                  </p>
                </div>

                {/* Unsupported file warning */}
                {fileError && (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs text-amber-300"
                  >
                    <AlertIcon />
                    {fileError}
                  </p>
                )}

                {/* Selected files */}
                {files.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-400">
                        {files.length} file{files.length > 1 && "s"} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          setFileError("");
                        }}
                        className="text-slate-500 transition hover:text-white"
                      >
                        Remove all
                      </button>
                    </div>

                    <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${f.size}-${i}`}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
                        >
                          <FileIcon className="h-4 w-4 shrink-0 text-slate-500" />

                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-xs font-medium text-slate-200"
                              title={f.name}
                            >
                              {f.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatSize(f.size)}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${f.name}`}
                            onClick={() =>
                              setFiles((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Indexing starts automatically after upload.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
                >
                  Add &amp; index
                  {files.length > 0 && (
                    <span className="ml-2 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] tabular-nums">
                      {files.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}