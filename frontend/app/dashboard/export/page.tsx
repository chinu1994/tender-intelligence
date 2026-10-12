"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary } from "@/lib/api";
import {
  docxOptions,
  docxOutline,
  docxTemplates,
  mockExportCases,
  mockExportHistory,
  xlsxSheets,
  type ExportRecord,
  type XlsxSheet,
} from "@/lib/mock/export";

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

const AlertIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v4m0 3h.01" />
  </svg>
);

const DownloadIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4" />
    <path d="M5 19h14" />
  </svg>
);

const DocIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7M8.5 17h5" />
  </svg>
);

const TableIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M3.5 15h17M9.5 4.5v15" />
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

const CloseIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/* ---------------------------- Helpers ----------------------------- */

type Format = "docx" | "xlsx";

type Job = {
  state: "idle" | "running" | "ready";
  progress: number;
  record?: ExportRecord;
};

const IDLE: Record<Format, Job> = {
  docx: { state: "idle", progress: 0 },
  xlsx: { state: "idle", progress: 0 },
};

const FORMAT_STYLES: Record<Format, { label: string; badge: string; icon: string }> = {
  docx: {
    label: "DOCX",
    badge: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    icon: "bg-blue-400/10 text-blue-400 ring-blue-400/20",
  },
  xlsx: {
    label: "XLSX",
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    icon: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
  },
};

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-40";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none";

const panel =
  "overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-xl shadow-black/20";

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

/* ------------------------------ Page ------------------------------ */

