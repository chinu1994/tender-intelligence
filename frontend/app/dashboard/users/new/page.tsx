"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

const ArrowLeftIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M19 12H5m0 0l6-6m-6 6l6 6" />
  </svg>
);

const ChevronIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const AlertIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5m0 3h.01" />
  </svg>
);

const CheckCircleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const SpinnerIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={`animate-spin ${className}`}>
    <path d="M21 12a9 9 0 11-6.2-8.55" />
  </svg>
);

const UserPlusIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0113 0" />
    <path d="M19 8v6M16 11h6" />
  </svg>
);

/* ---------------------------- Constants --------------------------- */

const ACTIVE_HREF = "/dashboard/users";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: HomeIcon },
  { href: "/dashboard/users", label: "Users", Icon: UsersIcon },
  { href: "/dashboard/opportunities", label: "Opportunities", Icon: FolderIcon },
  { href: "/dashboard/documents", label: "Documents", Icon: FileIcon },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", Icon: DatabaseIcon },
  { href: "/dashboard/requirements", label: "Requirements", Icon: CheckSquareIcon },
  { href: "/dashboard/review", label: "Review", Icon: PencilIcon },
  { href: "/dashboard/proposal", label: "Proposal", Icon: FileIcon },
  { href: "/dashboard/cases", label: "Cases", Icon: CasesIcon },
];

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10";

/* ------------------------------ Page ------------------------------ */

export default function CreateUserPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("reviewer");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");

      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to create user");
      }

      setSuccess("User created successfully.");

      setEmail("");
      setPassword("");
      setRole("reviewer");

      setTimeout(() => {
        router.push("/dashboard/users");
      }, 1000);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create user"
      );
    } finally {
      setLoading(false);
    }
  }

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
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/10 bg-[#0a0f1c]/90 p-6 backdrop-blur-xl lg:block">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold shadow-lg shadow-blue-500/25">
                T
              </span>
              <div className="text-2xl font-bold leading-none tracking-tight">
                Tender<span className="text-blue-400">IQ</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Turn complex tenders into confident bids.
            </p>
          </div>

          <nav aria-label="Main navigation" className="space-y-1">
            {NAV.map(({ href, label, Icon }) => {
              const active = href === ACTIVE_HREF;

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                    active
                      ? "bg-blue-500/10 font-medium text-blue-300"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400" />
                  )}
                  <Icon
                    className={`h-[18px] w-[18px] transition ${
                      active
                        ? "text-blue-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/dashboard/users"
                className="group inline-flex items-center gap-2 rounded-lg text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
              >
                <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Back to Users
              </Link>

              <div className="mt-6 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-400/20">
                  <UserPlusIcon className="h-6 w-6" />
                </span>

                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Create New User
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Add a new team member to your TenderIQ workspace.
                  </p>
                </div>
              </div>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-2xl shadow-black/30 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="user@company.com"
                    required
                    className={inputCls}
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Temporary password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    className={inputCls}
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    The user will use this password to sign in.
                  </p>
                </div>

                {/* Role */}
                <div>
                  <label
                    htmlFor="role"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Role
                  </label>

                  <div className="relative">
                    <select
                      id="role"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      className={`${inputCls} appearance-none pr-10`}
                    >
                      <option value="reviewer">Reviewer</option>

                      <option value="editor">Editor</option>

                      <option value="admin">Admin</option>
                    </select>

                    <ChevronIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Choose the permissions this user should have.
                  </p>
                </div>

                {/* Messages */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                  >
                    <AlertIcon className="mt-1 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {success && (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-300"
                  >
                    <CheckCircleIcon className="mt-1 h-4 w-4 shrink-0" />
                    <p>{success}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
                  <Link
                    href="/dashboard/users"
                    className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                  >
                    {loading && <SpinnerIcon />}
                    {loading ? "Creating user..." : "Create user"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
