import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, getNativeAuthHeaders } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-base";

// Task #41 — Pro tied to Discord user ID (lifetime entitlement).
//
// Source of truth: GET /api/pro/status — reads the authenticated Discord
// session and returns `{ isPro }` from the `pro_entitlements` table.
// Once a user appears in that table they are Pro on every future device.
//
// Legacy fallback: the old localStorage session-token flow still works for
// users who paid before Discord login was required, and for fresh code /
// friend redemptions that haven't been migrated yet. When a logged-in user
// presents a valid legacy token we transparently upgrade it to a permanent
// entitlement via /api/pro/migrate-legacy.

const TOKEN_KEY = "optigods_session_v2";
const PRO_EVENT = "optigods_pro_changed";
const PRO_STATUS_KEY = ["/api/pro/status"] as const;

let _legacyVerified: boolean | null = null;
let _legacyVerifyPromise: Promise<boolean> | null = null;
let _migrationAttempted = false;

// ─── Customer Pro session ────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setProSession(sessionToken: string): void {
  localStorage.setItem(TOKEN_KEY, sessionToken);
  _legacyVerified = true;
  _legacyVerifyPromise = null;
  _migrationAttempted = false; // re-attempt migration with the new token
  // Refresh the entitlement query so any open <ProGate> updates immediately.
  queryClient.invalidateQueries({ queryKey: PRO_STATUS_KEY }).catch(() => {});
  window.dispatchEvent(new Event(PRO_EVENT));
}

export function clearProStatus(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("optigods_admin_preview");
  _legacyVerified = false;
  _legacyVerifyPromise = null;
  _migrationAttempted = false;
  queryClient.invalidateQueries({ queryKey: PRO_STATUS_KEY }).catch(() => {});
  window.dispatchEvent(new Event(PRO_EVENT));
}

async function verifyLegacyWithServer(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch(apiUrl("/api/pro/status"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
      body: JSON.stringify({ sessionToken: token }),
      credentials: "include",
    });
    if (!res.ok) {
      _legacyVerified = false;
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
    const data = await res.json();
    const valid = !!data.valid;
    _legacyVerified = valid;
    if (!valid) localStorage.removeItem(TOKEN_KEY);
    return valid;
  } catch {
    return _legacyVerified ?? false;
  }
}

async function attemptLegacyMigration(): Promise<void> {
  if (_migrationAttempted) return;
  const token = getStoredToken();
  if (!token) return;
  _migrationAttempted = true;
  try {
    const res = await fetch(apiUrl("/api/pro/migrate-legacy"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
      body: JSON.stringify({ sessionToken: token }),
      credentials: "include",
    });
    // 401 = not logged in yet, 200 with migrated:false = invalid token.
    // Either way we want to allow a fresh attempt later (e.g. after the user
    // signs in via Discord), so reset the flag for non-success outcomes.
    if (!res.ok) {
      _migrationAttempted = false;
      return;
    }
    const data = await res.json();
    if (data?.migrated) {
      queryClient.invalidateQueries({ queryKey: PRO_STATUS_KEY }).catch(() => {});
    } else {
      _migrationAttempted = false;
    }
  } catch {
    // Network errors are harmless — try again on next page load.
    _migrationAttempted = false;
  }
}

type ProStatusResponse = { isPro: boolean; source: string | null; grantedAt: string | null; revoked?: boolean };

// Synchronous read used by the few non-React call sites (PowerShell script
// download, etc). Prefer useProStatus() in components.
export function getProStatus(): boolean {
  if (typeof window === "undefined") return false;
  const cached = queryClient.getQueryData<ProStatusResponse>(PRO_STATUS_KEY);
  if (cached?.isPro) return true;
  if (_legacyVerified !== null) return _legacyVerified;
  return !!getStoredToken();
}

export function useProStatus(): boolean {
  // Primary signal — Discord-keyed entitlement. 60s stale time keeps the UI
  // snappy without hammering the endpoint on every render.
  const { data } = useQuery<ProStatusResponse>({
    queryKey: PRO_STATUS_KEY,
    staleTime: 60_000,
  });
  const entitled = !!data?.isPro;
  // If the logged-in user was explicitly revoked by an admin, we hard-deny
  // Pro regardless of any lingering legacy localStorage token. This makes
  // admin revoke authoritative across all devices.
  const revoked = !!data?.revoked;

  // Legacy signal — localStorage session token (kept until everyone migrates).
  const [legacyValid, setLegacyValid] = useState<boolean>(() => _legacyVerified ?? !!getStoredToken());

  useEffect(() => {
    const update = () => setLegacyValid(_legacyVerified ?? !!getStoredToken());
    window.addEventListener(PRO_EVENT, update);
    window.addEventListener("storage", update);

    // Verify the legacy token once per session so we don't trust raw localStorage.
    if (_legacyVerifyPromise === null && getStoredToken()) {
      _legacyVerifyPromise = verifyLegacyWithServer().then(valid => {
        setLegacyValid(valid);
        window.dispatchEvent(new Event(PRO_EVENT));
        return valid;
      });
    }

    // If the user is logged in and holds a valid legacy token but no entitlement
    // yet, upgrade it. This is the one-shot bridge from the old flow to the new.
    if (!entitled && getStoredToken()) {
      attemptLegacyMigration();
    }

    return () => {
      window.removeEventListener(PRO_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [entitled]);

  if (revoked) return false;
  return entitled || legacyValid;
}

export function setProStatus(value: boolean, sessionToken?: string): void {
  if (value && sessionToken) {
    setProSession(sessionToken);
  } else if (!value) {
    clearProStatus();
  }
}

// Convenience: explicitly mark this device as Pro after a successful payment
// when we already know the user is logged in (e.g. /payment/success returns
// us here). Forces a fresh entitlement fetch.
export function refreshProStatus(): void {
  queryClient.invalidateQueries({ queryKey: PRO_STATUS_KEY }).catch(() => {});
}

