import type { CaseItem, CaseStatus } from "./cases";
import { timeAgo } from "./cases";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


export async function loginUser(
  email: string,
  password: string
) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Login failed");
  }

  return data;
}


async function refreshAccessToken() {
  const refreshToken =
    localStorage.getItem("refresh_token");

  if (!refreshToken) {
    throw new Error("Authentication required");
  }

  const response = await fetch(
    `${API_URL}/auth/refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    throw new Error(
      data.detail || "Session expired"
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

  return data.access_token;
}


async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  retry = true
) {
  let accessToken =
    localStorage.getItem("access_token");

  if (!accessToken) {
    throw new Error("Authentication required");
  }

  const headers = new Headers(
    options.headers || {}
  );

  headers.set(
    "Authorization",
    `Bearer ${accessToken}`
  );

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status !== 401 || !retry) {
    return response;
  }

  accessToken = await refreshAccessToken();

  headers.set(
    "Authorization",
    `Bearer ${accessToken}`
  );

  return fetch(url, {
    ...options,
    headers,
  });
}


export async function getDashboardSummary() {
  const response = await authenticatedFetch(
    `${API_URL}/dashboard/summary`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Unable to load dashboard"
    );
  }

  return data;
}


export async function getUsers() {
  const response = await authenticatedFetch(
    `${API_URL}/users`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Unable to load users"
    );
  }

  return data;
}


export async function updateUserRole(
  userId: string,
  role: string
) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Unable to update user role"
    );
  }

  return data;
}
export async function requestPasswordReset(
  email: string
) {
  const response = await fetch(
    `${API_URL}/auth/forgot-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Unable to request password reset"
    );
  }

  return data;
}


export async function resetPassword(
  token: string,
  newPassword: string
) {
  const response = await fetch(
    `${API_URL}/auth/reset-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Unable to reset password"
    );
  }

  return data;
}


/* ------------------------- Tender cases ------------------------- */

type ApiCase = {
  id: string;
  name: string;
  reference: string | null;
  description: string | null;
  submission_deadline: string | null;
  status: CaseStatus;
  owner: string | null;
  documents_total: number;
  documents_processed: number;
  documents_failed: number;
  created_at: string;
  updated_at: string;
};

function toCaseItem(c: ApiCase): CaseItem {
  return {
    id: c.id,
    title: c.name,
    reference: c.reference ?? "",
    deadline: c.submission_deadline,
    status: c.status,
    owner: c.owner ? c.owner.split("@")[0] : "—",
    updated: timeAgo(c.updated_at),
    docsTotal: c.documents_total,
    docsProcessed: c.documents_processed,
    docsFailed: c.documents_failed,
  };
}

// FastAPI returns validation errors as a list of objects.
function errorMessage(detail: unknown, fallback: string) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  return fallback;
}


export async function getCases(): Promise<CaseItem[]> {
  const response = await authenticatedFetch(
    `${API_URL}/tender-cases`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      errorMessage(data.detail, "Unable to load cases")
    );
  }

  return (data as ApiCase[]).map(toCaseItem);
}


export async function createCase(input: {
  title: string;
  reference?: string;
  deadline?: string;
}): Promise<CaseItem> {
  const response = await authenticatedFetch(
    `${API_URL}/tender-cases`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.title,
        reference: input.reference || null,
        submission_deadline: input.deadline || null,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      errorMessage(data.detail, "Unable to create case")
    );
  }

  return toCaseItem(data as ApiCase);
}
/* ------------------------- Documents ------------------------- */

export type ApiDocument = {
  id: string;
  tender_case_id: string;
  parent_document_id: string | null;
  name: string;
  file_path: string;
  file_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function getDocuments(
  caseId: string
): Promise<ApiDocument[]> {
  const response = await authenticatedFetch(
    `${API_URL}/tender-cases/${caseId}/documents`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      errorMessage(data.detail, "Unable to load documents")
    );
  }

  return data as ApiDocument[];
}

export async function uploadDocuments(
  caseId: string,
  files: File[]
): Promise<ApiDocument[]> {
  if (!caseId) {
    throw new Error("No tender case selected. Create a case first.");
  }
  if (!files.length) {
    throw new Error("Select at least one file to upload.");
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await authenticatedFetch(
    `${API_URL}/tender-cases/${caseId}/documents`,
    {
      method: "POST",
      body: formData,
      // Do not set Content-Type — browser must set multipart boundary
    }
  );

  let data: { detail?: unknown } = {};
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Upload failed (HTTP ${response.status}). Is the backend running at ${API_URL}?`
    );
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Permission denied. Only Admin or Editor roles can upload documents."
      );
    }
    if (response.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }
    if (response.status === 404) {
      throw new Error(
        "Tender case not found. Pick another case or create a new one."
      );
    }
    throw new Error(
      errorMessage(data.detail, `Unable to upload documents (HTTP ${response.status})`)
    );
  }

  return data as unknown as ApiDocument[];
}

