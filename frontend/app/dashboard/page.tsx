"use client";

import { useEffect, useState } from "react";
import { getDashboardSummary } from "@/lib/api";
import Sidebar from "@/components/dashboard/Sidebar";
type DashboardData = {
  user: {
    id: string;
    email: string;
    role: string;
  };
  company: {
    id: string;
    name: string;
  };
  stats: {
    opportunities: number;
    documents: number;
    requirements: number;
  };
};

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

const HomeIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const UsersIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0113 0" />
    <path d="M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5" />
  </svg>
);

const FolderIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

const FileIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const DatabaseIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);

const CheckSquareIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 12.5l3 3 5-6" />
  </svg>
);

const PencilIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

const CasesIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    <path d="M3 13h18" />
  </svg>
);

const LogoutIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" />
    <path d="M16 8l4 4-4 4M20 12H9" />
  </svg>
);

const AlertIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5m0 3h.01" />
  </svg>
);

const SpinnerIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={`animate-spin ${className}`}>
    <path d="M21 12a9 9 0 11-6.2-8.55" />
  </svg>
);

const PlusIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: HomeIcon, active: true },
  { href: "/dashboard/users", label: "Users", Icon: UsersIcon },
  { href: "/dashboard/opportunities", label: "Opportunities", Icon: FolderIcon },
  { href: "/dashboard/documents", label: "Documents", Icon: FileIcon },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", Icon: DatabaseIcon },
  { href: "/dashboard/requirements", label: "Requirements", Icon: CheckSquareIcon },
  { href: "/dashboard/review", label: "Review", Icon: PencilIcon },
  { href: "/dashboard/proposal", label: "Proposal", Icon: FileIcon },
  { href: "/dashboard/cases", label: "Cases", Icon: CasesIcon },

] as const;

function signOut() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/";
}

function AmbientBackground() {
  return (
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
  );
}

/* ------------------------------ Page ------------------------------ */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const result = await getDashboardSummary();
        setData(result);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  /* ---------- Loading ---------- */

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <AmbientBackground />

        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div
            role="status"
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-400/20">
              <SpinnerIcon />
            </div>
            <div className="text-xl font-bold tracking-tight">
              Tender<span className="text-blue-400">IQ</span>
            </div>
            <p className="text-sm text-slate-400">
              Loading your dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- Error ---------- */

  if (error || !data) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
        <AmbientBackground />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div
            role="alert"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 text-center shadow-2xl shadow-black/40"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-400/10 text-red-400 ring-1 ring-inset ring-red-400/20">
              <AlertIcon />
            </div>

            <h1 className="mt-5 text-xl font-semibold tracking-tight">
              Unable to load dashboard
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {error || "Something went wrong."}
            </p>

            <button
              onClick={signOut}
              className="mt-6 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
            >
              Back to login
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- Stats config ---------- */

  const STATS = [
    {
      label: "Opportunities",
      value: data.stats.opportunities,
      hint: "Tender opportunities in your workspace",
      Icon: FolderIcon,
      iconWrap: "bg-blue-400/10 text-blue-400 ring-blue-400/20",
      text: "text-blue-400",
    },
    {
      label: "Documents",
      value: data.stats.documents,
      hint: "Tender documents uploaded",
      Icon: FileIcon,
      iconWrap: "bg-violet-400/10 text-violet-400 ring-violet-400/20",
      text: "text-violet-400",
    },
    {
      label: "Requirements",
      value: data.stats.requirements,
      hint: "Requirements identified from tenders",
      Icon: CheckSquareIcon,
      iconWrap: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
      text: "text-emerald-400",
    },
  ];

  /* ---------- Dashboard ---------- */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      <AmbientBackground />

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <Sidebar active="Dashboard" user={data.user} onSignOut={signOut} />

        {/* Main content */}
        <section className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{data.user.email}</p>

                <p className="text-xs capitalize text-slate-500">
                  {data.user.role}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-semibold shadow-lg shadow-blue-500/20 ring-2 ring-white/10">
                {data.user.email.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
            {/* Welcome */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/20 via-white/[0.04] to-violet-500/10 p-8 shadow-xl shadow-black/20 sm:p-10">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.25]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                  maskImage:
                    "linear-gradient(to left, black, transparent 70%)",
                  WebkitMaskImage:
                    "linear-gradient(to left, black, transparent 70%)",
                }}
              />
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

              <div className="relative z-10 max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Welcome to TenderIQ
                </p>

                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Turn complex tenders into{" "}
                  <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">
                    confident bids.
                  </span>
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                  Your tender workspace is ready. As you add opportunities and
                  documents, TenderIQ will bring the important requirements
                  into one place.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STATS.map(({ label, value, hint, Icon, iconWrap, text }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">{label}</p>
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${iconWrap}`}
                    >
                      <Icon />
                    </span>
                  </div>

                  <p
                    className={`mt-4 text-4xl font-semibold tabular-nums ${text}`}
                  >
                    {value}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">{hint}</p>
                </div>
              ))}
            </div>

            {/* Getting started */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-400/20">
                    <FolderIcon className="h-5 w-5" />
                  </span>

                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      Your workspace is ready
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Start by adding your first tender opportunity.
                    </p>
                  </div>
                </div>

                <button
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-500"
                >
                  <PlusIcon />
                  Add opportunity
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
