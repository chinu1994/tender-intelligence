"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    <main className="min-h-screen bg-[#070b14] text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-white/10 bg-[#0a0f1c] p-6 lg:block">
          <div className="mb-10">
            <div className="text-2xl font-bold tracking-tight">
              Tender<span className="text-blue-400">IQ</span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Turn complex tenders into confident bids.
            </p>
          </div>

          <nav className="space-y-2">
            <Link
              href="/dashboard"
              className="block rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              Dashboard
            </Link>

            <Link
              href="/dashboard/users"
              className="block rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white"
            >
              Users
            </Link>

            <div className="rounded-xl px-4 py-3 text-sm text-slate-600">
              Opportunities
            </div>

            <div className="rounded-xl px-4 py-3 text-sm text-slate-600">
              Documents
            </div>

            <div className="rounded-xl px-4 py-3 text-sm text-slate-600">
              Requirements
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <section className="flex-1">
          <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/dashboard/users"
                className="text-sm text-slate-400 transition hover:text-white"
              >
                ← Back to Users
              </Link>

              <h1 className="mt-6 text-3xl font-semibold tracking-tight">
                Create New User
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Add a new team member to your TenderIQ workspace.
              </p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:p-8">
              <form
                onSubmit={handleSubmit}
                className="space-y-6"
              >
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
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="user@company.com"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/10"
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
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/10"
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

                  <select
                    id="role"
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/10"
                  >
                    <option value="reviewer">
                      Reviewer
                    </option>

                    <option value="editor">
                      Editor
                    </option>

                    <option value="admin">
                      Admin
                    </option>
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    Choose the permissions this user should have.
                  </p>
                </div>

                {/* Messages */}
                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {success}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <Link
                    href="/dashboard/users"
                    className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Creating user..."
                      : "Create user"}
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
