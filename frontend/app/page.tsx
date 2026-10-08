"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
const [isLoggedIn, setIsLoggedIn] = useState(false);

useEffect(() => {
const accessToken = localStorage.getItem("access_token");
const refreshToken = localStorage.getItem("refresh_token");

setIsLoggedIn(
  Boolean(accessToken && refreshToken)
);

}, []);

function handleLogout() {
localStorage.removeItem("access_token");
localStorage.removeItem("refresh_token");

setIsLoggedIn(false);

}

return ( <main className="min-h-screen bg-[#070B14] text-white">
{/* Header */} <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8"> <div className="flex items-center gap-3"> <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold shadow-lg shadow-blue-500/25">
T </div>


      <span className="text-xl font-semibold tracking-tight">
        Tender<span className="text-blue-400">IQ</span>
      </span>
    </div>

    <div className="flex items-center gap-3">
      {isLoggedIn ? (
        <>
          <Link
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            Dashboard
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
          >
            Create workspace
          </Link>
        </>
      )}
    </div>
  </header>

  {/* Hero */}
  <section className="relative overflow-hidden">
    {/* Background glow */}
    <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]" />

    <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm text-blue-300">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          AI-powered tender management
        </div>

        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Turn complex tenders into
          <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
            confident bids.
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
          TenderIQ helps teams understand tender documents, extract
          requirements, analyze opportunities, and build stronger
          proposals — all in one place.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href={isLoggedIn ? "/dashboard" : "/register"}
            className="rounded-xl bg-blue-500 px-7 py-3.5 text-sm font-semibold shadow-xl shadow-blue-500/20 transition hover:bg-blue-400"
          >
            {isLoggedIn
              ? "Open dashboard →"
              : "Create workspace →"}
          </Link>

          {!isLoggedIn && (
            <Link
              href="/login"
              className="rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Product preview */}
      <div className="mx-auto mt-20 max-w-6xl">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1321] shadow-2xl shadow-blue-950/40">
          {/* Window bar */}
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <span className="h-3 w-3 rounded-full bg-red-400/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
            <span className="h-3 w-3 rounded-full bg-green-400/70" />

            <div className="ml-6 h-7 flex-1 rounded-md bg-white/5" />
          </div>

          <div className="grid min-h-[400px] grid-cols-[190px_1fr]">
            {/* Sidebar */}
            <aside className="hidden border-r border-white/10 p-5 sm:block">
              <div className="mb-8 flex items-center gap-2 text-sm font-semibold">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-xs">
                  T
                </div>
                TenderIQ
              </div>

              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-blue-500/15 px-3 py-2 text-blue-300">
                  Dashboard
                </div>
                <div className="px-3 py-2 text-slate-500">
                  Opportunities
                </div>
                <div className="px-3 py-2 text-slate-500">
                  Documents
                </div>
                <div className="px-3 py-2 text-slate-500">
                  AI Analysis
                </div>
                <div className="px-3 py-2 text-slate-500">
                  Proposals
                </div>
              </div>
            </aside>

            {/* Dashboard preview */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Overview</p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Good morning 👋
                  </h2>
                </div>

                <div className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 sm:block">
                  Last 30 days
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs text-slate-500">
                    Active tenders
                  </p>
                  <p className="mt-2 text-3xl font-semibold">24</p>
                  <p className="mt-2 text-xs text-emerald-400">
                    +12.5% this month
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs text-slate-500">
                    Requirements
                  </p>
                  <p className="mt-2 text-3xl font-semibold">186</p>
                  <p className="mt-2 text-xs text-blue-400">
                    AI extracted
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs text-slate-500">
                    Win readiness
                  </p>
                  <p className="mt-2 text-3xl font-semibold">78%</p>
                  <p className="mt-2 text-xs text-amber-400">
                    6 need review
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Recent opportunities
                  </p>
                  <span className="text-xs text-blue-400">
                    View all →
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ["Government Infrastructure RFP", "92%", "High"],
                    ["Digital Transformation Project", "81%", "Medium"],
                    ["Enterprise Security Platform", "74%", "Medium"],
                  ].map(([name, score, priority]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-slate-200">
                          {name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          AI readiness score
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-blue-300">
                          {score}
                        </p>
                        <p className="text-xs text-slate-500">
                          {priority}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* Features */}
  <section className="border-t border-white/10 bg-[#090E18]">
    <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-blue-400">
          Everything in one workspace
        </p>

        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          From tender document to proposal.
        </h2>

        <p className="mt-4 text-slate-400">
          A single workspace for your entire tender response process.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[
          {
            title: "Smart document analysis",
            description:
              "Extract requirements, deadlines, eligibility criteria, and important tender information automatically.",
            icon: "✦",
          },
          {
            title: "AI-powered insights",
            description:
              "Understand opportunities faster with structured analysis and intelligent requirement matching.",
            icon: "⌁",
          },
          {
            title: "Proposal workspace",
            description:
              "Organize your responses and prepare professional proposal documents from one place.",
            icon: "◇",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:bg-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg text-blue-400">
              {feature.icon}
            </div>

            <h3 className="mt-5 text-lg font-semibold">
              {feature.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* Footer */}
  <footer className="border-t border-white/10">
    <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <p>© 2026 TenderIQ. All rights reserved.</p>
      <p>Intelligent tender management.</p>
    </div>
  </footer>
</main>

);
}