/* ---------------------- Knowledge Base ---------------------- */

export type HistoricalDocumentItem = {
  id: string;
  parent_document_id: string | null;
  name: string;
  file_path: string;
  file_type: string;
  source_type: string;
  outcome: string | null;
  notes: string | null;
  status: string;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeSearchHit = {
  chunk_id: string;
  document_id: string;
  document_name: string;
  text: string;
  score: number;
  source_type: string | null;
  outcome?: string | null;
  page_number: number | null;
  paragraph_number: number | null;
};

export async function getHistoricalDocuments(): Promise<
  HistoricalDocumentItem[]
> {
  const response = await authenticatedFetch(
    `${API_URL}/knowledge-base/documents`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      errorMessage(data.detail, "Unable to load knowledge base")
    );
  }
  return data as HistoricalDocumentItem[];
}

export async function uploadHistoricalDocuments(
  files: File[],
  options?: {
    source_type?: string;
    outcome?: string;
    notes?: string;
  }
): Promise<HistoricalDocumentItem[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("source_type", options?.source_type || "past_tender");
  if (options?.outcome) formData.append("outcome", options.outcome);
  if (options?.notes) formData.append("notes", options.notes);

  const response = await authenticatedFetch(
    `${API_URL}/knowledge-base/documents`,
    {
      method: "POST",
      body: formData,
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      errorMessage(data.detail, "Unable to upload to knowledge base")
    );
  }
  return data as HistoricalDocumentItem[];
}

