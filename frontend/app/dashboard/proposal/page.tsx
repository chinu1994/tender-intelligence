"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
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

const PencilIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

const UndoIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12h-3" />
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

const ChevronIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const BoltIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
  </svg>
);

const ExternalIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
  </svg>
);

/* ---------------------------- Helpers ----------------------------- */

type Tab = "all" | "attention" | "reviewed";

const RING_RADIUS = 20;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function confidenceLevel(c: number) {
  if (c >= 0.85)
    return {
      label: "High",
      badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
      bar: "bg-emerald-400",
      segments: 3,
    };
  if (c >= 0.6)
    return {
      label: "Medium",
      badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
      bar: "bg-amber-400",
      segments: 2,
    };
  return {
    label: "Low",
    badge: "bg-red-400/10 text-red-300 ring-red-400/20",
    bar: "bg-red-400",
    segments: 1,
  };
}

function needsAttention(f: ExtractedField) {
  return f.status === "pending" && (f.confidence < 0.85 || Boolean(f.flag));
}

function isSafe(f: ExtractedField) {
  return f.status === "pending" && f.confidence >= 0.85 && !f.flag;
}

// Highlight the part of the paragraph the value came from.
function renderCitation(text: string, highlight: string) {
  const i = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (i === -1) return text;

  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-300/40 px-0.5 text-amber-950">
        {text.slice(i, i + highlight.length)}
      </mark>
      {text.slice(i + highlight.length)}
    </>
  );
}

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-40";

/* ------------------------------ Page ------------------------------ */