export default function ExportPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [caseId, setCaseId] = useState(mockExportCases[0].id);
  const [template, setTemplate] = useState(docxTemplates[0].id);
  const [options, setOptions] = useState<Set<string>>(
    new Set(docxOptions.filter((o) => o.defaultOn).map((o) => o.id))
  );
  const [sheets, setSheets] = useState<Set<XlsxSheet["id"]>>(
    new Set(xlsxSheets.map((s) => s.id))
  );
  const [jobs, setJobs] = useState<Record<Format, Job>>(IDLE);
  const [history, setHistory] = useState<ExportRecord[]>(mockExportHistory);
  const [notice, setNotice] = useState("");
  const timers = useRef<Partial<Record<Format, ReturnType<typeof setInterval>>>>({});

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

  // stop any running fake export when leaving the page
  useEffect(() => {
    const running = timers.current;
    return () => {
      Object.values(running).forEach((t) => t && clearInterval(t));
    };
  }, []);

  const selectedCase = mockExportCases.find((c) => c.id === caseId) ?? mockExportCases[0];
  const isDraft = selectedCase.proposalState === "draft";
  const rowsOf = (id: XlsxSheet["id"]) =>
    id === "positions"
      ? selectedCase.positions
      : id === "lots"
      ? selectedCase.lots
      : selectedCase.requirements;

  const sectionsLeft = selectedCase.sectionsTotal - selectedCase.sectionsComplete;
  const checks = [
    {
      ok: selectedCase.proposalState === "approved",
      label: "Proposal approved",
      detail:
        selectedCase.proposalState === "approved"
          ? "Approved by a reviewer"
          : "Not approved yet. DOCX will be marked DRAFT.",
    },
    {
      ok: sectionsLeft === 0,
      label: "All sections complete",
      detail: `${selectedCase.sectionsComplete} of ${selectedCase.sectionsTotal} sections complete`,
    },
    {
      ok: selectedCase.openIssues === 0,
      label: "No open issues",
      detail:
        selectedCase.openIssues === 0
          ? "All issues resolved"
          : `${selectedCase.openIssues} issue${selectedCase.openIssues !== 1 ? "s" : ""} still open`,
    },
  ];

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  function changeCase(id: string) {
    Object.values(timers.current).forEach((t) => t && clearInterval(t));
    timers.current = {};
    setJobs(IDLE);
    setNotice("");
    setCaseId(id);
  }

  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function startExport(format: Format) {
    const existing = timers.current[format];
    if (existing) clearInterval(existing);

    const version =
      history.filter((h) => h.caseId === selectedCase.id && h.format === format).length + 1;

    const fileName =
      format === "docx"
        ? `${selectedCase.id}_proposal_${isDraft ? "DRAFT_" : ""}v${version}.docx`
        : `${selectedCase.id}_tender_data_v${version}.xlsx`;

    const sizeKb =
      format === "docx"
        ? 180 + options.size * 45 + selectedCase.requirements * 3
        : 30 +
          [...sheets].reduce((n, id) => n + rowsOf(id), 0);

    const record: ExportRecord = {
      id: `x-${Date.now()}-${format}`,
      caseId: selectedCase.id,
      format,
      fileName,
      size: `${Math.round(sizeKb)} KB`,
      by: user?.email ?? "you",
      createdAt: "Just now",
      draft: format === "docx" && isDraft,
    };

    setNotice("");
    setJobs((cur) => ({ ...cur, [format]: { state: "running", progress: 4 } }));

    timers.current[format] = setInterval(() => {
      setJobs((cur) => {
        const next = Math.min(100, cur[format].progress + 9 + Math.round(Math.random() * 12));
        if (next < 100) return { ...cur, [format]: { state: "running", progress: next } };
        return { ...cur, [format]: { state: "ready", progress: 100, record } };
      });
    }, 350);
  }

  // when a job reaches "ready", stop its timer and add it to the history once
  useEffect(() => {
    (Object.keys(jobs) as Format[]).forEach((format) => {
      const job = jobs[format];
      if (job.state === "ready" && job.record) {
        const t = timers.current[format];
        if (t) {
          clearInterval(t);
          delete timers.current[format];
          const rec = job.record;
          setHistory((cur) => (cur.some((h) => h.id === rec.id) ? cur : [rec, ...cur]));
        }
      }
    });
  }, [jobs]);

  function fakeDownload(fileName: string) {
    // STATIC DESIGN: no API yet
    setNotice(`"${fileName}" would download here once the export API is connected.`);
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

  const caseHistory = history.filter((h) => h.caseId === selectedCase.id);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      <AmbientBackground />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar active="Proposal" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Export
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
            {/* Case + readiness */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
                <div className="min-w-0 lg:max-w-md">
                  <label
                    htmlFor="export-case"
                    className="text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Tender case
                  </label>

                  <div className="relative mt-2">
                    <select
                      id="export-case"
                      value={caseId}
                      onChange={(e) => changeCase(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-[#0b1220] py-3 pl-4 pr-10 text-sm font-medium text-white outline-none transition hover:border-white/20 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-400/10"
                    >
                      {mockExportCases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} · {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        isDraft
                          ? "bg-violet-400/10 text-violet-300 ring-violet-400/20"
                          : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isDraft ? "bg-violet-400" : "bg-emerald-400"
                        }`}
                      />
                      {isDraft ? "Proposal draft" : "Proposal approved"}
                    </span>
                    <p className="text-xs text-slate-500">
                      {selectedCase.lots} lots · {selectedCase.positions} positions ·{" "}
                      {selectedCase.requirements} requirements
                    </p>
                  </div>
                </div>

                <ul className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
                  {checks.map((c) => (
                    <li
                      key={c.label}
                      className={`rounded-xl border p-4 ${
                        c.ok
                          ? "border-emerald-400/20 bg-emerald-400/5"
                          : "border-amber-400/20 bg-amber-400/5"
                      }`}
                    >
                      <p
                        className={`flex items-center gap-2 text-sm font-medium ${
                          c.ok ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {c.ok ? (
                          <CheckCircleIcon className="h-4 w-4 shrink-0" />
                        ) : (
                          <AlertIcon className="h-4 w-4 shrink-0" />
                        )}
                        {c.label}
                      </p>
                      <p className="mt-1.5 text-xs leading-5 text-slate-400">
                        {c.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {isDraft && (
                <p className="mt-5 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-amber-200">
                  <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    This proposal is not approved. You can still export, but the
                    DOCX is marked DRAFT and should not be submitted.
                  </span>
                </p>
              )}
            </div>

            {notice && (
              <div
                role="status"
                className="mt-4 flex items-start gap-3 rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm text-blue-200"
              >
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="flex-1">{notice}</p>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setNotice("")}
                  className="text-blue-200/70 transition hover:text-blue-100"
                >
                  <CloseIcon />
                </button>
              </div>
            )}

            {/* Two exports */}
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {/* DOCX */}
              <div className={panel}>
                <div className="flex items-start gap-4 border-b border-white/10 px-6 py-5">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${FORMAT_STYLES.docx.icon}`}
                  >
                    <DocIcon />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Proposal document</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      A formatted Word file built from the proposal sections.
                    </p>
                  </div>
                </div>

                <div className="space-y-6 p-6">
                  <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Template
                    </legend>
                    <div className="mt-3 space-y-2">
                      {docxTemplates.map((t) => (
                        <label
                          key={t.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                            template === t.id
                              ? "border-blue-400/40 bg-blue-500/[0.07]"
                              : "border-white/10 hover:bg-white/[0.03]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="template"
                            value={t.id}
                            checked={template === t.id}
                            onChange={() => setTemplate(t.id)}
                            className="mt-1 accent-blue-400"
                          />
                          <span>
                            <span className="block text-sm font-medium">{t.name}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {t.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Include
                    </legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {docxOptions.map((o) => {
                        const on = options.has(o.id);
                        return (
                          <label
                            key={o.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                              on
                                ? "border-blue-400/30 bg-blue-500/[0.05]"
                                : "border-white/10 hover:bg-white/[0.03]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setOptions((cur) => toggle(cur, o.id))}
                              className="mt-1 accent-blue-400"
                            />
                            <span>
                              <span className="block text-sm font-medium">{o.label}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {o.hint}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Document outline
                    </p>
                    <ol className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-[#0b1220] p-4 text-sm text-slate-300">
                      {options.has("cover") && (
                        <li className="text-slate-500">Cover page</li>
                      )}
                      {options.has("toc") && (
                        <li className="text-slate-500">Table of contents</li>
                      )}
                      {docxOutline.map((s, i) => (
                        <li key={s} className="flex gap-2">
                          <span className="w-4 tabular-nums text-slate-600">{i + 1}.</span>
                          {s}
                        </li>
                      ))}
                      {options.has("compliance") && (
                        <li className="text-slate-500">Appendix · Compliance table</li>
                      )}
                      {options.has("sources") && (
                        <li className="text-slate-500">Appendix · Source references</li>
                      )}
                    </ol>
                  </div>

                  <ExportAction
                    job={jobs.docx}
                    idleLabel={isDraft ? "Export draft DOCX" : "Export DOCX"}
                    runningLabel="Building document"
                    disabled={sectionsLeft === selectedCase.sectionsTotal}
                    disabledHint="Complete at least one proposal section first."
                    onStart={() => startExport("docx")}
                    onDownload={fakeDownload}
                  />
                </div>
              </div>

              {/* XLSX */}
              <div className={panel}>
                <div className="flex items-start gap-4 border-b border-white/10 px-6 py-5">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${FORMAT_STYLES.xlsx.icon}`}
                  >
                    <TableIcon />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Tender data workbook</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      An Excel file with positions, lots and the compliance matrix.
                    </p>
                  </div>
                </div>

                <div className="space-y-6 p-6">
                  <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Sheets
                    </legend>
                    <div className="mt-3 space-y-2">
                      {xlsxSheets.map((s) => {
                        const on = sheets.has(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`block cursor-pointer rounded-xl border p-4 transition ${
                              on
                                ? "border-emerald-400/30 bg-emerald-500/[0.05]"
                                : "border-white/10 hover:bg-white/[0.03]"
                            }`}
                          >
                            <span className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => setSheets((cur) => toggle(cur, s.id))}
                                className="mt-1 accent-emerald-400"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium">{s.name}</span>
                                  <span className="text-xs tabular-nums text-slate-500">
                                    {rowsOf(s.id)} rows
                                  </span>
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {s.description}
                                </span>
                                <span className="mt-3 flex flex-wrap gap-1.5">
                                  {s.columns.map((col) => (
                                    <span
                                      key={col}
                                      className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400"
                                    >
                                      {col}
                                    </span>
                                  ))}
                                </span>
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <ExportAction
                    job={jobs.xlsx}
                    idleLabel="Export XLSX"
                    runningLabel="Building workbook"
                    disabled={sheets.size === 0}
                    disabledHint="Select at least one sheet."
                    onStart={() => startExport("xlsx")}
                    onDownload={fakeDownload}
                  />
                </div>
              </div>
            </div>

            {/* History */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/10">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h2 className="text-base font-semibold">Export history</h2>
                <span className="text-xs text-slate-500">
                  {selectedCase.id} · {caseHistory.length} file
                  {caseHistory.length !== 1 && "s"}
                </span>
              </div>

              {caseHistory.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                    <DownloadIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-slate-300">No exports yet</p>
                  <p className="text-xs text-slate-500">
                    Files you export for this case will be listed here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]">
                    {caseHistory.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-4 border-b border-white/5 px-6 py-4 transition last:border-b-0 hover:bg-white/[0.03]"
                      >
                        <span
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${FORMAT_STYLES[h.format].badge}`}
                        >
                          {FORMAT_STYLES[h.format].label}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100" title={h.fileName}>
                            {h.fileName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {h.by} · {h.createdAt} · {h.size}
                          </p>
                        </div>

                        {h.draft && (
                          <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-inset ring-violet-400/20">
                            Draft
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => fakeDownload(h.fileName)}
                          className={btnGhost}
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------ Export action block ------------------------ */

function ExportAction({
  job,
  idleLabel,
  runningLabel,
  disabled,
  disabledHint,
  onStart,
  onDownload,
}: {
  job: Job;
  idleLabel: string;
  runningLabel: string;
  disabled: boolean;
  disabledHint: string;
  onStart: () => void;
  onDownload: (fileName: string) => void;
}) {
  if (job.state === "running") {
    return (
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-300">
            <SpinnerIcon className="h-4 w-4 text-blue-400" />
            {runningLabel}...
          </span>
          <span className="tabular-nums text-slate-500">{job.progress}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-all duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (job.state === "ready" && job.record) {
    return (
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircleIcon className="h-4 w-4" />
          Export ready
        </p>
        <p className="mt-1 truncate text-xs text-slate-400" title={job.record.fileName}>
          {job.record.fileName} · {job.record.size}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDownload(job.record!.fileName)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-300 hover:to-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Download
          </button>
          <button type="button" onClick={onStart} className={btnGhost}>
            <CheckIcon />
            Export again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onStart} disabled={disabled} className={`${btnPrimary} w-full`}>
        <DownloadIcon />
        {idleLabel}
      </button>
      {disabled && <p className="mt-2 text-center text-xs text-slate-500">{disabledHint}</p>}
    </div>
  );
}