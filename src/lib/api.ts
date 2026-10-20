"use client";

// Point at another backend with NEXT_PUBLIC_API_URL (inlined at build time).
const DEFAULT_API_URL = "http://localhost:4100/api/v1";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL
).replace(/\/+$/, "");

const TOKEN_KEY = "vmonie.admin.token";
const PROFILE_KEY = "vmonie.admin.profile";

export type AdminRole =
  | "SUPPORT"
  | "OPERATIONS"
  | "FINANCE"
  | "COMPLIANCE"
  | "SUPER_ADMIN";

/** What the login response says about who signed in (the name is only here). */
export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  roles: AdminRole[];
}

// ─── Session ──────────────────────────────────────────────────────────────
//
// The token lives in memory, mirrored to sessionStorage so a refresh keeps the
// tab signed in. It is never written to localStorage or a cookie: closing
// the tab ends the session.

let token: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (!loaded) {
    token = readStorage(TOKEN_KEY);
    loaded = true;
  }
  return token;
}

export function getStoredProfile(): AdminProfile | null {
  const raw = typeof window === "undefined" ? null : readStorage(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}

export function setSession(accessToken: string, admin: AdminProfile): void {
  token = accessToken;
  loaded = true;
  try {
    sessionStorage.setItem(TOKEN_KEY, accessToken);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(admin));
  } catch {
    // Storage blocked: the session still works for this page load.
  }
  listeners.forEach((l) => l());
}

export function clearSession(): void {
  token = null;
  loaded = true;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function logout(): void {
  clearSession();
  window.location.replace("/login");
}

// ─── Errors ───────────────────────────────────────────────────────────────

/** The backend's `{ code, message, details? }`, plus the HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A message to show the operator for any thrown value. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "FORBIDDEN") {
      const required = err.details?.required;
      const roles = Array.isArray(required) ? required.join(" or ") : null;
      return roles
        ? `${err.message}. Requires the ${roles} role.`
        : err.message;
    }
    return err.message;
  }
  if (err instanceof TypeError) {
    return `Cannot reach the API at ${API_URL}. Check that the backend is running.`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

// ─── Requests ─────────────────────────────────────────────────────────────

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const t = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let json: unknown = undefined;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(
        response.status,
        "BAD_RESPONSE",
        `The server sent an unexpected response (HTTP ${response.status}).`,
      );
    }
  }

  if (!response.ok) {
    const e = (json ?? {}) as {
      code?: string;
      message?: unknown;
      details?: Record<string, unknown>;
    };
    const message =
      typeof e.message === "string" && e.message
        ? e.message
        : `Request failed (HTTP ${response.status})`;
    const error = new ApiError(
      response.status,
      e.code ?? `HTTP_${response.status}`,
      message,
      e.details,
    );
    // An expired or revoked token: back to the login screen. The login call
    // itself also answers 401 for a wrong password, which must stay on screen.
    if (response.status === 401 && path !== "/admin/auth/login") {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login?expired=1");
      }
    }
    throw error;
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
};

/** Build a query string from the non-empty values. */
export function qs(params: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
