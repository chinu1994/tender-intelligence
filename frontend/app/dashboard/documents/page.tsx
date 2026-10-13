"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  getDashboardSummary,
  getCases,
  getDocuments,
  uploadDocuments,
  type ApiDocument,
} from "@/lib/api";
import type { CaseItem } from "@/lib/cases";
import { timeAgo } from "@/lib/cases";

export type DocumentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DocumentType = "pdf" | "docx" | "xlsx" | "zip" | string;

export type TenderDocument = {
  id: string;
  name: string;
  type: DocumentType;
  size: string;
  status: DocumentStatus;
  stage: string;
  progress?: number;
  error?: string;
  uploadedAt: string;
  parentId?: string;
};

function mapApiDoc(d: ApiDocument): TenderDocument {
  const status = d.status as DocumentStatus;
  let stage = "Queued";
  if (status === "processing") stage = "Processing";
  else if (status === "completed") stage = "Indexed";
  else if (status === "failed") stage = d.processing_error || "Failed";
  else if (status === "pending") stage = "Pending";

  return {
    id: d.id,
    name: d.name,
    type: (d.file_type || "pdf").toLowerCase() as DocumentType,
    size: "—",
    status,
    stage,
    error: d.processing_error || undefined,
    uploadedAt: timeAgo(d.created_at),
  };
}

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
  <svg {...base} strokeWidth={3} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
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

const SearchIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
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

const ClockIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const CogIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M21 12a9 9 0 11-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
);

const CheckCircleIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const XIcon = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

const STATUS_STYLES: Record<
  DocumentStatus,
  { badge: string; dot: string; label: string }
> = {
  pending: {
    badge: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
    dot: "bg-slate-400",
    label: "Pending",
  },
  processing: {
    badge: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    dot: "bg-blue-400 animate-pulse",
    label: "Processing",
  },
  completed: {
    badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    dot: "bg-emerald-400",
    label: "Completed",
  },
  failed: {
    badge: "bg-red-400/10 text-red-300 ring-red-400/20",
    dot: "bg-red-400",
    label: "Failed",
  },
};

const TYPE_STYLES: Record<string, { label: string; className: string }> =  {
    pdf: {
      label: "PDF",
      className: "bg-red-500/10 text-red-300 ring-red-500/20",
    },
    docx: {
      label: "DOC",
      className: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
    },
    xlsx: {
      label: "XLS",
      className: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    },
    zip: {
      label: "ZIP",
      className: "bg-violet-500/10 text-violet-300 ring-violet-500/20",
    },
  };

const STATS = [
  {
    key: "pending",
    label: "Pending",
    text: "text-slate-300",
    iconWrap: "bg-slate-400/10 text-slate-300",
    bar: "bg-slate-400",
    ring: "ring-slate-400/40",
    Icon: ClockIcon,
  },
  {
    key: "processing",
    label: "Processing",
    text: "text-blue-400",
    iconWrap: "bg-blue-400/10 text-blue-400",
    bar: "bg-blue-400",
    ring: "ring-blue-400/40",
    Icon: CogIcon,
  },
  {
    key: "completed",
    label: "Completed",
    text: "text-emerald-400",
    iconWrap: "bg-emerald-400/10 text-emerald-400",
    bar: "bg-emerald-400",
    ring: "ring-emerald-400/40",
    Icon: CheckCircleIcon,
  },
  {
    key: "failed",
    label: "Failed",
    text: "text-red-400",
    iconWrap: "bg-red-400/10 text-red-400",
    bar: "bg-red-400",
    ring: "ring-red-400/40",
    Icon: AlertIcon,
  },
] as const;

const LIFECYCLE = [
  "New",
  "Analysis",
  "Review Required",
  "Proposal Draft",
  "Approved",
  "Completed",
];

const GRID =
  "grid grid-cols-[minmax(0,1fr)_70px_130px_220px_90px] items-center gap-4";

/* ------------------------------ Page ------------------------------ */

