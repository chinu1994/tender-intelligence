"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import WorkspaceCaseSelect from "@/components/dashboard/WorkspaceCaseSelect";
import {
  approveProposal,
  createProposalIssue,
  createProposalSection,
  downloadProposalExport,
  draftProposalSection,
  generateProposalIssues,
  getDashboardSummary,
  getProposalWorkspace,
  getRequirementMatches,
  searchKnowledgeBase,
  updateProposalIssue,
  updateProposalSection,
  type KnowledgeSearchHit,
  type ProposalWorkspace,
  type WorkspaceRequirement,
} from "@/lib/api";
import { useWorkspaceCase } from "@/lib/useWorkspaceCase";

const card = "rounded-2xl border border-white/10 bg-white/[.03] p-5";
const btn = "rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

function citation(r: { source_document: string | null; source_page: number | null; source_paragraph: number | null }) {
  if (!r.source_document) return "No source";
  return [r.source_document, r.source_page ? `p. ${r.source_page}` : "", r.source_paragraph ? `para. ${r.source_paragraph}` : ""].filter(Boolean).join(" · ");
}

function snippetBlock(hit: KnowledgeSearchHit) {
  const where = [hit.document_name, hit.page_number ? `page ${hit.page_number}` : "", hit.paragraph_number ? `paragraph ${hit.paragraph_number}` : ""].filter(Boolean).join(", ");
  return `${hit.text}\n[Source: ${where}]`;
}

