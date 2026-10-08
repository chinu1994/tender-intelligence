"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");
    setResetToken("");

    try {
      const data = await requestPasswordReset(email);

      setMessage(data.message);

      // Development only.
      if (data.reset_token) {
        setResetToken(data.reset_token);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request password reset"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-2">
          <div className="hidden rounded-3xl border border-white/10 bg-white/[0.03] p-10 lg:block">
            <div className="text-sm font-semibold tracking-[0.25em] text-cyan-300">
              TENDERIQ
            </div>

            <h1 className="mt-8 text-5xl font-semibold leading-tight">
              Get back to
              <br />
              confident bidding.
            </h1>

            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              Reset your password securely and continue managing
              your tender workspace.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
              <div className="mb-8">
                <div className="text-sm font-semibold tracking-[0.2em] text-cyan-300">
                  TENDERIQ
                </div>

                <h2 className="mt-5 text-3xl font-semibold">
                  Forgot password?
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Enter your account email and we&apos;ll generate
                  a password reset link.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Email address
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                    {message}
                  </div>
                )}

                {resetToken && (
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-cyan-300">
                      Development reset link
                    </p>

                    <Link
                      href={`/reset-password?token=${encodeURIComponent(
                        resetToken
                      )}`}
                      className="mt-3 block text-sm font-medium text-white underline underline-offset-4"
                    >
                      Continue to reset password →
                    </Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Generating reset link..."
                    : "Continue"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-sm text-slate-400 transition hover:text-white"
                >
                  ← Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
