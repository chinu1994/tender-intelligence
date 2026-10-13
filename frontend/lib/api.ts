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