export default function ProposalPage() {
  const { cases, caseId, setCaseId, loadingCases, caseError } = useWorkspaceCase();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [workspace, setWorkspace] = useState<ProposalWorkspace | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [snippetQuery, setSnippetQuery] = useState("");
  const [snippets, setSnippets] = useState<KnowledgeSearchHit[]>([]);
  const [snippetSource, setSnippetSource] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newSection, setNewSection] = useState("");

  const refresh = useCallback(async (id: string) => {
    if (!id) {
      setWorkspace(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getProposalWorkspace(id);
      setWorkspace(data);
      setSelectedId((current) => (data.sections.some((s) => s.id === current) ? current : data.sections[0]?.id ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load proposal workspace");
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

  const selected = workspace?.sections.find((s) => s.id === selectedId);
  useEffect(() => setDraft(selected?.content ?? ""), [selectedId, selected?.content]);

  const readOnly = workspace?.case_status === "approved" || workspace?.case_status === "completed";
  const canEdit = (user?.role === "admin" || user?.role === "editor") && !readOnly;
  const canApprove = user?.role === "admin" || user?.role === "reviewer";
  const dirty = selected ? draft !== selected.content : false;

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy("");
    }
  }

  const saveSection = (status: "draft" | "complete") =>
    run("Save", async () => {
      if (!selected) return;
      await updateProposalSection(selected.id, { content: draft, status });
      await refresh(caseId);
      setMessage(status === "complete" ? "Section saved and marked complete." : "Draft saved.");
    });

  const generateDraft = () =>
    run("Draft", async () => {
      if (!selected) return;
      if (dirty) await updateProposalSection(selected.id, { content: draft });
      const updated = await draftProposalSection(selected.id, { replace: !draft.trim() });
      setDraft(updated.content);
      await refresh(caseId);
      setMessage("Draft generated from extracted requirements and matched precedent. Review and tailor it, then mark the section complete.");
    });

  const addSection = (event: FormEvent) => {
    event.preventDefault();
    if (!newSection.trim() || !workspace) return;
    run("Add section", async () => {
      const created = await createProposalSection(caseId, newSection.trim(), workspace.sections.length);
      setNewSection("");
      await refresh(caseId);
      setSelectedId(created.id);
    });
  };

  const addIssue = (event: FormEvent) => {
    event.preventDefault();
    if (!caseId || !title.trim()) return;
    run("Add issue", async () => {
      await createProposalIssue(caseId, { title, description: description || undefined, severity });
      setTitle("");
      setDescription("");
      await refresh(caseId);
      setMessage("Issue added.");
    });
  };

  const generateIssues = () =>
    run("Generate", async () => {
      const result = await generateProposalIssues(caseId);
      await refresh(caseId);
      setMessage(result.created ? `${result.created} checklist item(s) added from extracted requirements.` : "Checklist is already up to date.");
    });

  const toggleIssue = (id: string, resolved: boolean) =>
    run("Issue", async () => {
      await updateProposalIssue(id, { resolved });
      await refresh(caseId);
    });

  const approve = () =>
    run("Approve", async () => {
      const result = await approveProposal(caseId);
      setMessage(`Proposal approved. Case status: ${result.status}.`);
      await refresh(caseId);
    });

  const exportFile = (format: "docx" | "xlsx") => run("Export", () => downloadProposalExport(caseId, format));

  const findSnippets = (event: FormEvent) => {
    event.preventDefault();
    if (!snippetQuery.trim()) return;
    run("Search", async () => {
      const result = await searchKnowledgeBase(snippetQuery, 5);
      setSnippets(result.results);
      setSnippetSource(`Results for “${snippetQuery}”`);
    });
  };

  const matchRequirement = (requirement: WorkspaceRequirement) =>
    run("Match", async () => {
      const result = await getRequirementMatches(requirement.id, 5);
      setSnippets(result.results);
      setSnippetSource(`Precedent matching: ${requirement.requirement.slice(0, 90)}${requirement.requirement.length > 90 ? "…" : ""}`);
    });

  function insertSnippet(hit: KnowledgeSearchHit) {
    setDraft((current) => (current.trim() ? `${current.trim()}\n\n${snippetBlock(hit)}` : snippetBlock(hit)));
    setMessage("Historical snippet inserted with its source reference. Adapt it before submission and save the section.");
  }

  function insertRequirement(r: WorkspaceRequirement) {
    const line = `- ${r.requirement} [${citation(r)}]\n  Response: `;
    setDraft((current) => (current.trim() ? `${current.trim()}\n${line}` : line));
  }

  function signOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  const openIssues = workspace?.issues.filter((i) => !i.resolved).length ?? 0;
  const complete = workspace?.sections.filter((s) => s.status === "complete" && s.content.trim()).length ?? 0;
  const verified = workspace?.requirements.filter((r) => r.review_status === "verified").length ?? 0;

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <div className="flex min-h-screen">
        <Sidebar active="Proposal" user={user} onSignOut={signOut} />
        <section className="min-w-0 flex-1 px-5 py-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs uppercase tracking-[.22em] text-blue-300">Response development</p>
            <h1 className="mt-2 text-3xl font-semibold">Proposal workspace</h1>
            <p className="mt-2 text-sm text-slate-400">Requirements, historical precedent, draft sections and open points in one place.</p>
            <div className="mt-6">
              <WorkspaceCaseSelect cases={cases} caseId={caseId} onChange={setCaseId} />
            </div>
            {(error || caseError) && <p role="alert" className="mt-4 text-sm text-red-300">{error || caseError}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

            {loading && !workspace ? (
              <p className="mt-8 text-sm text-slate-400">Loading workspace…</p>
            ) : loadingCases ? (
              <p className="mt-8 text-sm text-slate-400">Loading cases…</p>
            ) : !workspace ? (
              <p className="mt-8 text-sm text-slate-400">Select or create a tender case.</p>
            ) : (
              <>
                <div className="mt-6 grid gap-4 sm:grid-cols-4">
                  {[
                    ["Sections completed", `${complete}/${workspace.sections.length}`],
                    ["Requirements verified", `${verified}/${workspace.requirements.length}`],
                    ["Open issues", String(openIssues)],
                    ["Case lifecycle", workspace.case_status.replaceAll("_", " ")],
                  ].map(([label, value]) => (
                    <div key={label} className={card}>
                      <p className="text-sm text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-semibold capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                <div className={`mt-6 ${card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Approval & export</h2>
                      {workspace.approval.ready ? (
                        <p className="mt-1 text-sm text-emerald-300">{readOnly ? "This proposal is approved and read-only." : "Ready for approval."}</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
                          {workspace.approval.blockers.map((b) => <li key={b}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => exportFile("docx")} disabled={!!busy} className={btn}>Export proposal (DOCX)</button>
                      <button onClick={() => exportFile("xlsx")} disabled={!!busy} className={btn}>Export compliance & positions (XLSX)</button>
                      <button onClick={approve} disabled={!canApprove || !workspace.approval.ready || !!busy} title={canApprove ? undefined : "Reviewer or administrator role required"} className="rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">
                        Approve proposal
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
                  <nav className="h-fit overflow-hidden rounded-2xl border border-white/10">
                    {workspace.sections.map((s) => (
                      <button key={s.id} onClick={() => setSelectedId(s.id)} className={`block w-full border-b border-white/10 p-4 text-left last:border-0 ${s.id === selectedId ? "bg-blue-500/10" : "hover:bg-white/[.03]"}`}>
                        <span className="block text-sm font-medium">{s.title}</span>
                        <span className={`mt-1 block text-xs ${s.status === "complete" ? "text-emerald-300" : "text-slate-500"}`}>{s.status === "complete" ? "Complete" : s.content.trim() ? "Draft" : "Empty"}</span>
                      </button>
                    ))}
                    {canEdit && (
                      <form onSubmit={addSection} className="flex gap-2 p-3">
                        <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="New section…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1220] px-2 py-1.5 text-xs outline-none" />
                        <button disabled={!newSection.trim()} className="rounded-lg border border-white/10 px-2 text-xs disabled:opacity-40">Add</button>
                      </form>
                    )}
                  </nav>

                  <div className={card}>
                    {selected ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h2 className="text-lg font-semibold">{selected.title}</h2>
                          <span className="text-xs capitalize text-slate-400">{selected.status}{dirty ? " · unsaved changes" : ""}</span>
                        </div>
                        <textarea value={draft} readOnly={!canEdit} onChange={(e) => setDraft(e.target.value)} rows={20} placeholder={`Write the ${selected.title.toLowerCase()}… (supports ## headings, - bullets and **bold**)`} className="mt-4 w-full rounded-xl border border-white/10 bg-[#0b1220] p-4 font-mono text-sm leading-6 outline-none focus:border-blue-400" />
                        {canEdit && (
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button onClick={generateDraft} disabled={!!busy} className={btn}>{busy === "Draft" ? "Drafting…" : "Generate draft"}</button>
                            <button onClick={() => saveSection("draft")} disabled={!!busy || !dirty} className={btn}>Save draft</button>
                            <button onClick={() => saveSection("complete")} disabled={!!busy || !draft.trim()} className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium disabled:opacity-40">Save & mark complete</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Select a proposal section.</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className={card}>
                      <h3 className="text-sm font-semibold">Extracted requirements</h3>
                      <p className="mt-1 text-xs text-slate-500">Insert into the draft or find matching precedent.</p>
                      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                        {workspace.requirements.length === 0 && <p className="text-xs text-slate-500">No requirements extracted yet.</p>}
                        {workspace.requirements.map((r) => (
                          <div key={r.id} className="rounded-lg border border-white/10 p-3">
                            <p className="line-clamp-3 text-xs text-slate-200">{r.requirement}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{r.mandatory ? "Mandatory · " : ""}{citation(r)} · <span className="capitalize">{r.review_status}</span></p>
                            <div className="mt-2 flex gap-3 text-[11px]">
                              {canEdit && <button onClick={() => insertRequirement(r)} className="text-blue-300">Insert</button>}
                              <button onClick={() => matchRequirement(r)} className="text-emerald-300">Find precedent</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={findSnippets} className={card}>
                      <h3 className="text-sm font-semibold">Historical snippets</h3>
                      <div className="mt-3 flex gap-2">
                        <input value={snippetQuery} onChange={(e) => setSnippetQuery(e.target.value)} placeholder="Search past bids…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#070b14] px-3 py-2 text-xs outline-none focus:border-blue-400" />
                        <button disabled={!!busy || !snippetQuery.trim()} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-50">Search</button>
                      </div>
                      {snippetSource && <p className="mt-3 text-[11px] text-slate-500">{snippetSource}</p>}
                      {snippetSource && snippets.length === 0 && <p className="mt-2 text-xs text-slate-500">No indexed matches.</p>}
                      {snippets.map((hit) => (
                        <div key={hit.chunk_id} className="mt-3 rounded-lg border border-white/10 p-3">
                          <p className="text-xs font-medium text-blue-200">
                            {hit.document_name}
                            {hit.page_number ? ` · p. ${hit.page_number}` : ""}
                            {hit.paragraph_number ? ` · para. ${hit.paragraph_number}` : ""}
                            <span className="ml-2 text-slate-500">{(hit.score * 100).toFixed(0)}%{hit.outcome ? ` · ${hit.outcome}` : ""}</span>
                          </p>
                          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-slate-300">{hit.text}</p>
                          {canEdit && selected && <button type="button" onClick={() => insertSnippet(hit)} className="mt-2 text-xs text-emerald-300">Insert into draft +</button>}
                        </div>
                      ))}
                    </form>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className={card}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-semibold">Open issues checklist</h2>
                      {canEdit && <button onClick={generateIssues} disabled={!!busy} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs disabled:opacity-40">Generate from requirements</button>}
                    </div>
                    {workspace.issues.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-400">No issues added.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {workspace.issues.map((issue) => (
                          <label key={issue.id} className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
                            <input type="checkbox" checked={issue.resolved} disabled={!canEdit || !!busy} onChange={(e) => toggleIssue(issue.id, e.target.checked)} className="mt-1" />
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm ${issue.resolved ? "text-slate-500 line-through" : "text-slate-200"}`}>{issue.title}</span>
                              {issue.description && <span className="mt-1 block text-xs text-slate-400">{issue.description}</span>}
                              <span className="mt-2 block text-xs capitalize text-amber-200">{issue.severity} priority</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <form onSubmit={addIssue} className={card}>
                      <h2 className="text-lg font-semibold">Add an open issue</h2>
                      <label className="mt-4 block text-sm text-slate-300">Title<input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1220] p-3" placeholder="e.g. Confirm insurance evidence" /></label>
                      <label className="mt-3 block text-sm text-slate-300">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1220] p-3" /></label>
                      <label className="mt-3 block text-sm text-slate-300">Priority
                        <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1220] p-3">
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                      </label>
                      <button disabled={!!busy} className="mt-4 rounded-xl border border-white/10 px-4 py-2.5 text-sm">Add issue</button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
