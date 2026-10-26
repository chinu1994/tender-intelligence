"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import WorkspaceCaseSelect from "@/components/dashboard/WorkspaceCaseSelect";
import {
  REQUIREMENT_CATEGORIES,
  createRequirement,
  getDashboardSummary,
  getRequirements,
  updateRequirement,
  type ExtractedRequirementItem,
  type RequirementFlag,
} from "@/lib/api";
import { useWorkspaceCase } from "@/lib/useWorkspaceCase";

const FLAG_LABEL: Record<RequirementFlag, { text: string; cls: string }> = {
  low_confidence: { text: "Low confidence", cls: "bg-amber-400/10 text-amber-200" },
  missing_source: { text: "No source citation", cls: "bg-red-400/10 text-red-200" },
  missing_location: { text: "No page/paragraph", cls: "bg-orange-400/10 text-orange-200" },
  corrected: { text: "Corrected", cls: "bg-sky-400/10 text-sky-200" },
};

type Draft = {
  requirement: string;
  category: string;
  mandatory: boolean;
  deadline_value: string;
  lot_bundle: string;
  evaluation_criteria: string;
  document_reference: string;
  required_evidence: string;
  review_note: string;
};

function toDraft(item?: ExtractedRequirementItem): Draft {
  return {
    requirement: item?.requirement ?? "",
    category: item?.category ?? "mandatory",
    mandatory: item?.mandatory ?? false,
    deadline_value: item?.deadline_value ?? "",
    lot_bundle: item?.lot_bundle ?? "",
    evaluation_criteria: item?.evaluation_criteria ?? "",
    document_reference: item?.document_reference ?? "",
    required_evidence: (item?.required_evidence ?? []).join("\n"),
    review_note: item?.review_note ?? "",
  };
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-[#0b1220] p-2.5 text-sm outline-none focus:border-blue-400 read-only:opacity-70";

export default function ReviewPage() {
  const { cases, caseId, setCaseId, loadingCases, caseError } = useWorkspaceCase();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [items, setItems] = useState<ExtractedRequirementItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newText, setNewText] = useState("");

  const refresh = useCallback(async (id: string) => {
    if (!id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getRequirements(id);
      setItems(data);
      setSelectedId((current) => (data.some((r) => r.id === current) ? current : data[0]?.id ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load review items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getDashboardSummary().then((r) => setUser(r.user)).catch(() => undefined);
  }, []);
  useEffect(() => {
    refresh(caseId);
  }, [caseId, refresh]);

  const selected = items.find((i) => i.id === selectedId);
  useEffect(() => {
    setDraft(toDraft(selected));
  }, [selected]);

  const canReview = user?.role === "admin" || user?.role === "reviewer";
  const visible = items.filter((i) => filter === "all" || (filter === "flagged" ? i.flags.some((f) => f !== "corrected") : i.review_status === filter));
  const counts = {
    pending: items.filter((i) => i.review_status === "pending").length,
    flagged: items.filter((i) => i.flags.some((f) => f !== "corrected")).length,
  };

  async function save(status?: "verified" | "rejected" | "pending") {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateRequirement(selected.id, {
        requirement: draft.requirement,
        category: draft.category,
        mandatory: draft.mandatory,
        deadline_value: draft.deadline_value || null,
        lot_bundle: draft.lot_bundle || null,
        evaluation_criteria: draft.evaluation_criteria || null,
        document_reference: draft.document_reference || null,
        required_evidence: draft.required_evidence.split("\n").map((x) => x.trim()).filter(Boolean),
        review_note: draft.review_note,
        ...(status ? { review_status: status } : {}),
      });
      setItems((cur) => cur.map((r) => (r.id === updated.id ? updated : r)));
      setMessage(status ? `Requirement ${status === "pending" ? "re-opened" : status}.` : "Correction saved.");
      if (status && status !== "pending" && filter === "pending") {
        const next = visible.find((r) => r.id !== updated.id);
        if (next) setSelectedId(next.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save correction");
    } finally {
      setSaving(false);
    }
  }

  async function addRequirement(event: FormEvent) {
    event.preventDefault();
    if (!caseId || !newText.trim()) return;
    try {
      const created = await createRequirement(caseId, { requirement: newText.trim(), category: "mandatory", mandatory: true });
      setItems((cur) => [...cur, created]);
      setSelectedId(created.id);
      setNewText("");
      setMessage("Requirement added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add requirement");
    }
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  const field = (key: keyof Draft, label: string, multiline = false) => (
    <label className="block text-xs text-slate-400">
      {label}
      {multiline ? (
        <textarea value={String(draft[key])} readOnly={!canReview} rows={2} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className={inputCls} />
      ) : (
        <input value={String(draft[key])} readOnly={!canReview} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className={inputCls} />
      )}
    </label>
  );

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <div className="flex min-h-screen">
        <Sidebar active="Review" user={user} onSignOut={signOut} />
        <section className="min-w-0 flex-1 px-5 py-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs uppercase tracking-[.22em] text-blue-300">Human verification</p>
            <h1 className="mt-2 text-3xl font-semibold">Review & correction</h1>
            <p className="mt-2 text-sm text-slate-400">
              Compare each extracted field with its source citation, correct it, and commit a reviewer decision.
            </p>
            <div className="mt-6">
              <WorkspaceCaseSelect cases={cases} caseId={caseId} onChange={setCaseId} />
            </div>
            {(error || caseError) && <p role="alert" className="mt-4 text-sm text-red-300">{error || caseError}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

            <div className="mt-6 flex flex-wrap gap-2">
              {["pending", "flagged", "verified", "rejected", "all"].map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-4 py-2 text-sm capitalize ${filter === s ? "bg-blue-500/20 text-blue-200" : "border border-white/10 text-slate-400"}`}>
                  {s}
                  {s === "pending" && ` (${counts.pending})`}
                  {s === "flagged" && ` (${counts.flagged})`}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,.75fr)_minmax(0,1.6fr)]">
              <div className="overflow-hidden rounded-2xl border border-white/10">
                {loading || loadingCases ? (
                  <p className="p-5 text-sm text-slate-400">Loading…</p>
                ) : visible.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">No items in this view. Extraction runs automatically once all case documents are processed.</p>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto">
                    {visible.map((item) => (
                      <button key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b border-white/10 p-4 text-left last:border-0 ${selectedId === item.id ? "bg-blue-500/10" : "hover:bg-white/[.03]"}`}>
                        <p className="line-clamp-3 text-sm text-slate-200">{item.requirement}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[11px] capitalize text-violet-200">{item.category.replaceAll("_", " ")}</span>
                          {item.flags.filter((f) => f !== "corrected").map((f) => (
                            <span key={f} className={`rounded-full px-2 py-0.5 text-[11px] ${FLAG_LABEL[f].cls}`}>{FLAG_LABEL[f].text}</span>
                          ))}
                          <span className="ml-auto text-[11px] capitalize text-amber-200">{item.review_status}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {canReview && caseId && (
                  <form onSubmit={addRequirement} className="border-t border-white/10 p-4">
                    <p className="text-xs text-slate-400">Missed something? Add a requirement manually.</p>
                    <div className="mt-2 flex gap-2">
                      <input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Requirement text…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      <button disabled={!newText.trim()} className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-50">Add</button>
                    </div>
                  </form>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                {!selected ? (
                  <p className="text-sm text-slate-400">Select an extracted requirement to review.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Requirement details</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Confidence {(selected.confidence * 100).toFixed(0)}%
                          {selected.reviewed_by_email && ` · ${selected.review_status} by ${selected.reviewed_by_email}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.flags.map((f) => (
                          <span key={f} className={`rounded-full px-2.5 py-1 text-xs ${FLAG_LABEL[f].cls}`}>{FLAG_LABEL[f].text}</span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Original source</p>
                        <p className="mt-2 text-sm font-medium">{selected.source_document || "Unknown document"}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {selected.source_page ? `Page ${selected.source_page}` : "Page n/a"}
                          {selected.source_paragraph ? ` · Paragraph/row ${selected.source_paragraph}` : ""}
                        </p>
                        <blockquote className="mt-3 border-l-2 border-blue-400/40 pl-3 text-sm leading-6 text-slate-300 whitespace-pre-wrap">
                          {selected.source_excerpt || selected.original_requirement}
                        </blockquote>
                        {selected.source_excerpt && selected.source_excerpt !== selected.original_requirement && (
                          <p className="mt-3 text-xs text-slate-500">Extracted text: {selected.original_requirement}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <label className="block text-xs text-slate-400">
                          Requirement (corrected)
                          <textarea value={draft.requirement} onChange={(e) => setDraft({ ...draft, requirement: e.target.value })} readOnly={!canReview} rows={5} className={inputCls} />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs text-slate-400">
                            Category
                            <select value={draft.category} disabled={!canReview} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputCls}>
                              {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
                            </select>
                          </label>
                          <label className="mt-6 flex items-center gap-2 text-sm text-slate-300">
                            <input type="checkbox" checked={draft.mandatory} disabled={!canReview} onChange={(e) => setDraft({ ...draft, mandatory: e.target.checked })} />
                            Mandatory
                          </label>
                          {field("deadline_value", "Deadline")}
                          {field("lot_bundle", "Lot / bundle")}
                          {field("document_reference", "Document reference")}
                          {field("evaluation_criteria", "Evaluation criterion")}
                        </div>
                        {field("required_evidence", "Required evidence (one per line)", true)}
                        {field("review_note", "Reviewer note", true)}
                      </div>
                    </div>

                    {canReview ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button disabled={saving || !draft.requirement.trim()} onClick={() => save()} className="rounded-lg border border-white/10 px-4 py-2 text-sm disabled:opacity-50">Save correction</button>
                        <button disabled={saving || !draft.requirement.trim()} onClick={() => save("verified")} className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 disabled:opacity-50">Save & verify</button>
                        <button disabled={saving} onClick={() => save("rejected")} className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-200 disabled:opacity-50">Reject</button>
                        {selected.review_status !== "pending" && (
                          <button disabled={saving} onClick={() => save("pending")} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-50">Re-open</button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-slate-500">Read-only: reviewer permissions are required to save corrections.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
