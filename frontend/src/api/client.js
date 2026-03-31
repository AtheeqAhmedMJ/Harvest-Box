const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const API_PREFIX = "/api/v1";

// ── Token ────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("auth_token");
}

// ── Headers ──────────────────────────────────────────────
function buildHeaders(extra = {}) {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...extra,
  };
}

// ── Safe response parser ─────────────────────────────────
async function parseResponse(res) {
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  return { data, status: res.status, ok: res.ok };
}

// ── Custom Error ─────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

// ── Core Fetch ───────────────────────────────────────────
export async function apiFetch(endpoint, options = {}) {
  // ✅ prevent /v1 duplication
  if (endpoint.startsWith("/v1")) {
    endpoint = endpoint.replace("/v1", "");
  }

  const { headers: extraHeaders, body, ...rest } = options;

  const res = await fetch(`${BASE}${API_PREFIX}${endpoint}`, {
    headers: buildHeaders(extraHeaders),
    ...(body !== undefined && { body }),
    ...rest,
  });

  const { data, status, ok } = await parseResponse(res);

  // 🔐 Auth expired → redirect silently (NO alert)
  if (status === 401) {
    localStorage.removeItem("auth_token");
    window.location.replace("/login");
    throw new ApiError("Session expired. Please login again.", 401, data);
  }

  // ❌ Handle all errors → UI will display
  if (!ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.errors?.[0] ||   // in case of validation arrays
      (typeof data === "string" ? data : null) ||
      `Request failed (${status})`;

    throw new ApiError(message, status, data);
  }

  return data;
}

// ── File Upload ──────────────────────────────────────────
export async function apiUpload(endpoint, formData) {
  if (endpoint.startsWith("/v1")) {
    endpoint = endpoint.replace("/v1", "");
  }

  const token = getToken();

  const res = await fetch(`${BASE}${API_PREFIX}${endpoint}`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  const { data, status, ok } = await parseResponse(res);

  if (status === 401) {
    localStorage.removeItem("auth_token");
    window.location.replace("/login");
    throw new ApiError("Session expired. Please login again.", 401, data);
  }

  if (!ok) {
    const message =
      data?.message ||
      data?.error ||
      (typeof data === "string" ? data : null) ||
      `Upload failed (${status})`;

    throw new ApiError(message, status, data);
  }

  return data;
}

// ── Auth APIs ────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  verifyOtp: (email, otp) =>
    apiFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  resendOtp: (email) =>
    apiFetch("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};