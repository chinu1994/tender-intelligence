"use client";
import { useEffect, useState } from "react";
import { getCases } from "@/lib/api";
import type { CaseItem } from "@/lib/cases";

export function useWorkspaceCase() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseId, setCaseIdState] = useState("");
  const [loadingCases, setLoadingCases] = useState(true);
  const [caseError, setCaseError] = useState("");
  useEffect(() => {
    getCases().then((items) => {
      setCases(items);
      const saved = localStorage.getItem("selected_tender_case_id");
      setCaseIdState(saved && items.some((item) => item.id === saved) ? saved : (items[0]?.id ?? ""));
    }).catch((error: unknown) => setCaseError(error instanceof Error ? error.message : "Unable to load cases"))
      .finally(() => setLoadingCases(false));
  }, []);
  function setCaseId(id: string) {
    setCaseIdState(id);
    localStorage.setItem("selected_tender_case_id", id);
  }
  return { cases, caseId, setCaseId, loadingCases, caseError };
}