export default function DocumentsPage() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  /** Fatal load error only — never set this for upload failures. */
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | DocumentStatus>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUserAndCases() {
      try {
        const result = await getDashboardSummary();
        setUser(result.user);
        const caseList = await getCases();
        setCases(caseList);
        if (caseList.length > 0) setCaseId(caseList[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load user");
      } finally {
        setLoading(false);
      }
    }
    loadUserAndCases();
  }, []);

  useEffect(() => {
    if (!caseId) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    async function loadDocs() {
      setDocsLoading(true);
      try {
        const apiDocs = await getDocuments(caseId);
        if (!cancelled) setDocuments(apiDocs.map(mapApiDoc));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load documents");
        }
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    }
    loadDocs();
    const interval = setInterval(async () => {
      try {
        const apiDocs = await getDocuments(caseId);
        if (!cancelled) setDocuments(apiDocs.map(mapApiDoc));
      } catch { /* ignore */ }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [caseId]);

  const currentStage = 1;

  const counts = useMemo(() => {
    const c = { pending: 0, processing: 0, completed: 0, failed: 0 };
    documents.forEach((d) => { c[d.status] += 1; });
    return c;
  }, [documents]);

  const total = documents.length;

  const childCount = useMemo(() => {
    const m: Record<string, number> = {};
    documents.forEach((d) => {
      if (d.parentId) m[d.parentId] = (m[d.parentId] ?? 0) + 1;
    });
    return m;
  }, [documents]);

  const visible = documents.filter(
    (d) =>
      (statusFilter === "all" || d.status === statusFilter) &&
      d.name.toLowerCase().includes(search.toLowerCase()) &&
      !(d.parentId && collapsed.has(d.parentId))
  );

  const selectedCase = cases.find((c) => c.id === caseId);

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setQueuedFiles((prev) => [...prev, ...Array.from(files)]);
  }

  async function handleUpload() {
    if (!caseId || queuedFiles.length === 0) return;
    setUploading(true);
    setUploadError("");
    setUploadNotice("");
    try {
      const uploaded = await uploadDocuments(caseId, queuedFiles);
      setQueuedFiles([]);
      setUploadNotice(
        `${uploaded.length} file(s) uploaded. Status updates every few seconds while the worker processes them.`
      );
      const apiDocs = await getDocuments(caseId);
      setDocuments(apiDocs.map(mapApiDoc));
    } catch (err) {
      // Keep the page visible — show inline error near the upload box
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  function renderRow(doc: TenderDocument) {
const type = TYPE_STYLES[doc.type as keyof typeof TYPE_STYLES] ?? {
    label: (doc.type || "FILE").toUpperCase().slice(0, 4),
    className: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
  };    const status = STATUS_STYLES[doc.status];
    const isChild = Boolean(doc.parentId);
    const kids = childCount[doc.id] ?? 0;
    const isCollapsed = collapsed.has(doc.id);

    return (
      <div
        key={doc.id}
        className={`${GRID} group border-b border-white/5 px-6 py-4 transition-colors last:border-b-0 hover:bg-white/[0.03] ${
          isChild ? "bg-white/[0.012]" : ""
        }`}
      >
        {/* Name */}
        <div
          className={`relative flex min-w-0 items-center gap-3 ${
            isChild ? "pl-9" : ""
          }`}
        >
          {isChild && (
            <span className="absolute left-3 -top-6 h-[42px] w-4 rounded-bl-xl border-b border-l border-white/15" />
          )}

          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ring-1 ring-inset ${type.className}`}
          >
            {type.label}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className="truncate text-sm font-medium text-slate-100"
                title={doc.name}
              >
                {doc.name}
              </p>

              {kids > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCollapse(doc.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? "Expand archive" : "Collapse archive"}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                >
                  {kids} files
                  <ChevronIcon
                    className={`h-3 w-3 transition-transform ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {doc.size} <span className="mx-1 text-slate-700">•</span>
              {doc.uploadedAt}
            </p>
          </div>
        </div>

        {/* Type */}
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {doc.type}
        </div>

        {/* Status */}
        <div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Stage / progress / error */}
        <div className="min-w-0">
          {doc.status === "processing" && doc.progress !== undefined ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="truncate text-slate-400">{doc.stage}</span>
                <span className="ml-2 font-medium tabular-nums text-blue-300">
                  {doc.progress}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-all duration-500"
                  style={{ width: `${doc.progress}%` }}
                />
              </div>
            </>
          ) : doc.status === "failed" ? (
            <p className="flex items-start gap-1.5 text-xs leading-5 text-red-300">
              <AlertIcon className="mt-1 h-3.5 w-3.5 shrink-0" />
              <span>{doc.error}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500">{doc.stage}</p>
          )}
        </div>

        {/* Action */}
        <div className="flex justify-end">
          {doc.status === "failed" && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
            >
              <RetryIcon />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
        >
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
        >
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
      >
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
        <Sidebar active="Documents" user={user} onSignOut={signOut} />

        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Documents
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
            {/* Case selector + lifecycle */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Case documents
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Upload tender files and track how they are processed.
                  </p>
                </div>

                <div className="relative">
                  <select
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    aria-label="Select case"
                    className="w-full appearance-none rounded-xl border border-white/10 bg-[#111827] py-2.5 pl-4 pr-10 text-sm text-white outline-none transition hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-auto sm:min-w-[260px]"
                  >
                   {cases.length === 0 && (
  <option value="">No cases yet — create one first</option>
)}
{cases.map((c) => (
  <option key={c.id} value={c.id}>
    {c.reference || c.id.slice(0, 8)} · {c.title}
  </option>
))}
                  </select>
                  <ChevronIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* Mobile current step */}
              <p className="mt-6 text-xs text-slate-400 md:hidden">
                Step {currentStage + 1} of {LIFECYCLE.length} ·{" "}
                <span className="font-medium text-blue-400">
                  {LIFECYCLE[currentStage]}
                </span>
              </p>

              {/* Stepper */}
              <ol className="mt-3 flex items-center md:mt-7">
                {LIFECYCLE.map((step, i) => {
                  const done = i < currentStage;
                  const active = i === currentStage;

                  return (
                    <li
                      key={step}
                      aria-current={active ? "step" : undefined}
                      className="flex flex-1 items-center last:flex-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                            done
                              ? "bg-emerald-400 text-emerald-950"
                              : active
                              ? "bg-blue-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.2),0_0_18px_rgba(59,130,246,0.5)]"
                              : "border border-white/15 bg-white/[0.03] text-slate-500"
                          }`}
                        >
                          {done ? <CheckIcon /> : i + 1}
                        </span>

                        <span
                          className={`hidden whitespace-nowrap text-xs md:inline ${
                            active
                              ? "font-semibold text-blue-300"
                              : done
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {step}
                        </span>
                      </div>

                      {i < LIFECYCLE.length - 1 && (
                        <div className="mx-3 h-px flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full bg-gradient-to-r from-emerald-400 to-emerald-400/60 transition-all ${
                              done ? "w-full" : "w-0"
                            }`}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Upload zone: native file input covers the whole box (click = browse) */}
            <div
              className={`group relative mt-6 overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                isDragging
                  ? "scale-[1.01] border-blue-400 bg-blue-500/[0.12]"
                  : "border-blue-400/25 bg-blue-500/[0.03] hover:border-blue-400/50 hover:bg-blue-500/[0.07]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              {/* Invisible input on top — browser opens picker on any click here */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.zip"
                aria-label="Choose tender documents"
                className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => {
                  const list = e.target.files;
                  if (list && list.length > 0) {
                    addFiles(list);
                  }
                  // reset so same file can be picked again
                  e.target.value = "";
                }}
              />

              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 z-0 h-32 w-72 -translate-x-1/2 rounded-full bg-blue-500/20 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
              />

              <div className="pointer-events-none relative z-10">
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-400 ring-1 ring-inset ring-blue-400/20 transition-transform duration-300 ${
                    isDragging
                      ? "-translate-y-1 scale-110"
                      : "group-hover:-translate-y-0.5"
                  }`}
                >
                  <UploadIcon className="h-6 w-6" />
                </div>

                <p className="mt-4 text-base font-medium">
                  {isDragging
                    ? "Drop files to add them"
                    : "Click or drag & drop tender files here"}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  or{" "}
                  <span className="font-medium text-blue-400 underline underline-offset-4">
                    browse files
                  </span>{" "}
                  · multiple files supported
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  {["PDF", "DOCX", "XLSX", "ZIP"].map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-medium text-slate-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  ZIP archives are unpacked automatically and every file is
                  attached to{" "}
                  {selectedCase
                    ? `case “${selectedCase.title || selectedCase.id}”`
                    : "this case"}
                  .
                  {!caseId && (
                    <span className="ml-1 text-amber-400">
                      Create a tender case first — upload is disabled without a
                      case.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {uploadError && (
              <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                {uploadError}
              </p>
            )}
            {uploadNotice && (
              <p className="mt-3 rounded-lg border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-xs text-blue-200">
                {uploadNotice}
              </p>
            )}

            {/* Queue + Upload button — outside the file input overlay */}
            {queuedFiles.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium text-slate-400">
                  {queuedFiles.length} file
                  {queuedFiles.length > 1 ? "s" : ""} ready to upload
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {queuedFiles.map((file, i) => (
                    <span
                      key={`${file.name}-${i}-${file.size}`}
                      className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] py-1 pl-2.5 pr-1.5 text-xs text-slate-200"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setQueuedFiles((q) =>
                            q.filter((_, idx) => idx !== i)
                          )
                        }
                        className="rounded p-0.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={uploading || !caseId}
                    onClick={handleUpload}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading
                      ? "Uploading…"
                      : `Upload ${queuedFiles.length} file${queuedFiles.length > 1 ? "s" : ""}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueuedFiles([])}
                    disabled={uploading}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Stats (click to filter) */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map(({ key, label, text, iconWrap, bar, ring, Icon }) => {
                const active = statusFilter === key;
                const pct = total ? Math.round((counts[key] / total) * 100) : 0;

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setStatusFilter(active ? "all" : key)}
                    aria-pressed={active}
                    className={`rounded-2xl border bg-white/[0.03] p-5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                      active
                        ? `border-transparent ring-2 ${ring}`
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400">{label}</p>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconWrap}`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <p
                        className={`text-3xl font-semibold tabular-nums ${text}`}
                      >
                        {counts[key]}
                      </p>
                      <p className="text-xs text-slate-600">of {total}</p>
                    </div>

                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Documents list */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20">
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-6 py-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold">Uploaded files</h3>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    Live
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {/* Segmented filter */}
                  <div
                    role="tablist"
                    aria-label="Filter by status"
                    className="flex overflow-x-auto rounded-xl border border-white/10 bg-[#0d1424] p-1"
                  >
                    {(
                      ["all", "pending", "processing", "completed", "failed"] as const
                    ).map((s) => {
                      const active = statusFilter === s;
                      const n = s === "all" ? total : counts[s];

                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                            active
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {s}
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

                  {/* Search */}
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search documents..."
                      aria-label="Search documents"
                      className="w-full rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-9 pr-8 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-60"
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
                <div className="min-w-[880px]">
                  <div
                    className={`${GRID} border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500`}
                  >
                    <div>Name</div>
                    <div>Type</div>
                    <div>Status</div>
                    <div>Stage</div>
                    <div />
                  </div>

                  {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                        <SearchIcon className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium text-slate-300">
                        No documents found
                      </p>
                      <p className="text-xs text-slate-500">
                        Try a different search or reset the filters.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("all");
                        }}
                        className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.05]"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    visible.map(renderRow)
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-6 py-3 text-xs text-slate-500">
                <span>
                  Showing{" "}
                  <span className="font-medium text-slate-300">
                    {visible.length}
                  </span>{" "}
                  of {total} documents
                </span>
                {collapsed.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setCollapsed(new Set())}
                    className="text-blue-400 transition hover:text-blue-300"
                  >
                    Expand all archives
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