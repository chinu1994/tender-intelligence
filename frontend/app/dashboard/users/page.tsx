"use client";

import { useEffect, useState } from "react";
import { getDashboardSummary, getUsers, setUserActive, updateUserRole } from "@/lib/api";
import Sidebar from "@/components/dashboard/Sidebar";
type CurrentUser = {
  id: string;
  email: string;
  role: string;
};

type User = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
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

const PlusIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
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

const SpinnerIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={`animate-spin ${className}`}>
    <path d="M21 12a9 9 0 11-6.2-8.55" />
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

const GRID = "grid grid-cols-[minmax(0,1fr)_200px_130px] items-center gap-4";

const ROLE_STYLES: Record<string, { badge: string; dot: string }> = {
  admin: {
    badge: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    dot: "bg-violet-400",
  },
  editor: {
    badge: "bg-blue-400/10 text-blue-300 ring-blue-400/20",
    dot: "bg-blue-400",
  },
  reviewer: {
    badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    dot: "bg-amber-400",
  },
};

const DEFAULT_ROLE_STYLE = {
  badge: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
  dot: "bg-slate-400",
};

/* ------------------------------ Page ------------------------------ */

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsersPage() {
      try {
        const [dashboardData, usersData] = await Promise.all([
          getDashboardSummary(),
          getUsers(),
        ]);

        setCurrentUser(dashboardData.user);
        setUsers(usersData);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load users"
        );
      } finally {
        setLoading(false);
      }
    }

    loadUsersPage();
  }, []);

  async function handleRoleChange(
    userId: string,
    newRole: string
  ) {
    try {
      setUpdatingUserId(userId);

      await updateUserRole(userId, newRole);

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                role: newRole,
              }
            : user
        )
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update user role"
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleActiveToggle(userId: string, isActive: boolean) {
    try {
      setUpdatingUserId(userId);
      await setUserActive(userId, isActive);
      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === userId ? { ...user, is_active: isActive } : user))
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update user status");
    } finally {
      setUpdatingUserId(null);
    }
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
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
        <Sidebar active="Users" user={currentUser} onSignOut={signOut} />
        {/* Main */}
        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#070b14]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Users
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{currentUser.email}</p>

                  <p className="text-xs capitalize text-slate-500">
                    {currentUser.role}
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  window.location.href = "/dashboard/users/new";
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-300 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
              >
                <PlusIcon />
                Create user
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">
                Workspace users
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Manage the people who have access to this TenderIQ workspace.
              </p>
            </div>

            {loading && (
              <div
                role="status"
                className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-sm text-slate-400"
              >
                <SpinnerIcon className="h-5 w-5 text-blue-400" />
                Loading users...
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm leading-6 text-red-300"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20">
                <div className="overflow-x-auto">
                  <div className="min-w-[680px]">
                    {/* Table header */}
                    <div
                      className={`${GRID} border-b border-white/10 bg-white/[0.02] px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500`}
                    >
                      <div>User</div>
                      <div>Role</div>
                      <div>Status</div>
                    </div>

                    {/* Users */}
                    {users.map((user) => {
                      const isCurrentUser = currentUser?.id === user.id;
                      const roleStyle =
                        ROLE_STYLES[user.role] ?? DEFAULT_ROLE_STYLE;
                      const isUpdating = updatingUserId === user.id;

                      return (
                        <div
                          key={user.id}
                          className={`${GRID} border-b border-white/5 px-6 py-5 transition-colors last:border-b-0 hover:bg-white/[0.03]`}
                        >
                          {/* User */}
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/15 text-sm font-semibold text-blue-100 ring-1 ring-inset ring-white/10">
                              {user.email.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-medium text-slate-100"
                                title={user.email}
                              >
                                {user.email}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Created{" "}
                                {new Date(
                                  user.created_at
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {/* Role */}
                          <div>
                            {isCurrentUser ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium capitalize ring-1 ring-inset ${roleStyle.badge}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${roleStyle.dot}`}
                                  />
                                  {user.role}
                                </span>

                                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                  You
                                </span>
                              </div>
                            ) : (
                              <div className="relative inline-block">
                                <select
                                  value={user.role}
                                  disabled={isUpdating}
                                  onChange={(event) =>
                                    handleRoleChange(
                                      user.id,
                                      event.target.value
                                    )
                                  }
                                  aria-label={`Role for ${user.email}`}
                                  className="w-36 appearance-none rounded-xl border border-white/10 bg-[#0d1424] py-2 pl-3 pr-9 text-xs font-medium capitalize text-white outline-none transition hover:border-white/20 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="admin">Admin</option>

                                  <option value="editor">Editor</option>

                                  <option value="reviewer">Reviewer</option>
                                </select>

                                {isUpdating ? (
                                  <SpinnerIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-blue-400" />
                                ) : (
                                  <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Status */}
                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                                user.is_active
                                  ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                                  : "bg-red-400/10 text-red-300 ring-red-400/20"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  user.is_active
                                    ? "bg-emerald-400"
                                    : "bg-red-400"
                                }`}
                              />
                              {user.is_active ? "Active" : "Inactive"}
                            </span>
                            {!isCurrentUser && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActiveToggle(user.id, !user.is_active)}
                                className="ml-2 text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
                              >
                                {user.is_active ? "Deactivate" : "Activate"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
