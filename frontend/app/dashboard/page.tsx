"use client";

import { useEffect, useState } from "react";
import { getDashboardSummary } from "@/lib/api";

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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b14] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-slate-400">
            Loading your dashboard...
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#070b14] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <h1 className="text-xl font-semibold">
              Unable to load dashboard
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              {error || "Something went wrong."}
            </p>

            <button
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                window.location.href = "/login";
              }}
              className="mt-6 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Back to login
            </button>
          </div>
        </div>
      </main>
    );
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
              className="flex items-center gap-3 rounded-xl bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-400"
            >
              <span>⌂</span>
              Dashboard
            </a>
            <a
  href="/dashboard/users"
  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
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

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="truncate text-sm font-medium">
                {data.user.email}
              </p>

              <p className="mt-1 text-xs capitalize text-slate-500">
                {data.user.role}
              </p>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                window.location.href = "/login";
              }}
              className="mt-3 w-full rounded-xl px-4 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                Workspace
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">
                  {data.user.email}
                </p>

                <p className="text-xs capitalize text-slate-500">
                  {data.user.role}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold">
                {data.user.email.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-6 py-8 lg:px-10">

            {/* Welcome */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/15 via-white/[0.03] to-transparent p-8">
              <div className="relative z-10 max-w-2xl">
                <p className="text-sm font-medium text-blue-400">
                  Welcome to TenderIQ
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Turn complex tenders into confident bids.
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                  Your tender workspace is ready. As you add opportunities
                  and documents, TenderIQ will bring the important
                  requirements into one place.
                </p>
              </div>

              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            {/* Stats */}
            <div className="mt-8 grid gap-4 md:grid-cols-3">

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20">
                <p className="text-sm text-slate-500">
                  Opportunities
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {data.stats.opportunities}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Tender opportunities in your workspace
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20">
                <p className="text-sm text-slate-500">
                  Documents
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {data.stats.documents}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Tender documents uploaded
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20">
                <p className="text-sm text-slate-500">
                  Requirements
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {data.stats.requirements}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Requirements identified from tenders
                </p>
              </div>

            </div>

            {/* Getting started */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold">
                    Your workspace is ready
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Start by adding your first tender opportunity.
                  </p>
                </div>

                <button
                  disabled
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-500"
                >
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
