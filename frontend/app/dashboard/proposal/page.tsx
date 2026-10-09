"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  mockIssues,
  mockProposalCase,
  mockProposalRequirements,
  mockSections,
  mockSnippets,
  type ReqType,
  type Severity,
} from "@/lib/mock/proposal";

// STATIC DESIGN: user + data are mocked. No API calls yet.
// Change role to "editor" to see the workspace without the Approve button.
const mockUser = { email: "reviewer@acme.com", role: "reviewer" };

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

const UndoIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12h-3" />
  </svg>
);

const FileIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const PlusIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const DownloadIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
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

const BoltIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
  </svg>
);

/* ---------------------------- Helpers ----------------------------- */

type ReqTab = "all" | "open" | "done";

const RING_RADIUS = 20;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const TYPE_ORDER: ReqType[] = ["mandatory", "evaluation", "evidence"];

const TYPE_STYLES: Record<
  ReqType,
  { label: string; group: string; className: string }
> = {
  mandatory: {
    label: "Mandatory",
    group: "Mandatory requirements",
    className: "bg-red-400/10 text-red-300 ring-red-400/20",
  },
  evaluation: {
    label: "Evaluation",
    group: "Evaluation criteria",
    className: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
  },
  evidence: {
    label: "Evidence",
    group: "Required evidence",
    className: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  },
};

const SEVERITY_STYLES: Record<Severity, { label: string; className: string }> =
  {
    high: {
      label: "High",
      className: "bg-red-400/10 text-red-300 ring-red-400/20",
    },
    medium: {
      label: "Medium",
      className: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    },
    low: {
      label: "Low",
      className: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
    },
  };

const OUTCOME_STYLES = {
  won: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  lost: "bg-red-400/10 text-red-300 ring-red-400/20",
  completed: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
} as const;

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-40";

