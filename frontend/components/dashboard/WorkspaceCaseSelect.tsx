"use client";
import type { CaseItem } from "@/lib/cases";

export default function WorkspaceCaseSelect({ cases, caseId, onChange }: { cases: CaseItem[]; caseId: string; onChange: (id: string) => void }) {
  return <label className="flex flex-wrap items-center gap-3 text-sm text-slate-400">Tender case
    <select value={caseId} onChange={(event) => onChange(event.target.value)} className="min-w-64 rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-white">
      <option value="">Select a case</option>
      {cases.map((item) => <option key={item.id} value={item.id}>{item.title}{item.reference ? ` · ${item.reference}` : ""}</option>)}
    </select>
  </label>;
}
