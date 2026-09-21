import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-base";

export const NATIVE_TOKEN_KEY = "optigods_native_auth_token";
export const NATIVE_ADMIN_KEY = "optigods_admin_key";
export const DEVICE_ID_KEY = "optigods_device_id";
export const BEST_15_IDS_KEY = "optigods_best_15_ids";
export const PRO_SESSION_KEY = "optigods_session_v2";

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().toLowerCase();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getPersistentDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[a-f0-9-]{36}$/i.test(existing)) return existing.toLowerCase();
    const created = createDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export function getNativeAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem(NATIVE_TOKEN_KEY);
    if (token) headers["X-Native-Auth"] = token;
    const proSession = localStorage.getItem(PRO_SESSION_KEY);
    if (proSession) headers["X-Pro-Session"] = proSession;
    const deviceId = getPersistentDeviceId();
    if (deviceId) headers["X-Device-ID"] = deviceId;
    const adminKey = localStorage.getItem(NATIVE_ADMIN_KEY);
    if (adminKey) headers["X-Admin-Key"] = adminKey;
  } catch { /* localStorage may not be available */ }
  return headers;
}

/**
 * Authentication headers for normal account/Pro API calls.
 *
 * X-Device-ID is intentionally excluded. It belongs only on free-allowance
 * requests; sending it everywhere forces an unnecessary CORS preflight and
 * breaks login/code redemption against older production servers that did not
 * allow that header yet.
 */
export function getNativeSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem(NATIVE_TOKEN_KEY);
    if (token) headers["X-Native-Auth"] = token;
    const proSession = localStorage.getItem(PRO_SESSION_KEY);
    if (proSession) headers["X-Pro-Session"] = proSession;
    const adminKey = localStorage.getItem(NATIVE_ADMIN_KEY);
    if (adminKey) headers["X-Admin-Key"] = adminKey;
  } catch { /* localStorage may not be available */ }
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(apiUrl(url), {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...getNativeSessionHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const res = await fetch(apiUrl(path), {
      credentials: "include",
      headers: getNativeSessionHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
