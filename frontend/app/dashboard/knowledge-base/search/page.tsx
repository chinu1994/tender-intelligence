"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import type { Outcome } from "@/lib/mock/knowledge-base";
import { exampleQueries, mockResults } from "@/lib/mock/search";

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

const ArrowLeftIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M19 12H5m0 0l6-6m-6 6l6 6" />
  </svg>
);

const ArrowRightIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
  </svg>
);

const XIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const SparkleIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" />
  </svg>
);

const CopyIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 012-2h9" />
  </svg>
);

const CheckIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} strokeWidth={2.6} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const FileIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const EyeIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LockIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);

const ChevronIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const SpinnerIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={`animate-spin ${className}`}>
    <path d="M21 12a9 9 0 11-6.2-8.55" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

const OUTCOME_STYLES: Record<
  Outcome,
  { badge: string; dot: string; label: string }
> = {
  won: {
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    dot: "bg-emerald-400",
    label: "Won",
  },
  lost: {
    badge: "bg-red-400/10 text-red-300 ring-red-400/20",
    dot: "bg-red-400",
    label: "Lost",
  },
  completed: {
    badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    dot: "bg-sky-400",
    label: "Completed",
  },
};

const OUTCOME_TABS = ["all", "won", "lost", "completed"] as const;

type SortKey = "score" | "newest";

const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const SNIPPET_LONG = 220;

function matchTier(score: number) {
  if (score >= 0.85)
    return { label: "Strong match", text: "text-emerald-300", stroke: "stroke-emerald-400" };
  if (score >= 0.7)
    return { label: "Good match", text: "text-blue-300", stroke: "stroke-blue-400" };
  return { label: "Partial match", text: "text-slate-300", stroke: "stroke-slate-400" };
}

