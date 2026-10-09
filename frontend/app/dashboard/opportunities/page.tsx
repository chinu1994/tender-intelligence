"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import {
  mockOpportunities,
  STAGES,
  type Opportunity,
  type Stage,
} from "@/lib/mock/opportunities";

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

const ArrowRightIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
  </svg>
);

const CalendarIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const FileIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const ChevronIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CheckIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} strokeWidth={2.4} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const AlertIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5m0 3h.01" />
  </svg>
);

const FolderIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

const CogIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M21 12a9 9 0 11-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
);

const EyeIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CheckCircleIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const ListIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

const BoardIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="10" y="4" width="5" height="10" rx="1.5" />
    <rect x="17" y="4" width="4" height="13" rx="1.5" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

const STAGE_STYLES: Record<
  Stage,
  { badge: string; dot: string; bar: string }
> = {
  new: {
    badge: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
  },
  analysis: {
    badge: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    dot: "bg-blue-400",
    bar: "bg-blue-400",
  },
  review_required: {
    badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  proposal_draft: {
    badge: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    dot: "bg-violet-400",
    bar: "bg-violet-400",
  },
  approved: {
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  completed: {
    badge: "bg-teal-400/10 text-teal-300 ring-teal-400/20",
    dot: "bg-teal-400",
    bar: "bg-teal-400",
  },
};

const GRID =
  "grid grid-cols-[minmax(0,1fr)_170px_150px_80px_190px] items-center gap-4";

type SortKey = "recent" | "deadline" | "title";
type View = "list" | "board";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10";

const DUE_SOON_DAYS = 14;

function stageIndex(s: Stage) {
  return STAGES.findIndex((x) => x.key === s);
}

function stageLabel(s: Stage) {
  return STAGES[stageIndex(s)].label;
}

// Main action depends on where the case is in its lifecycle.
function primaryAction(o: Opportunity) {
  switch (o.stage) {
    case "new":
      return { label: "Upload documents", href: "/dashboard/documents" };
    case "analysis":
      return { label: "View documents", href: "/dashboard/documents" };
    case "review_required":
      return { label: "Open review", href: "/dashboard/review" };
    default:
      return { label: "View requirements", href: "/dashboard/requirements" };
  }
}

function deadlineTone(days: number | null) {
  if (days === null)
    return { text: "text-slate-500", badge: "bg-white/5 text-slate-400 ring-white/10" };
  if (days <= 7)
    return { text: "text-red-300", badge: "bg-red-400/10 text-red-300 ring-red-400/20" };
  if (days <= DUE_SOON_DAYS)
    return { text: "text-amber-300", badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20" };
  return { text: "text-slate-400", badge: "bg-white/5 text-slate-300 ring-white/10" };
}

// Mark the search text inside a string
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

// 6-segment lifecycle progress
function StageProgress({ stage }: { stage: Stage }) {
  const idx = stageIndex(stage);
  return (
    <div
      className="mt-2 flex gap-1"
      role="img"
      aria-label={`Step ${idx + 1} of ${STAGES.length}`}
    >
      {STAGES.map((s, i) => (
        <span
          key={s.key}
          className={`h-1 w-4 rounded-full transition-colors ${
            i <= idx ? STAGE_STYLES[stage].bar : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const s = STAGE_STYLES[stage];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {stageLabel(stage)}
    </span>
  );
}

const statCard =
  "rounded-2xl border bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 text-left transition-all";

/* ------------------------------ Page ------------------------------ */

export default function OpportunitiesPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [items, setItems] = useState<Opportunity[]>(mockOpportunities);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<View>("list");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal + form
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [deadline, setDeadline] = useState("");
  const [touched, setTouched] = useState(false);

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
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    STAGES.forEach((s) => {
      c[s.key] = items.filter((i) => i.stage === s.key).length;
    });
    return c;
  }, [items]);

  const dueSoon = items.filter(
    (i) => i.daysLeft !== null && i.daysLeft <= DUE_SOON_DAYS
  ).length;

  // Search + sort (used by both views)
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((i) =>
      `${i.title} ${i.client} ${i.id}`.toLowerCase().includes(q)
    );

    if (sort === "title")
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "deadline")
      return [...list].sort(
        (a, b) =>
          (a.daysLeft ?? Number.POSITIVE_INFINITY) -
          (b.daysLeft ?? Number.POSITIVE_INFINITY)
      );
    return list;
  }, [items, search, sort]);

  // List view also respects the stage filter
  const visible = useMemo(
    () =>
      searched.filter((i) => stageFilter === "all" || i.stage === stageFilter),
    [searched, stageFilter]
  );

  const hasFilters = search !== "" || (view === "list" && stageFilter !== "all");

  function resetFilters() {
    setSearch("");
    setStageFilter("all");
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function closeModal() {
    setShowModal(false);
    setTitle("");
    setClient("");
    setDeadline("");
    setTouched(false);
  }

  function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!title.trim()) return;

    const next: Opportunity = {
      id: `TC-2026-0${15 + items.length - mockOpportunities.length + 1}`,
      title: title.trim(),
      client: client.trim() || "—",
      stage: "new",
      deadline: deadline
        ? new Date(deadline).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "No deadline set",
      daysLeft: null,
      documents: 0,
      owner: user!.email,
      createdAt: "just now",
    };

    setItems((cur) => [next, ...cur]);
    showToast(`“${next.title}” created. Upload its documents next.`);
    closeModal();
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
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
  const today = new Date().toISOString().slice(0, 10);

  const STATS: {
    key: Stage;
    label: string;
    hint: string;
    Icon: (p: IconProps) => React.ReactElement;
    iconWrap: string;
    text: string;
    ring: string;
  }[] = [
    {
      key: "analysis",
      label: "In analysis",
      hint: "Documents being processed",
      Icon: CogIcon,
      iconWrap: "bg-blue-400/10 text-blue-400",
      text: "text-blue-400",
      ring: "ring-blue-400/30 border-blue-400/50",
    },
    {
      key: "review_required",
      label: "Review required",
      hint: "Waiting for a reviewer",
      Icon: EyeIcon,
      iconWrap: "bg-amber-400/10 text-amber-400",
      text: "text-amber-400",
      ring: "ring-amber-400/30 border-amber-400/50",
    },
    {
      key: "approved",
      label: "Approved",
      hint: "Ready to submit",
      Icon: CheckCircleIcon,
      iconWrap: "bg-emerald-400/10 text-emerald-400",
      text: "text-emerald-400",
      ring: "ring-emerald-400/30 border-emerald-400/50",
    },
  ];

  const tabs = [{ key: "all" as const, label: "All" }, ...STAGES];

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
        <Sidebar active="Opportunities" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Opportunities
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

          <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
            {/* Intro + action */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Tender cases
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  Every tender you are working on, from first upload to final
                  approval.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
              >
                <PlusIcon />
                New opportunity
              </button>
            </div>

            {/* Stage summary (click to filter) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`${statCard} border-white/10 hover:border-white/20`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">All opportunities</p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-400/10 text-slate-300">
                    <FolderIcon />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {counts.all}
                </p>
                <p
                  className={`mt-2 flex items-center gap-1.5 text-xs ${
                    dueSoon > 0 ? "text-amber-300" : "text-slate-500"
                  }`}
                >
                  {dueSoon > 0 && <AlertIcon />}
                  {dueSoon > 0
                    ? `${dueSoon} due within ${DUE_SOON_DAYS} days`
                    : "In your workspace"}
                </p>
              </div>

              {STATS.map((s) => {
                const active = view === "list" && stageFilter === s.key;
                return (
                  <button
                    type="button"
                    key={s.key}
                    onClick={() => {
                      setView("list");
                      setStageFilter(active ? "all" : s.key);
                    }}
                    aria-pressed={active}
                    className={`${statCard} hover:-translate-y-0.5 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                      active
                        ? `ring-2 ${s.ring}`
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
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
                      {counts[s.key]}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {active ? "Click to clear filter" : s.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Toolbar + content */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-6 py-4 xl:flex-row xl:items-center">
                {view === "list" ? (
                  <div
                    role="tablist"
                    aria-label="Filter by stage"
                    className="flex overflow-x-auto rounded-xl border border-white/10 bg-[#0d1424] p-1"
                  >
                    {tabs.map((s) => {
                      const active = stageFilter === s.key;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          key={s.key}
                          onClick={() => setStageFilter(s.key)}
                          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {s.label}
                          <span
                            className={`rounded-md px-1.5 text-[10px] tabular-nums ${
                              active
                                ? "bg-white/10 text-slate-200"
                                : "bg-white/5 text-slate-500"
                            }`}
                          >
                            {counts[s.key]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    <span className="font-semibold text-white">
                      {searched.length}
                    </span>{" "}
                    opportunities across {STAGES.length} stages
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {/* Search */}
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title, client or ID..."
                      aria-label="Search opportunities"
                      className="w-full rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-9 pr-8 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-64"
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
                      aria-label="Sort opportunities"
                      className="w-full appearance-none rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-3 pr-8 text-xs text-white outline-none transition hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
                    >
                      <option value="recent">Recently added</option>
                      <option value="deadline">Deadline: soonest</option>
                      <option value="title">Title: A–Z</option>
                    </select>
                    <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  </div>

                  {/* View toggle */}
                  <div
                    role="group"
                    aria-label="Change view"
                    className="flex rounded-xl border border-white/10 bg-[#0d1424] p-1"
                  >
                    {(
                      [
                        ["list", "List", ListIcon],
                        ["board", "Board", BoardIcon],
                      ] as const
                    ).map(([key, label, Icon]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setView(key)}
                        aria-pressed={view === key}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          view === key
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIST VIEW */}
              {view === "list" && (
                <div className="overflow-x-auto">
                  <div className="min-w-[960px]">
                    <div
                      className={`${GRID} border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500`}
                    >
                      <div>Tender</div>
                      <div>Stage</div>
                      <div>Deadline</div>
                      <div>Files</div>
                      <div />
                    </div>

                    {visible.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                          <SearchIcon className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-medium text-slate-300">
                          No opportunities found
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
                      visible.map((o) => {
                        const action = primaryAction(o);
                        const tone = deadlineTone(o.daysLeft);

                        return (
                          <div
                            key={o.id}
                            className={`${GRID} border-b border-white/5 px-6 py-5 transition-colors last:border-b-0 hover:bg-white/[0.03]`}
                          >
                            {/* Tender */}
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 text-sm font-semibold text-blue-200 ring-1 ring-inset ring-white/10">
                                {o.client.charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p
                                  className="truncate text-sm font-medium text-slate-100"
                                  title={o.title}
                                >
                                  {highlight(o.title, search)}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500">
                                  {highlight(o.id, search)}
                                  <span className="mx-1.5 text-slate-700">•</span>
                                  {highlight(o.client, search)}
                                  <span className="mx-1.5 text-slate-700">•</span>
                                  Created {o.createdAt}
                                </p>
                              </div>
                            </div>

                            {/* Stage */}
                            <div>
                              <StageBadge stage={o.stage} />
                              <StageProgress stage={o.stage} />
                            </div>

                            {/* Deadline */}
                            <div>
                              <p className="flex items-center gap-1.5 text-sm text-slate-300">
                                <CalendarIcon className="h-3.5 w-3.5 text-slate-600" />
                                {o.deadline}
                              </p>
                              {o.daysLeft !== null && (
                                <span
                                  className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone.badge}`}
                                >
                                  in {o.daysLeft} days
                                </span>
                              )}
                            </div>

                            {/* Files */}
                            <div className="flex items-center gap-1.5 text-sm text-slate-400">
                              <FileIcon className="h-4 w-4 text-slate-600" />
                              <span className="tabular-nums">{o.documents}</span>
                            </div>

                            {/* Action */}
                            <div className="flex justify-end">
                              <Link
                                href={action.href}
                                className="group inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                              >
                                {action.label}
                                <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* BOARD VIEW */}
              {view === "board" && (
                <div className="overflow-x-auto p-4">
                  <div className="flex min-w-max gap-4">
                    {STAGES.map((s) => {
                      const col = searched.filter((i) => i.stage === s.key);
                      const style = STAGE_STYLES[s.key];

                      return (
                        <div
                          key={s.key}
                          className="w-[280px] shrink-0 rounded-xl border border-white/10 bg-[#0b1220]/60"
                        >
                          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                              <span
                                className={`h-2 w-2 rounded-full ${style.dot}`}
                              />
                              {s.label}
                            </p>
                            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-400">
                              {col.length}
                            </span>
                          </div>

                          <div className="space-y-3 p-3">
                            {col.length === 0 && (
                              <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-600">
                                No cases here
                              </p>
                            )}

                            {col.map((o) => {
                              const action = primaryAction(o);
                              const tone = deadlineTone(o.daysLeft);

                              return (
                                <article
                                  key={o.id}
                                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                                >
                                  <p className="text-[11px] tabular-nums text-slate-500">
                                    {highlight(o.id, search)}
                                  </p>
                                  <p
                                    className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-100"
                                    title={o.title}
                                  >
                                    {highlight(o.title, search)}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {highlight(o.client, search)}
                                  </p>

                                  <div className="mt-3 flex items-center justify-between text-xs">
                                    <span
                                      className={`flex items-center gap-1.5 ${tone.text}`}
                                    >
                                      <CalendarIcon />
                                      {o.daysLeft !== null
                                        ? `in ${o.daysLeft} days`
                                        : "No deadline"}
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-500">
                                      <FileIcon />
                                      <span className="tabular-nums">
                                        {o.documents}
                                      </span>
                                    </span>
                                  </div>

                                  <Link
                                    href={action.href}
                                    className="group mt-3 flex items-center justify-between rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                                  >
                                    {action.label}
                                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                  </Link>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-6 py-3 text-xs text-slate-500">
                <span>
                  Showing{" "}
                  <span className="font-medium text-slate-300">
                    {view === "list" ? visible.length : searched.length}
                  </span>{" "}
                  of {items.length} opportunities
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

      {/* Success toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-emerald-400/20 bg-[#0a1a14]/95 px-4 py-3 text-sm text-emerald-200 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="leading-5">{toast}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="rounded p-0.5 text-emerald-300/60 transition hover:text-white"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* New opportunity modal */}
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
            aria-labelledby="new-opp-title"
            onSubmit={createOpportunity}
            noValidate
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c] p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-400/20">
                  <FolderIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3
                    id="new-opp-title"
                    className="text-lg font-semibold tracking-tight"
                  >
                    New opportunity
                  </h3>
                                    <p className="mt-1 text-sm text-slate-400">
                    Create a tender case, then upload its documents.
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
                  htmlFor="opp-title"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Tender title <span className="text-red-400">*</span>
                </label>
                <input
                  id="opp-title"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={titleInvalid}
                  placeholder="e.g. Municipal IT Services Tender"
                  className={`${inputCls} ${
                    titleInvalid
                      ? "!border-red-400/60 focus:!ring-red-500/10"
                      : ""
                  }`}
                />
                {titleInvalid && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
                    <AlertIcon />
                    Please enter a tender title.
                  </p>
                )}
              </div>

              {/* Client */}
              <div>
                <label
                  htmlFor="opp-client"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Client
                </label>
                <input
                  id="opp-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Client or authority name"
                  className={inputCls}
                />
              </div>

              {/* Deadline */}
              <div>
                <label
                  htmlFor="opp-deadline"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Submission deadline{" "}
                  <span className="font-normal text-slate-600">
                    (optional)
                  </span>
                </label>
                <input
                  id="opp-deadline"
                  type="date"
                  min={today}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className={inputCls}
                />
                <p className="mt-2 text-xs text-slate-500">
                  You can leave this empty. It is also picked up from the
                  tender documents later.
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                New cases start at the{" "}
                <span className="font-medium text-slate-300">New</span> stage.
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
                  Create opportunity
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}