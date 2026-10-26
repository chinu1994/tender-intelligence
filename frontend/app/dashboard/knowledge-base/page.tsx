"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/dashboard/Sidebar";
import { getDashboardSummary, getHistoricalDocuments, uploadHistoricalDocuments, type HistoricalDocumentItem } from "@/lib/api";

export default function KnowledgeBasePage() {
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [documents, setDocuments] = useState<HistoricalDocumentItem[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);
  const [sourceType, setSourceType] = useState("past_tender");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const result = await getHistoricalDocuments();
    setDocuments(result);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardSummary(), refresh()]).then(([summary]) => { if (active) setUser(summary.user); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Unable to load knowledge base"); })
      .finally(() => { if (active) setLoading(false); });
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh]);

  async function upload() {
    if (!files?.length) { setError("Choose at least one PDF, DOCX, XLSX, or ZIP file."); return; }
    setUploading(true); setError(""); setMessage("");
    try {
      const created = await uploadHistoricalDocuments(Array.from(files), { source_type: sourceType, outcome: outcome || undefined, notes: notes || undefined });
      setMessage(`${created.length} file(s) queued for indexing.`); setFiles(null); setNotes("");
      const input = document.getElementById("kb-files") as HTMLInputElement | null; if (input) input.value = "";
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  function signOut() { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); window.location.href = "/"; }
  const ready = documents.filter((d) => d.status === "completed").length;
  return <main className="min-h-screen bg-[#070b14] text-white"><div className="flex min-h-screen"><Sidebar active="Knowledge Base" user={user} onSignOut={signOut}/><section className="min-w-0 flex-1 px-5 py-8 lg:px-10">
    <div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.22em] text-blue-300">Historical intelligence</p><h1 className="mt-2 text-3xl font-semibold">Knowledge Base</h1><p className="mt-2 text-sm text-slate-400">Index past tenders and bids so teams can find relevant, cited precedent.</p></div><Link href="/dashboard/knowledge-base/search" className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-200">Search indexed content →</Link></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-3">{[["Historical files", documents.length],["Indexed", ready],["Needs attention", documents.filter(d=>d.status==="failed").length]].map(([label,value])=><div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</div>
    <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-lg font-semibold">Add historical documents</h2><p className="mt-1 text-sm text-slate-400">ZIP files are unpacked asynchronously. Maximum 50 MB per uploaded file.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm text-slate-300">Files<input id="kb-files" type="file" multiple accept=".pdf,.docx,.xlsx,.zip" onChange={e=>setFiles(e.target.files)} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#0b1220] p-3 text-sm"/></label><label className="text-sm text-slate-300">Record type<select value={sourceType} onChange={e=>setSourceType(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1220] p-3"><option value="past_tender">Past tender</option><option value="past_bid">Past bid</option><option value="successful_bid">Successful bid</option><option value="unsuccessful_bid">Unsuccessful bid</option><option value="completed">Completed project</option></select></label><label className="text-sm text-slate-300">Outcome (optional)<select value={outcome} onChange={e=>setOutcome(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1220] p-3"><option value="">Not specified</option><option value="won">Won</option><option value="lost">Lost</option><option value="completed">Completed</option></select></label><label className="text-sm text-slate-300">Notes (optional)<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Client, project, lessons learned…" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1220] p-3"/></label></div>{error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}{message&&<p className="mt-4 text-sm text-emerald-300">{message}</p>}<button onClick={upload} disabled={uploading} className="mt-5 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium hover:bg-blue-400 disabled:opacity-50">{uploading?"Uploading…":"Upload and index"}</button></div>
    <div className="mt-7 overflow-hidden rounded-2xl border border-white/10"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="font-semibold">Historical documents</h2><button onClick={()=>refresh().catch(e=>setError(e.message))} className="text-sm text-blue-300">Refresh status ↻</button></div>{loading?<p className="p-5 text-sm text-slate-400">Loading…</p>:documents.length===0?<p className="p-8 text-center text-sm text-slate-400">No historical files yet. Upload a past tender or bid to get started.</p>:<div className="divide-y divide-white/10">{documents.map(d=><div key={d.id} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_150px_120px]"><div><p className="break-words font-medium">{d.name}</p><p className="mt-1 text-xs text-slate-500">{d.source_type.replaceAll("_"," ")} · {new Date(d.created_at).toLocaleString()}</p>{d.processing_error&&<p className="mt-1 text-xs text-red-300">{d.processing_error}</p>}</div><p className="text-sm capitalize text-slate-400">{d.outcome||"Outcome unknown"}</p><p className={`text-sm capitalize ${d.status==="completed"?"text-emerald-300":d.status==="failed"?"text-red-300":"text-amber-300"}`}>{d.status}</p></div>)}</div>}</div>
    </div></section></div></main>;
}