export async function searchKnowledgeBase(
  query: string,
  limit = 10,
  source_type?: string
): Promise<{ query: string; results: KnowledgeSearchHit[] }> {
  const response = await authenticatedFetch(
    `${API_URL}/knowledge-base/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit,
        source_type: source_type || null,
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      errorMessage(data.detail, "Knowledge base search failed")
    );
  }
  return data;
}
/* ---------------- Extraction review + proposal workspace ---------------- */

export type RequirementFlag = "low_confidence" | "missing_source" | "missing_location" | "corrected";

export type ExtractedRequirementItem = {
  id: string;
  tender_case_id: string;
  document_id: string | null;
  requirement: string;
  original_requirement: string;
  category: string;
  mandatory: boolean;
  deadline_value: string | null;
  lot_bundle: string | null;
  evaluation_criteria: string | null;
  document_reference: string | null;
  required_evidence: string[];
  confidence: number;
  source_document: string | null;
  source_page: number | null;
  source_paragraph: number | null;
  source_excerpt: string | null;
  review_status: "pending" | "verified" | "rejected";
  corrected_requirement: string | null;
  review_note: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  flags: RequirementFlag[];
};

export const REQUIREMENT_CATEGORIES = [
  "deadline",
  "lots",
  "mandatory",
  "evaluation",
  "evidence",
  "document_reference",
  "general",
] as const;

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage((data as { detail?: unknown }).detail, "Request failed"));
  }
  return data as T;
}

export async function getRequirements(caseId: string): Promise<ExtractedRequirementItem[]> {
  return apiJson<ExtractedRequirementItem[]>(`/tender-cases/${caseId}/requirements`);
}

export async function extractRequirements(caseId: string): Promise<{ created: number; requirements: ExtractedRequirementItem[] }> {
  return apiJson<{ created: number; requirements: ExtractedRequirementItem[] }>(`/tender-cases/${caseId}/extract-requirements`, { method: "POST" });
}

export type RequirementUpdateInput = Partial<Pick<ExtractedRequirementItem,
  "requirement" | "category" | "mandatory" | "review_status" | "review_note" | "deadline_value" |
  "lot_bundle" | "evaluation_criteria" | "document_reference" | "required_evidence">>;

export async function updateRequirement(id: string, input: RequirementUpdateInput): Promise<ExtractedRequirementItem> {
  return apiJson<ExtractedRequirementItem>(`/requirements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type ProposalSectionItem = { id: string; title: string; content: string; status: "draft" | "complete"; sort_order: number };
export type ProposalIssueItem = { id: string; title: string; description: string | null; severity: "low" | "medium" | "high"; resolved: boolean };
export type WorkspaceRequirement = {
  id: string; requirement: string; category: string; mandatory: boolean; review_status: string; confidence: number;
  source_document: string | null; source_page: number | null; source_paragraph: number | null;
};
export type ProposalWorkspace = {
  case_id: string; case_name: string; case_reference: string | null; case_status: string; submission_deadline: string | null;
  sections: ProposalSectionItem[]; issues: ProposalIssueItem[]; requirements: WorkspaceRequirement[];
  approval: { ready: boolean; blockers: string[] };
};

export async function getProposalWorkspace(caseId: string): Promise<ProposalWorkspace> {
  return apiJson<ProposalWorkspace>(`/tender-cases/${caseId}/proposal`);
}

export async function updateProposalSection(id: string, input: Partial<Pick<ProposalSectionItem, "title" | "content" | "status" | "sort_order">>): Promise<ProposalSectionItem> {
  return apiJson<ProposalSectionItem>(`/proposal/sections/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export async function createProposalIssue(caseId: string, input: { title: string; description?: string; severity: "low" | "medium" | "high" }): Promise<ProposalIssueItem> {
  return apiJson<ProposalIssueItem>(`/tender-cases/${caseId}/proposal/issues`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export async function updateProposalIssue(id: string, input: Partial<Pick<ProposalIssueItem, "title" | "description" | "severity" | "resolved">>): Promise<ProposalIssueItem> {
  return apiJson<ProposalIssueItem>(`/proposal/issues/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export async function approveProposal(caseId: string): Promise<{ case_id: string; status: string }> {
  return apiJson<{ case_id: string; status: string }>(`/tender-cases/${caseId}/proposal/approve`, { method: "POST" });
}

export async function downloadProposalExport(caseId: string, format: "docx" | "xlsx"): Promise<void> {
  const response = await authenticatedFetch(`${API_URL}/tender-cases/${caseId}/proposal/export.${format}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(errorMessage((data as { detail?: unknown }).detail, "Export failed"));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  anchor.download = match ? match[1] : `tender-${caseId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}


/* ---------------------- Workflow helpers ---------------------- */

export async function reprocessDocument(caseId: string, documentId: string): Promise<ApiDocument> {
  return apiJson<ApiDocument>(`/tender-cases/${caseId}/documents/${documentId}/reprocess`, { method: "POST" });
}

export async function deleteDocument(caseId: string, documentId: string): Promise<void> {
  const response = await authenticatedFetch(`${API_URL}/tender-cases/${caseId}/documents/${documentId}`, { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(errorMessage((data as { detail?: unknown }).detail, "Unable to delete document"));
  }
}

export async function getCase(caseId: string): Promise<CaseItem> {
  return toCaseItem(await apiJson<ApiCase>(`/tender-cases/${caseId}`));
}

export async function getCaseTransitions(caseId: string): Promise<{ status: CaseStatus; allowed: CaseStatus[] }> {
  return apiJson<{ status: CaseStatus; allowed: CaseStatus[] }>(`/tender-cases/${caseId}/transitions`);
}

export async function updateCaseStatus(caseId: string, status: CaseStatus): Promise<CaseItem> {
  return toCaseItem(await apiJson<ApiCase>(`/tender-cases/${caseId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
  }));
}

export type Citation = {
  requirement_id: string | null; source_document: string | null; source_page: number | null;
  source_paragraph: number | null; confidence: number; review_status: string | null;
};
export type StructuredExtraction = {
  deadlines: (Citation & { value: string; description: string | null })[];
  lots: (Citation & { name: string; description: string | null })[];
  requirements: (Citation & { requirement: string; category: string | null })[];
  evaluation_criteria: (Citation & { criterion: string; weight: string | null })[];
  required_evidence: (Citation & { evidence: string; mandatory: boolean })[];
  document_references: (Citation & { reference: string; context: string | null })[];
};

export async function getStructuredExtraction(caseId: string): Promise<StructuredExtraction> {
  return apiJson<StructuredExtraction>(`/tender-cases/${caseId}/extraction`);
}

export async function createRequirement(caseId: string, input: { requirement: string; category: string; mandatory: boolean; review_note?: string }): Promise<ExtractedRequirementItem> {
  return apiJson<ExtractedRequirementItem>(`/tender-cases/${caseId}/requirements`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export async function getRequirementMatches(requirementId: string, limit = 5): Promise<{ query: string; results: KnowledgeSearchHit[] }> {
  return apiJson<{ query: string; results: KnowledgeSearchHit[] }>(`/requirements/${requirementId}/matches?limit=${limit}`);
}

export async function draftProposalSection(sectionId: string, input: { requirement_ids?: string[]; replace?: boolean } = {}): Promise<ProposalSectionItem> {
  return apiJson<ProposalSectionItem>(`/proposal/sections/${sectionId}/draft`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export async function createProposalSection(caseId: string, title: string, sortOrder: number): Promise<ProposalSectionItem> {
  return apiJson<ProposalSectionItem>(`/tender-cases/${caseId}/proposal/sections`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, sort_order: sortOrder }),
  });
}

export async function generateProposalIssues(caseId: string): Promise<{ created: number; issues: ProposalIssueItem[] }> {
  return apiJson<{ created: number; issues: ProposalIssueItem[] }>(`/tender-cases/${caseId}/proposal/issues/generate`, { method: "POST" });
}

export async function setUserActive(userId: string, isActive: boolean) {
  return apiJson<{ is_active: boolean }>(`/users/${userId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: isActive }),
  });
}
