"use client";

import { useState } from "react";
import { loginUser } from "@/lib/api";
import Link from "next/link";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="min-h-screen bg-[#070B14] text-white">
      <div className="flex min-h-screen">
        {/* Left side - Brand */}
        <section className="relative hidden overflow-hidden lg:flex lg:w-1/2">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-500/10" />

          <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
            <div>
              <a href="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold shadow-lg shadow-blue-500/25">
                  T
                </div>

                <span className="text-xl font-semibold tracking-tight">
                  Tender<span className="text-blue-400">IQ</span>
                </span>
              </a>
            </div>

            <div className="max-w-xl">
              <p className="mb-5 text-sm font-medium text-blue-400">
                INTELLIGENT TENDER MANAGEMENT
              </p>

              <h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
                Turn complex tenders into
                <span className="block text-blue-400">
                  confident bids.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
                Analyze tender documents, understand requirements, and
                prepare stronger proposals from one intelligent workspace.
              </p>
            </div>

            <p className="text-sm text-slate-600">
              TenderIQ
            </p>
          </div>
        </section>

        {/* Right side - Login */}
        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="mb-12 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold">
                T
              </div>

              <span className="text-xl font-semibold">
                Tender<span className="text-blue-400">IQ</span>
              </span>
            </div>

            <div>
              <p className="text-sm font-medium text-blue-400">
                WELCOME BACK
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                Sign in to TenderIQ
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Access your tender workspace and continue where you left off.
              </p>
            </div>

          <form
  className="mt-8 space-y-5"
  onSubmit={async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data = await loginUser(email, password);

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem(
  "refresh_token",
  data.refresh_token
);

      window.location.href = "/dashboard";
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in"
      );
    } finally {
      setLoading(false);
    }
  }}
>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Password
                  </label>

            <Link
  href="/forgot-password"
  className="text-sm text-cyan-300 transition hover:text-cyan-200"
>
  Forgot password?
</Link>
                </div>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            {error && (
  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
    {error}
  </div>
)}

<button
  type="submit"
  disabled={loading}
  className="w-full rounded-xl bg-blue-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
>
  {loading ? "Signing in..." : "Sign in"}
</button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-600">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <p className="text-center text-sm text-slate-500">
              Don't have a TenderIQ workspace?{" "}
              <a
                href="/register"
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Create workspace
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
