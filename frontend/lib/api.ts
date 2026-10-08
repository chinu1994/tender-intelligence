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