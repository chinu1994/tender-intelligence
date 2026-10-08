"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_name: companyName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to create workspace"
        );
      }

localStorage.setItem(
  "access_token",
  data.access_token
);

localStorage.setItem(
  "refresh_token",
  data.refresh_token
);

router.push("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create workspace"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* Left side */}
        <div className="hidden lg:flex flex-col justify-between border-r border-white/10 p-12">
          <div>
            <Link
              href="/"
              className="text-2xl font-semibold tracking-tight"
            >
              Tender<span className="text-cyan-400">IQ</span>
            </Link>

            <div className="mt-24 max-w-lg">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
                Tender Intelligence
              </p>

              <h1 className="text-5xl font-semibold leading-tight">
                Turn complex tenders into confident bids.
              </h1>

              <p className="mt-6 text-lg leading-8 text-slate-400">
                Create your workspace and bring tender documents,
                requirements, analysis, and proposal preparation
                into one place.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Secure workspace management for your team.
          </p>
        </div>

        {/* Right side */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            <div className="mb-8 lg:hidden">
              <Link
                href="/"
                className="text-2xl font-semibold tracking-tight"
              >
                Tender<span className="text-cyan-400">IQ</span>
              </Link>
            </div>

            <div className="mb-8">
              <p className="text-sm font-medium text-cyan-400">
                Create workspace
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                Get started with TenderIQ
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Set up your company workspace and administrator
                account.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="company"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Company name
                </label>

                <input
                  id="company"
                  type="text"
                  value={companyName}
                  onChange={(event) =>
                    setCompanyName(event.target.value)
                  }
                  placeholder="Your company"
                  required
                  minLength={2}
                  maxLength={255}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-white/[0.07]"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Admin email
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="admin@company.com"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-white/[0.07]"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  maxLength={128}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-white/[0.07]"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Confirm password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter password again"
                  required
                  minLength={8}
                  maxLength={128}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-white/[0.07]"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Creating workspace..."
                  : "Create workspace"}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-cyan-400 hover:text-cyan-300"
              >
                Sign in
              </Link>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