// Wrap query words in <mark> so matches stand out in the snippet.
function highlight(text: string, query: string) {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 3);

  if (words.length === 0) return text;

  const regex = new RegExp(`(${words.join("|")})`, "gi");

  return text.split(regex).map((part, i) =>
    words.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
      <mark
        key={i}
        className="rounded bg-blue-400/20 px-0.5 text-blue-200"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/* ------------------------------ Page ------------------------------ */

export default function SimilaritySearchPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("data protection and GDPR compliance");
  const [submitted, setSubmitted] = useState(query);
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | Outcome>("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [isSearching, setIsSearching] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const outcomeCounts = useMemo(() => {
    const c: Record<"all" | Outcome, number> = {
      all: mockResults.length,
      won: 0,
      lost: 0,
      completed: 0,
    };
    mockResults.forEach((r) => {
      c[r.outcome] += 1;
    });
    return c;
  }, []);

  // Static design: pretend any search returns the sample results.
  const results = useMemo(() => {
    const list = mockResults.filter(
      (r) => outcomeFilter === "all" || r.outcome === outcomeFilter
    );

    return [...list].sort((a, b) =>
      sort === "score"
        ? b.score - a.score
        : Number(b.year) - Number(a.year)
    );
  }, [outcomeFilter, sort]);

  function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setQuery(q);
    setIsSearching(true);

    if (searchTimer.current) clearTimeout(searchTimer.current);
    // STATIC DESIGN: fake latency so the loading state is visible
    searchTimer.current = setTimeout(() => {
      setSubmitted(trimmed);
      setIsSearching(false);
    }, 600);
  }

  function copySnippet(id: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);

    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const canSearch = query.trim().length > 0 && !isSearching;

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
                Similarity Search
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
          <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
            <Link
              href="/dashboard/knowledge-base"
              className="group inline-flex items-center gap-2 rounded-lg text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
            >
              <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Back to Knowledge Base
            </Link>

            <div className="mt-5">
              <h2 className="text-xl font-semibold tracking-tight">
                Find similar past answers
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Describe a requirement or paste a paragraph. We search your
                organisation&apos;s historical tenders by meaning, not just
                keywords.
              </p>
            </div>

            {/* Search box */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch(query);
                }}
              >
                <div className="relative">
                  <label htmlFor="search-query" className="sr-only">
                    Requirement or paragraph to search
                  </label>

                  <textarea
                    id="search-query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        runSearch(query);
                      }
                    }}
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g. The supplier must demonstrate GDPR compliance and describe how personal data is protected..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 pb-9 pr-10 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                  />

                  {query && (
                    <button
                      type="button"
                      aria-label="Clear query"
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-3 rounded-md p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <span className="pointer-events-none absolute bottom-3 right-4 text-[11px] tabular-nums text-slate-600">
                    {query.length} / 1000
                  </span>
                </div>

                <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <SparkleIcon className="h-3.5 w-3.5 text-blue-400" />
                      Try:
                    </span>

                    {exampleQueries.map((q) => (
                      <button
                        type="button"
                        key={q}
                        onClick={() => runSearch(q)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 lg:shrink-0">
                    <span className="hidden text-[11px] text-slate-600 xl:inline">
                      <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-slate-400">
                        Ctrl
                      </kbd>{" "}
                      +{" "}
                      <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-slate-400">
                        Enter
                      </kbd>
                    </span>

                    <button
                      type="submit"
                      disabled={!canSearch}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                      {isSearching ? (
                        <>
                          <SpinnerIcon />
                          Searching…
                        </>
                      ) : (
                        <>
                          <SearchIcon />
                          Search
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              <p className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4 text-xs text-slate-500">
                <LockIcon className="h-3.5 w-3.5 text-emerald-400" />
                Results come only from your organisation&apos;s own records.
              </p>
            </div>

            {/* Results header */}
            <div className="mt-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <p
                aria-live="polite"
                className="min-w-0 text-sm text-slate-400"
              >
                <span className="font-semibold text-white">
                  {isSearching ? "Searching…" : `${results.length} matches`}
                </span>
                {!isSearching && (
                  <>
                    {" "}
                    for{" "}
                    <span className="break-words text-slate-300">
                      &ldquo;
                      {submitted.length > 80
                        ? `${submitted.slice(0, 80)}…`
                        : submitted}
                      &rdquo;
                    </span>
                  </>
                )}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
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

                {/* Sort */}
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    aria-label="Sort results"
                    className="w-full appearance-none rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-3 pr-8 text-xs text-white outline-none transition hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
                  >
                    <option value="score">Best match first</option>
                    <option value="newest">Newest first</option>
                  </select>
                  <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="mt-4 space-y-4">
              {/* Loading skeletons */}
              {isSearching &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/10" />
                        <div className="space-y-2">
                          <div className="h-3 w-56 rounded bg-white/10" />
                          <div className="h-2.5 w-32 rounded bg-white/5" />
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-white/10" />
                    </div>
                    <div className="mt-4 space-y-2 rounded-xl bg-white/[0.03] p-4">
                      <div className="h-3 w-full rounded bg-white/10" />
                      <div className="h-3 w-5/6 rounded bg-white/10" />
                      <div className="h-3 w-2/3 rounded bg-white/5" />
                    </div>
                  </div>
                ))}

              {/* Empty */}
              {!isSearching && results.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                    <SearchIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-slate-300">
                    No matches for this filter
                  </p>
                  <p className="text-xs text-slate-500">
                    Try another outcome or show all results.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOutcomeFilter("all")}
                    className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.05]"
                  >
                    Show all outcomes
                  </button>
                </div>
              )}

              {/* Result cards */}
              {!isSearching &&
                results.map((r, index) => {
                  const outcome = OUTCOME_STYLES[r.outcome];
                  const tier = matchTier(r.score);
                  const pct = Math.round(r.score * 100);
                  const isLong = r.snippet.length > SNIPPET_LONG;
                  const isOpen = expanded.has(r.id);
                  const copied = copiedId === r.id;

                  return (
                    <article
                      key={r.id}
                      className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-white/20"
                    >
                      {/* Top row */}
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 text-sm font-semibold text-blue-200 ring-1 ring-inset ring-white/10">
                            {r.client.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
                                #{index + 1}
                              </span>
                              <p
                                className="truncate text-sm font-semibold text-slate-100"
                                title={r.tenderTitle}
                              >
                                {r.tenderTitle}
                              </p>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {r.client}
                              <span className="mx-1.5 text-slate-700">•</span>
                              {r.year}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 sm:shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${outcome.badge}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${outcome.dot}`}
                            />
                            {outcome.label}
                          </span>

                          <div className="flex items-center gap-2.5">
                            <div className="relative h-12 w-12 shrink-0">
                              <svg
                                viewBox="0 0 40 40"
                                className="h-12 w-12 -rotate-90"
                                aria-hidden
                              >
                                <circle
                                  cx="20"
                                  cy="20"
                                  r={RING_RADIUS}
                                  fill="none"
                                  strokeWidth="3.5"
                                  className="stroke-white/10"
                                />
                                <circle
                                  cx="20"
                                  cy="20"
                                  r={RING_RADIUS}
                                  fill="none"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeDasharray={`${
                                    r.score * RING_CIRCUMFERENCE
                                  } ${RING_CIRCUMFERENCE}`}
                                  className={`${tier.stroke} transition-all duration-500`}
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
                                {pct}
                                <span className="text-[8px] text-slate-500">
                                  %
                                </span>
                              </span>
                            </div>

                            <div className="hidden text-xs sm:block">
                              <p className={`font-semibold ${tier.text}`}>
                                {tier.label}
                              </p>
                              <p className="text-slate-500">similarity</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Snippet */}
                      <div className="mt-4 rounded-xl border-l-2 border-blue-400/40 bg-white/[0.03] px-4 py-3">
                        <p
                          className={`text-sm leading-6 text-slate-300 ${
                            isLong && !isOpen ? "line-clamp-3" : ""
                          }`}
                        >
                          {highlight(r.snippet, submitted)}
                        </p>

                        {isLong && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(r.id)}
                            aria-expanded={isOpen}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 transition hover:text-blue-300"
                          >
                            {isOpen ? "Show less" : "Show more"}
                            <ChevronIcon
                              className={`h-3 w-3 transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Source reference + actions */}
                      <div className="mt-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-600">Source:</span>

                          <span className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-200">
                            <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="truncate" title={r.documentName}>
                              {r.documentName}
                            </span>
                          </span>

                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">
                            Page {r.page}
                          </span>

                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">
                            Paragraph {r.paragraph}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copySnippet(r.id, r.snippet)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 ${
                              copied
                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                : "border-white/10 text-slate-300 hover:bg-white/[0.05]"
                            }`}
                          >
                            {copied ? <CheckIcon /> : <CopyIcon />}
                            {copied ? "Copied" : "Copy text"}
                          </button>

                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                          >
                            <EyeIcon />
                            View source
                          </button>

                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-inset ring-blue-400/20 transition hover:bg-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                          >
                            Use in proposal
                            <ArrowRightIcon />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>

            {/* Footer note */}
            {!isSearching && results.length > 0 && (
              <p className="mt-6 text-center text-xs text-slate-600">
                Showing {results.length} of {mockResults.length} matches ·
                ranked by semantic similarity
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}