// Resolves API URLs for both web and native (Tauri) shells.
//
// In the web build the app is served from the same Express host as the API,
// so relative paths like "/api/pro/verify" just work.
//
// In the native Tauri build there is NO Express server inside the binary —
// the React bundle is served from `tauri://localhost`. Hitting a relative
// "/api/..." resolves to `tauri://localhost/api/...` which 404s, and the
// downstream `fetch` rejection surfaces as the dreaded "Connection error.
// Please try again." in the Pro paywall and elsewhere.
//
// To fix that we transparently prefix every "/api/..." request with the
// production host when running inside the desktop shell. The host can be
// overridden at build time via VITE_API_BASE_URL.

import { isNative } from "@/lib/tauri-bridge";

const DEFAULT_NATIVE_HOST = "https://28415566-ef27-431a-9269-f09c9a2b3db0-00-2neu2v6wxlc50.worf.replit.dev";

function rawBase(): string {
  const env = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (isNative()) return DEFAULT_NATIVE_HOST;
  return ""; // web → same-origin
}

/**
 * Convert a possibly-relative URL into one that works in both web and Tauri.
 * Absolute URLs (http://, https://, tauri:// …) are returned unchanged.
 */
export function apiUrl(path: string): string {
  if (!path) return path;
  if (/^[a-z]+:\/\//i.test(path)) return path;
  const base = rawBase();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function apiBase(): string {
  return rawBase();
}