export default function ReviewPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fields, setFields] = useState<ExtractedField[]>(mockFields);
  const [selectedId, setSelectedId] = useState(mockFields[0].id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [committed, setCommitted] = useState(false);

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

  const total = fields.length;
  const reviewed = fields.filter((f) => f.status !== "pending").length;
  const attention = fields.filter(needsAttention).length;
  const corrected = fields.filter((f) => f.status === "corrected").length;
  const safeCount = fields.filter(isSafe).length;
  const allDone = reviewed === total;
  const pct = total ? Math.round((reviewed / total) * 100) : 0;
  const locked = committed;

  const selected = fields.find((f) => f.id === selectedId) ?? fields[0];
  const selectedIndex = fields.findIndex((f) => f.id === selected.id);
  const selectedConf = confidenceLevel(selected.confidence);

  const visible = useMemo(
    () =>
      fields.filter((f) => {
        if (tab === "attention") return needsAttention(f);
        if (tab === "reviewed") return f.status !== "pending";
        return true;
      }),
    [fields, tab]
  );

  function update(id: string, changes: Partial<ExtractedField>) {
    setFields((cur) =>
      cur.map((f) => (f.id === id ? { ...f, ...changes } : f))
    );
  }

  function startEdit(f: ExtractedField) {
    setSelectedId(f.id);
    setEditingId(f.id);
    setDraft(f.value);
  }

  function saveEdit(f: ExtractedField) {
    const next = draft.trim();
    if (!next) return;
    update(f.id, {
      value: next,
      status: next !== f.originalValue ? "corrected" : "confirmed",
    });
    setEditingId(null);
  }

  function undo(f: ExtractedField) {
    update(f.id, { value: f.originalValue, status: "pending" });
  }

  function confirmAllSafe() {
    setFields((cur) =>
      cur.map((f) => (isSafe(f) ? { ...f, status: "confirmed" } : f))
    );
  }

  // Move selection through the fields currently visible
  function step(dir: 1 | -1) {
    if (visible.length === 0) return;
    const i = visible.findIndex((f) => f.id === selected.id);
    const next =
      visible[(i + dir + visible.length) % visible.length] ?? visible[0];
    setSelectedId(next.id);
  }

  // Jump to the next field that is still pending
  function goToNextPending() {
    const ordered = [
      ...fields.slice(selectedIndex + 1),
      ...fields.slice(0, selectedIndex),
    ];
    const next = ordered.find((f) => f.status === "pending");
    if (next) {
      setTab("all");
      setSelectedId(next.id);
    }
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
    ["all", "All fields", total],
    ["attention", "Needs attention", attention],
    ["reviewed", "Reviewed", reviewed],
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
        <Sidebar active="Review" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Review &amp; Correction
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
            {/* Case + progress */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {mockCaseInfo.name}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        committed
                          ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                          : "bg-amber-400/10 text-amber-300 ring-amber-400/20"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          committed ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      {committed ? "Committed" : "Review Required"}
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    <span className="text-slate-500">{mockCaseInfo.id}</span> ·
                    Check each extracted value against the original document,
                    fix mistakes, then commit.
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  {/* Progress ring */}
                  <div className="relative h-16 w-16 shrink-0">
                    <svg
                      viewBox="0 0 48 48"
                      className="h-16 w-16 -rotate-90"
                      aria-hidden
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r={RING_RADIUS}
                        fill="none"
                        strokeWidth="4"
                        className="stroke-white/10"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r={RING_RADIUS}
                        fill="none"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${
                          (pct / 100) * RING_CIRC
                        } ${RING_CIRC}`}
                        className={`transition-all duration-500 ${
                          allDone ? "stroke-emerald-400" : "stroke-blue-400"
                        }`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
                      {pct}
                      <span className="text-[9px] text-slate-500">%</span>
                    </span>
                  </div>

                  <dl className="grid grid-cols-3 gap-5 text-center">
                    <div>
                      <dt className="text-[11px] text-slate-500">Reviewed</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums">
                        {reviewed}
                        <span className="text-xs font-normal text-slate-600">
                          /{total}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Attention</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-300">
                        {attention}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Corrected</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-violet-300">
                        {corrected}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {committed && (
              <div
                role="status"
                className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              >
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Corrections committed. This case can now move to Proposal
                  Draft. Fields are locked.
                </p>
              </div>
            )}

            {/* Tabs + bulk action */}
            <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div
                role="tablist"
                aria-label="Filter fields"
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

              <button
                type="button"
                onClick={confirmAllSafe}
                disabled={safeCount === 0 || locked}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-slate-500"
              >
                <BoltIcon />
                Confirm all high-confidence
                <span className="rounded-md bg-white/10 px-1.5 text-[10px] tabular-nums">
                  {safeCount}
                </span>
              </button>
            </div>

            {/* Two-column layout */}
            <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
              {/* LEFT: extracted fields */}
              <div className="space-y-6">
                {visible.length === 0 && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
                      <CheckCircleIcon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-300">
                      {tab === "attention"
                        ? "All caught up"
                        : "Nothing here yet"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tab === "attention"
                        ? "No fields need your attention right now."
                        : "Review some fields and they will show up here."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("all")}
                      className={`${btnGhost} mt-2`}
                    >
                      Show all fields
                    </button>
                  </div>
                )}

                {CATEGORY_ORDER.map((cat) => {
                  const items = visible.filter((f) => f.category === cat);
                  if (items.length === 0) return null;

                  const catAll = fields.filter((f) => f.category === cat);
                  const catDone = catAll.filter(
                    (f) => f.status !== "pending"
                  ).length;

                  return (
                    <div key={cat}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {CATEGORY_LABELS[cat]}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] tabular-nums ${
                            catDone === catAll.length
                              ? "text-emerald-400"
                              : "text-slate-500"
                          }`}
                        >
                          {catDone === catAll.length && <CheckIcon />}
                          {catDone}/{catAll.length} reviewed
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/10">
                        {items.map((f) => {
                          const conf = confidenceLevel(f.confidence);
                          const isSelected = f.id === selected.id;
                          const isEditing = f.id === editingId;
                          const canSave = draft.trim().length > 0;

                          return (
                            <div
                              key={f.id}
                              tabIndex={0}
                              aria-current={isSelected ? "true" : undefined}
                              onClick={() => setSelectedId(f.id)}
                              onKeyDown={(e) => {
                                if (
                                  e.target === e.currentTarget &&
                                  (e.key === "Enter" || e.key === " ")
                                ) {
                                  e.preventDefault();
                                  setSelectedId(f.id);
                                }
                              }}
                              className={`cursor-pointer border-b border-white/5 p-5 outline-none transition last:border-b-0 focus-visible:bg-white/[0.04] ${
                                isSelected
                                  ? "bg-blue-500/[0.08] shadow-[inset_3px_0_0_0_rgb(96,165,250)]"
                                  : "hover:bg-white/[0.03]"
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <p className="text-xs font-medium text-slate-400">
                                  {f.label}
                                </p>

                                <div className="flex items-center gap-2">
                                  {f.status !== "pending" && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                        f.status === "corrected"
                                          ? "bg-violet-400/10 text-violet-300 ring-violet-400/20"
                                          : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                                      }`}
                                    >
                                      {f.status === "corrected" ? (
                                        <PencilIcon className="h-3 w-3" />
                                      ) : (
                                        <CheckIcon className="h-3 w-3" />
                                      )}
                                      {f.status === "corrected"
                                        ? "Corrected"
                                        : "Confirmed"}
                                    </span>
                                  )}

                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${conf.badge}`}
                                    title={`Extraction confidence ${Math.round(
                                      f.confidence * 100
                                    )}%`}
                                  >
                                    <span
                                      aria-hidden
                                      className="flex items-end gap-px"
                                    >
                                      {[1, 2, 3].map((n) => (
                                        <span
                                          key={n}
                                          className={`w-[3px] rounded-sm ${
                                            n <= conf.segments
                                              ? conf.bar
                                              : "bg-white/15"
                                          }`}
                                          style={{ height: 4 + n * 2 }}
                                        />
                                      ))}
                                    </span>
                                    {conf.label} ·{" "}
                                    {Math.round(f.confidence * 100)}%
                                  </span>
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="mt-2">
                                  <label
                                    htmlFor={`edit-${f.id}`}
                                    className="sr-only"
                                  >
                                    Edit {f.label}
                                  </label>
                                  <input
                                    id={`edit-${f.id}`}
                                    autoFocus
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveEdit(f);
                                      }
                                      if (e.key === "Escape") {
                                        setEditingId(null);
                                      }
                                    }}
                                    aria-invalid={!canSave}
                                    className="w-full rounded-xl border border-blue-400/50 bg-[#0b1220] px-4 py-2.5 text-sm text-white outline-none ring-4 ring-blue-400/10 transition aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:ring-red-500/10"
                                  />
                                  <p className="mt-1.5 text-[11px] text-slate-500">
                                    {canSave ? (
                                      <>
                                        Press{" "}
                                        <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans text-slate-400">
                                          Enter
                                        </kbd>{" "}
                                        to save,{" "}
                                        <kbd className="rounded border border-white/10 bg-white/5 px-1 font-sans text-slate-400">
                                          Esc
                                        </kbd>{" "}
                                        to cancel
                                      </>
                                    ) : (
                                      <span className="text-red-300">
                                        Value can&apos;t be empty.
                                      </span>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-1.5 text-sm font-medium leading-6 text-slate-100">
                                  {f.value}
                                </p>
                              )}

                              {f.status === "corrected" && !isEditing && (
                                <p className="mt-1 text-xs text-slate-500">
                                  <span className="mr-1.5 text-slate-600">
                                    Was:
                                  </span>
                                  <span className="line-through">
                                    {f.originalValue}
                                  </span>
                                </p>
                              )}

                              {f.flag && f.status === "pending" && (
                                <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-amber-200">
                                  <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>{f.flag}</span>
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                                  <span
                                    className="truncate"
                                    title={f.citation.documentName}
                                  >
                                    {f.citation.documentName}
                                  </span>
                                  <span className="shrink-0 text-slate-600">
                                    · p.{f.citation.page}
                                  </span>
                                </p>

                                <div
                                  className="flex shrink-0 gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setEditingId(null)}
                                        className={btnGhost}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => saveEdit(f)}
                                        disabled={!canSave}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-400 to-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                                      >
                                        Save
                                      </button>
                                    </>
                                  ) : f.status === "pending" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEdit(f)}
                                        disabled={locked}
                                        className={btnGhost}
                                      >
                                        <PencilIcon />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          update(f.id, {
                                            status: "confirmed",
                                          })
                                        }
                                        disabled={locked}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <CheckIcon />
                                        Confirm
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => undo(f)}
                                      disabled={locked}
                                      className={btnGhost}
                                    >
                                      <UndoIcon />
                                      Undo
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RIGHT: original document citation */}
              <aside className="xl:sticky xl:top-28 xl:self-start">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-xl shadow-black/20">
                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Original document
                      </p>
                      <span className="text-[11px] tabular-nums text-slate-500">
                        Field {selectedIndex + 1} of {total}
                      </span>
                    </div>

                    <p
                      className="mt-1.5 flex items-center gap-2 truncate text-sm font-semibold"
                      title={selected.citation.documentName}
                    >
                      <FileIcon className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate">
                        {selected.citation.documentName}
                      </span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">
                        Page {selected.citation.page}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">
                        Paragraph {selected.citation.paragraph}
                      </span>
                    </div>
                  </div>

                  {/* Page preview */}
                  <div className="bg-[#0b1220] p-5">
                    <div className="rounded-xl bg-[#e8ecf3] p-6 text-slate-800 shadow-inner">
                      <div className="mb-4 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        <span>Page {selected.citation.page}</span>
                        <span>¶ {selected.citation.paragraph}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="h-2 w-2/3 rounded bg-slate-300" />
                        <div className="h-2 w-full rounded bg-slate-300" />
                        <div className="h-2 w-5/6 rounded bg-slate-300" />
                      </div>

                      <p
                        key={selected.id}
                        className="my-5 rounded-lg border-l-4 border-amber-400 bg-white px-4 py-3 text-sm leading-6 shadow-sm"
                      >
                        {renderCitation(
                          selected.citation.text,
                          selected.citation.highlight
                        )}
                      </p>

                      <div className="space-y-2">
                        <div className="h-2 w-full rounded bg-slate-300" />
                        <div className="h-2 w-3/4 rounded bg-slate-300" />
                      </div>
                    </div>

                    <p className="mt-3 text-center text-xs text-slate-500">
                      Highlighted text is where the value was found.
                    </p>
                  </div>

                  <div className="border-t border-white/10 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          {selected.label}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-6">
                          {selected.value}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${selectedConf.badge}`}
                      >
                        {selectedConf.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => step(-1)}
                        disabled={visible.length < 2}
                        className={`${btnGhost} justify-center`}
                      >
                        <ChevronIcon className="h-3.5 w-3.5 rotate-90" />
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => step(1)}
                        disabled={visible.length < 2}
                        className={`${btnGhost} justify-center`}
                      >
                        Next
                        <ChevronIcon className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={goToNextPending}
                      disabled={allDone}
                      className="mt-2 w-full rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 ring-1 ring-inset ring-blue-400/20 transition hover:bg-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Jump to next unreviewed field
                    </button>

                    <button
                      type="button"
                      className={`${btnGhost} mt-2 w-full justify-center`}
                    >
                      <ExternalIcon />
                      Open full document
                    </button>
                  </div>
                </div>
              </aside>
            </div>

            {/* Commit bar */}
            <div className="sticky bottom-4 z-20 mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#0a0f1c]/85 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
              <div className="min-w-0 sm:flex-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {committed
                    ? "Corrections committed"
                    : allDone
                    ? "Ready to commit"
                    : "Review all fields first"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {committed
                    ? "Your corrections have been saved for this case."
                    : allDone
                    ? "All fields are reviewed. Committing saves your corrections."
                    : `${total - reviewed} field${
                        total - reviewed > 1 ? "s" : ""
                      } still waiting for your review.`}
                </p>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10 sm:max-w-md">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      allDone
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                        : "bg-gradient-to-r from-blue-500 to-cyan-300"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!allDone || committed}
                onClick={() => setCommitted(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none"
              >
                {committed && <CheckIcon />}
                {committed ? "Committed" : "Commit corrections"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}