function wordCount(text: string) {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/* ------------------------------ Page ------------------------------ */

export default function ProposalWorkspacePage() {
  const [sections, setSections] = useState(mockSections);
  const [issues, setIssues] = useState(mockIssues);
  const [selectedId, setSelectedId] = useState(
    (mockSections[2] ?? mockSections[0]).id
  );
  const [inserted, setInserted] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState(false);
  const [reqTab, setReqTab] = useState<ReqTab>("all");

  const canApprove = mockUser.role === "reviewer" || mockUser.role === "admin";

  const totalSections = sections.length;
  const completeCount = sections.filter((s) => s.status === "complete").length;
  const openIssues = issues.filter((i) => !i.resolved);
  const readyToApprove =
    completeCount === totalSections && openIssues.length === 0;
  const pct = totalSections
    ? Math.round((completeCount / totalSections) * 100)
    : 0;
  const locked = approved;

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const snippets = mockSnippets.filter((s) => s.sectionId === selected.id);

  const isCovered = (sectionId: string) =>
    (sections.find((s) => s.id === sectionId)?.content.trim().length ?? 0) > 0;

  const reqTotal = mockProposalRequirements.length;
  const reqDone = mockProposalRequirements.filter((r) =>
    isCovered(r.sectionId)
  ).length;

  const visibleReqs = mockProposalRequirements.filter((r) => {
    if (reqTab === "open") return !isCovered(r.sectionId);
    if (reqTab === "done") return isCovered(r.sectionId);
    return true;
  });

  const REQ_TABS: [ReqTab, string, number][] = [
    ["all", "All", reqTotal],
    ["open", "Not yet", reqTotal - reqDone],
    ["done", "Addressed", reqDone],
  ];

  function updateSection(id: string, changes: Partial<(typeof sections)[0]>) {
    setSections((cur) =>
      cur.map((s) => (s.id === id ? { ...s, ...changes } : s))
    );
  }

  function focusSection(id: string) {
    setSelectedId(id);
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function jumpToNextIncomplete() {
    const i = sections.findIndex((s) => s.id === selected.id);
    const ordered = [...sections.slice(i + 1), ...sections.slice(0, i)];
    const next = ordered.find((s) => s.status !== "complete");
    if (next) focusSection(next.id);
  }

  function insertSnippet(snippetId: string, text: string) {
    updateSection(selected.id, {
      content: selected.content.trim()
        ? `${selected.content.trim()}\n\n${text}`
        : text,
    });
    setInserted((cur) => new Set(cur).add(snippetId));
  }

  function toggleIssue(id: string) {
    setIssues((cur) =>
      cur.map((i) => (i.id === id ? { ...i, resolved: !i.resolved } : i))
    );
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  const leftToDo = totalSections - completeCount;

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
        <Sidebar active="Proposal" user={mockUser} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Proposal Workspace
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{mockUser.email}</p>
                <p className="text-xs capitalize text-slate-500">
                  {mockUser.role}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-semibold shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
                {mockUser.email.charAt(0).toUpperCase()}
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
                      {mockProposalCase.name}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        approved
                          ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                          : "bg-violet-400/10 text-violet-300 ring-violet-400/20"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          approved ? "bg-emerald-400" : "bg-violet-400"
                        }`}
                      />
                      {approved ? "Approved" : "Proposal Draft"}
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    <span className="text-slate-500">
                      {mockProposalCase.id}
                    </span>{" "}
                    · Submission deadline{" "}
                    <span className="text-slate-300">
                      {mockProposalCase.deadline}
                    </span>
                    . Write each section, reuse past answers, and resolve open
                    issues before approval.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-5">
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
                          completeCount === totalSections
                            ? "stroke-emerald-400"
                            : "stroke-blue-400"
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
                      <dt className="text-[11px] text-slate-500">Sections</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums">
                        {completeCount}
                        <span className="text-xs font-normal text-slate-600">
                          /{totalSections}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Addressed</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-sky-300">
                        {reqDone}
                        <span className="text-xs font-normal text-slate-600">
                          /{reqTotal}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Open issues</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-300">
                        {openIssues.length}
                      </dd>
                    </div>
                  </dl>

                  <a
                    href="/dashboard/export"
                    className={`${btnGhost} px-4 py-2.5 text-sm`}
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Export
                  </a>
                </div>
              </div>
            </div>

            {approved && (
              <div
                role="status"
                className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              >
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Proposal approved. Sections are now locked. You can export it.</p>
              </div>
            )}

            {/* 3-column workspace */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)_340px]">
              {/* LEFT: requirements */}
              <div className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/10">
                <div className="border-b border-white/10 px-5 py-4">
                  <h3 className="text-base font-semibold">Requirements</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Click one to jump to where it is answered.
                  </p>

                  <div
                    role="tablist"
                    aria-label="Filter requirements"
                    className="mt-3 flex overflow-x-auto rounded-xl border border-white/10 bg-[#0d1424] p-1"
                  >
                    {REQ_TABS.map(([key, label, n]) => {
                      const active = reqTab === key;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          key={key}
                          onClick={() => setReqTab(key)}
                          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
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
                </div>

                {visibleReqs.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
                      <CheckCircleIcon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-300">
                      {reqTab === "open" ? "All caught up" : "Nothing here yet"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReqTab("all")}
                      className={`${btnGhost} mt-1`}
                    >
                      Show all
                    </button>
                  </div>
                )}

                {TYPE_ORDER.map((type) => {
                  const items = visibleReqs.filter((r) => r.type === type);
                  if (items.length === 0) return null;

                  const all = mockProposalRequirements.filter(
                    (r) => r.type === type
                  );
                  const done = all.filter((r) => isCovered(r.sectionId)).length;

                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between bg-white/[0.02] px-5 py-2">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {TYPE_STYLES[type].group}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] tabular-nums ${
                            done === all.length
                              ? "text-emerald-400"
                              : "text-slate-500"
                          }`}
                        >
                          {done === all.length && <CheckIcon />}
                          {done}/{all.length}
                        </span>
                      </div>

                      {items.map((r) => {
                        const section = sections.find(
                          (s) => s.id === r.sectionId
                        )!;
                        const covered = isCovered(r.sectionId);
                        const active = r.sectionId === selectedId;

                        return (
                          <button
                            type="button"
                            key={r.id}
                            onClick={() => focusSection(r.sectionId)}
                            aria-current={active ? "true" : undefined}
                            className={`block w-full border-b border-white/5 px-5 py-4 text-left outline-none transition last:border-b-0 focus-visible:bg-white/[0.04] ${
                              active
                                ? "bg-blue-500/[0.08] shadow-[inset_3px_0_0_0_rgb(96,165,250)]"
                                : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TYPE_STYLES[type].className}`}
                              >
                                {TYPE_STYLES[type].label}
                              </span>

                              <span
                                className={`flex items-center gap-1.5 text-[11px] ${
                                  covered ? "text-emerald-400" : "text-slate-500"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    covered ? "bg-emerald-400" : "bg-slate-600"
                                  }`}
                                />
                                {covered ? "Addressed" : "Not yet"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-200">
                              {r.text}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                              <ArrowRightIcon className="h-3 w-3" />
                              {section.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* CENTER: draft sections */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Draft sections
                  </h3>
                  <button
                    type="button"
                    onClick={jumpToNextIncomplete}
                    disabled={completeCount === totalSections}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/5 px-4 py-2 text-xs font-medium text-blue-200 transition hover:bg-blue-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-slate-500"
                  >
                    <BoltIcon />
                    Jump to next incomplete section
                    <span className="rounded-md bg-white/10 px-1.5 text-[10px] tabular-nums">
                      {leftToDo}
                    </span>
                  </button>
                </div>

                {sections.map((s, index) => {
                  const isSelected = s.id === selectedId;
                  const done = s.status === "complete";
                  const reqCount = mockProposalRequirements.filter(
                    (r) => r.sectionId === s.id
                  ).length;

                  return (
                    <div
                      id={`section-${s.id}`}
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`scroll-mt-28 rounded-2xl border p-5 shadow-xl shadow-black/10 transition ${
                        isSelected
                          ? "border-blue-400/30 bg-blue-500/[0.06] shadow-[inset_3px_0_0_0_rgb(96,165,250)]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ring-1 ring-inset ${
                              done
                                ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                                : "bg-white/[0.04] text-slate-400 ring-white/10"
                            }`}
                          >
                            {done ? <CheckIcon /> : index + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold">
                              {s.title}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Answers {reqCount} requirement
                              {reqCount !== 1 && "s"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <p className="text-xs tabular-nums text-slate-600">
                            {wordCount(s.content)} words
                          </p>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                              done
                                ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                                : "bg-slate-400/10 text-slate-300 ring-slate-400/20"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                done ? "bg-emerald-400" : "bg-slate-400"
                              }`}
                            />
                            {done ? "Complete" : "Draft"}
                          </span>
                        </div>
                      </div>

                      <label htmlFor={`text-${s.id}`} className="sr-only">
                        {s.title}
                      </label>
                      <textarea
                        id={`text-${s.id}`}
                        value={s.content}
                        readOnly={locked}
                        onFocus={() => setSelectedId(s.id)}
                        onChange={(e) =>
                          updateSection(s.id, {
                            content: e.target.value,
                            status:
                              s.status === "complete" && e.target.value === ""
                                ? "draft"
                                : s.status,
                          })
                        }
                        rows={s.content ? 5 : 3}
                        placeholder="Write this section, or insert a matching snippet from the right..."
                        className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-400/10 read-only:opacity-70"
                      />

                      <div className="mt-3 flex justify-end">
                        {done ? (
                          <button
                            type="button"
                            disabled={locked}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSection(s.id, { status: "draft" });
                            }}
                            className={btnGhost}
                          >
                            <UndoIcon />
                            Reopen section
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={locked || s.content.trim() === ""}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSection(s.id, { status: "complete" });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <CheckIcon />
                            Mark complete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RIGHT: snippets + issues */}
              <div className="space-y-6">
                {/* Snippets */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-xl shadow-black/20">
                  <div className="border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-semibold">
                      Matching past answers
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      For &ldquo;{selected.title}&rdquo; · from your own history
                    </p>
                  </div>

                  {snippets.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">
                      No matching snippets for this section.
                    </p>
                  ) : (
                    snippets.map((sn) => {
                      const used = inserted.has(sn.id);
                      return (
                        <div
                          key={sn.id}
                          className="border-b border-white/5 p-5 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${
                                OUTCOME_STYLES[sn.outcome]
                              }`}
                            >
                              {sn.outcome}
                            </span>
                            <span className="text-xs font-semibold tabular-nums text-blue-300">
                              {Math.round(sn.score * 100)}% match
                            </span>
                          </div>

                          <p className="mt-3 rounded-lg border-l-2 border-blue-400/40 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-300">
                            {sn.text}
                          </p>

                          <p className="mt-3 truncate text-xs font-medium text-slate-400">
                            {sn.tenderTitle}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                            <span className="truncate" title={sn.documentName}>
                              {sn.documentName}
                            </span>
                            <span className="shrink-0 text-slate-600">
                              · p.{sn.page} · ¶{sn.paragraph}
                            </span>
                          </p>

                          <button
                            type="button"
                            disabled={locked || used}
                            onClick={() => insertSnippet(sn.id, sn.text)}
                            className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                              used
                                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20"
                                : "bg-blue-500/10 text-blue-300 ring-blue-400/20 hover:bg-blue-500/20 focus-visible:ring-blue-400/50"
                            }`}
                          >
                            {used ? <CheckIcon /> : <PlusIcon />}
                            {used ? "Inserted" : "Insert into section"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Issues */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/10">
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-semibold">Open issues</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        openIssues.length === 0
                          ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                          : "bg-amber-400/10 text-amber-300 ring-amber-400/20"
                      }`}
                    >
                      {openIssues.length === 0
                        ? "All resolved"
                        : `${openIssues.length} open`}
                    </span>
                  </div>

                  {issues.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-start gap-3 border-b border-white/5 px-5 py-4 last:border-b-0"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={i.resolved}
                        aria-label={
                          i.resolved ? "Mark as open" : "Mark as resolved"
                        }
                        disabled={locked}
                        onClick={() => toggleIssue(i.id)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed ${
                          i.resolved
                            ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                            : "border-white/20 hover:border-white/40"
                        }`}
                      >
                        {i.resolved && <CheckIcon className="h-3 w-3" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm leading-5 ${
                            i.resolved
                              ? "text-slate-600 line-through"
                              : "text-slate-200"
                          }`}
                        >
                          {i.text}
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                              SEVERITY_STYLES[i.severity].className
                            }`}
                          >
                            {SEVERITY_STYLES[i.severity].label}
                          </span>

                          <button
                            type="button"
                            onClick={() => focusSection(i.sectionId)}
                            className="inline-flex items-center gap-1 text-xs text-blue-400 transition hover:text-blue-300"
                          >
                            Go to section
                            <ArrowRightIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Approve bar */}
            <div className="sticky bottom-4 z-20 mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#0a0f1c]/85 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
              <div className="min-w-0 sm:flex-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {approved
                    ? "Proposal approved"
                    : readyToApprove
                    ? "Ready to approve"
                    : "Finish the draft first"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {approved
                    ? "The proposal is locked and ready to export."
                    : readyToApprove
                    ? "All sections are complete and no issues are open."
                    : `${leftToDo} section${
                        leftToDo !== 1 ? "s" : ""
                      } and ${openIssues.length} issue${
                        openIssues.length !== 1 ? "s" : ""
                      } left before approval.`}
                </p>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10 sm:max-w-md">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      readyToApprove
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                        : "bg-gradient-to-r from-blue-500 to-cyan-300"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {canApprove ? (
                <button
                  type="button"
                  disabled={!readyToApprove || approved}
                  onClick={() => setApproved(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-300 hover:to-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none"
                >
                  {approved && <CheckIcon />}
                  {approved ? "Approved" : "Approve proposal"}
                </button>
              ) : (
                <p className="text-xs text-slate-500 sm:max-w-[200px] sm:text-right">
                  Only a Reviewer or Admin can approve the proposal.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}