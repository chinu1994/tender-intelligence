"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  getCase,
  getCaseTransitions,
  getDashboardSummary,
  getStructuredExtraction,
  updateCaseStatus,
  type Citation,
  type StructuredExtraction,
} from "@/lib/api";
import { CASE_STAGES, formatDeadline, type CaseItem, type CaseStatus } from "@/lib/cases";

const STAGE_LABEL: Record<CaseStatus, string> = {
  new: "New",
  analysis: "Analysis",
  review_required: "Review required",
  proposal_draft: "Proposal draft",
  approved: "Approved",
  completed: "Completed",
};

function cite(c: Citation) {
  const parts = [c.source_document || "Unknown source"];
  if (c.source_page) parts.push(`p. ${c.source_page}`);
  if (c.source_paragraph) parts.push(`para./row ${c.source_paragraph}`);
  return parts.join(" · ");
}

function Group({ title, items }: { title: string; items: { key: string; text: string; meta: string; status: string | null }[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nothing extracted.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.key} className="rounded-xl border border-white/10 bg-[#0b1220] p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-200">{item.text}</p>
              <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{item.meta}</span>
                {item.status && <span className="capitalize text-amber-200">{item.status}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params?.id ?? "";
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [item, setItem] = useState<CaseItem | null>(null);
  const [allowed, setAllowed] = useState<CaseStatus[]>([]);
  const [extraction, setExtraction] = useState<StructuredExtraction | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!caseId) return;
    const [c, t, x] = await Promise.all([getCase(caseId), getCaseTransitions(caseId), getStructuredExtraction(caseId)]);
    setItem(c);
    setAllowed(t.allowed);
    setExtraction(x);
  }, [caseId]);

  useEffect(() => {
    if (caseId) localStorage.setItem("selected_tender_case_id", caseId);
    getDashboardSummary().then((r) => setUser(r.user)).catch(() => undefined);
    refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load case"));
  }, [caseId, refresh]);

  async function move(status: CaseStatus) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateCaseStatus(caseId, status);
      await refresh();
      setMessage(`Case moved to “${STAGE_LABEL[status]}”.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setSaving(false);
    }
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  const stage = item ? CASE_STAGES.indexOf(item.status) : -1;

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <div className="flex min-h-screen">
        <Sidebar active="Cases" user={user} onSignOut={signOut} />
        <section className="min-w-0 flex-1 px-5 py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <Link href="/dashboard/cases" className="text-sm text-blue-300">← All cases</Link>
            {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
            {!item ? (
              !error && <p className="mt-8 text-sm text-slate-400">Loading case…</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[.22em] text-blue-300">{item.reference || "Tender case"}</p>
                    <h1 className="mt-2 text-3xl font-semibold">{item.title}</h1>
                    <p className="mt-2 text-sm text-slate-400">
                      {item.deadline ? `Submission deadline ${formatDeadline(item.deadline)}` : "No deadline set"} · Owner {item.owner} · Updated {item.updated}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/dashboard/documents" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Documents</Link>
                    <Link href="/dashboard/review" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Review</Link>
                    <Link href="/dashboard/proposal" className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium">Proposal workspace</Link>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
                  <h2 className="text-sm font-semibold">Lifecycle</h2>
                  <ol className="mt-4 grid gap-2 sm:grid-cols-6">
                    {CASE_STAGES.map((s, i) => (
                      <li
                        key={s}
                        aria-current={i === stage ? "step" : undefined}
                        className={`rounded-xl border px-3 py-2 text-xs ${i === stage ? "border-blue-400 bg-blue-500/15 text-blue-100" : i < stage ? "border-emerald-400/30 text-emerald-200" : "border-white/10 text-slate-500"}`}
                      >
                        {i + 1}. {STAGE_LABEL[s]}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {allowed.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No manual transitions available for your role. Approval happens in the proposal workspace.
                      </p>
                    ) : (
                      allowed.map((s) => (
                        <button key={s} disabled={saving} onClick={() => move(s)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50">
                          Move to {STAGE_LABEL[s]}
                        </button>
                      ))
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {item.docsProcessed}/{item.docsTotal} documents processed{item.docsFailed ? ` · ${item.docsFailed} failed` : ""}
                  </p>
                </div>

                {extraction && (
                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <Group title="Deadlines" items={extraction.deadlines.map((d, i) => ({ key: `d${i}`, text: d.value, meta: cite(d), status: d.review_status }))} />
                    <Group title="Lots / bundles" items={extraction.lots.map((d, i) => ({ key: `l${i}`, text: `${d.name}: ${d.description ?? ""}`, meta: cite(d), status: d.review_status }))} />
                    <Group title="Evaluation criteria" items={extraction.evaluation_criteria.map((d, i) => ({ key: `e${i}`, text: d.weight ? `${d.criterion} (weights: ${d.weight})` : d.criterion, meta: cite(d), status: d.review_status }))} />
                    <Group title="Required evidence" items={extraction.required_evidence.map((d, i) => ({ key: `v${i}`, text: d.evidence, meta: cite(d), status: d.review_status }))} />
                    <Group title="Mandatory requirements" items={extraction.requirements.map((d, i) => ({ key: `m${i}`, text: d.requirement, meta: cite(d), status: d.review_status }))} />
                    <Group title="Document references" items={extraction.document_references.map((d, i) => ({ key: `r${i}`, text: `${d.reference} — ${d.context ?? ""}`, meta: cite(d), status: d.review_status }))} />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
