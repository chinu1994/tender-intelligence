"use client";

import { useEffect, useState } from "react";
import { getDashboardSummary, getUsers, updateUserRole } from "@/lib/api";

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

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0a0f1c] lg:flex lg:flex-col">

          <div className="border-b border-white/10 px-6 py-6">
            <div className="text-xl font-bold tracking-tight">
              Tender<span className="text-blue-400">IQ</span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Intelligent tender workspace
            </p>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">

            <a
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <span>⌂</span>
              Dashboard
            </a>

            <a
              href="/dashboard/users"
              className="flex items-center gap-3 rounded-xl bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-400"
            >
              <span>◉</span>
              Users
            </a>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
              <span>▣</span>
              Opportunities

              <span className="ml-auto text-[10px] uppercase tracking-wider">
                Soon
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
              <span>◫</span>
              Documents

              <span className="ml-auto text-[10px] uppercase tracking-wider">
                Soon
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
              <span>✓</span>
              Requirements

              <span className="ml-auto text-[10px] uppercase tracking-wider">
                Soon
              </span>
            </div>

          </nav>

          {/* Current user */}
          <div className="border-t border-white/10 p-4">

            {currentUser && (
              <div className="rounded-xl bg-white/[0.04] p-4">
                <p className="truncate text-sm font-medium">
                  {currentUser.email}
                </p>

                <p className="mt-1 text-xs capitalize text-slate-500">
                  {currentUser.role}
                </p>
              </div>
            )}

            <button
              onClick={signOut}
              className="mt-3 w-full rounded-xl px-4 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              Sign out
            </button>

          </div>
        </aside>

        {/* Main */}
        <section className="flex-1">

          {/* Header */}
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">

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
                  <p className="text-sm font-medium">
                    {currentUser.email}
                  </p>

                  <p className="text-xs capitalize text-slate-500">
                    {currentUser.role}
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  window.location.href = "/dashboard/users/new";
                }}
                className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
              >
                + Create user
              </button>

            </div>
          </header>

          {/* Content */}
          <div className="px-6 py-8 lg:px-10">

            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Workspace users
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage the people who have access to this TenderIQ workspace.
              </p>
            </div>

            {loading && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">
                Loading users...
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">

                {/* Table header */}
                <div className="grid grid-cols-[1fr_180px_120px] border-b border-white/10 px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <div>User</div>
                  <div>Role</div>
                  <div>Status</div>
                </div>

                {/* Users */}
                {users.map((user) => {
                  const isCurrentUser =
                    currentUser?.id === user.id;

                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-[1fr_180px_120px] items-center border-b border-white/5 px-6 py-5 last:border-b-0"
                    >

                      {/* User */}
                      <div>
                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-semibold">
                            {user.email.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <p className="text-sm font-medium">
                              {user.email}
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              Created{" "}
                              {new Date(
                                user.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>

                        </div>
                      </div>

                      {/* Role */}
                      <div>

                        {isCurrentUser ? (
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs capitalize text-slate-300">
                              {user.role}
                            </span>

                            <span className="text-[10px] text-slate-600">
                              You
                            </span>
                          </div>
                        ) : (
                          <select
                            value={user.role}
                            disabled={
                              updatingUserId === user.id
                            }
                            onChange={(event) =>
                              handleRoleChange(
                                user.id,
                                event.target.value
                              )
                            }
                            className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs capitalize text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="admin">
                              Admin
                            </option>

                            <option value="editor">
                              Editor
                            </option>

                            <option value="reviewer">
                              Reviewer
                            </option>
                          </select>
                        )}

                      </div>

                      {/* Status */}
                      <div>
                        <span
                          className={
                            user.is_active
                              ? "text-xs text-emerald-400"
                              : "text-xs text-red-400"
                          }
                        >
                          {user.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                    </div>
                  );
                })}

              </div>
            )}

          </div>
        </section>
      </div>
    </main>
  );
}