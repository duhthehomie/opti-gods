import { useState, useEffect } from "react";

const TOKEN_KEY = "optigods_session_v2";
const ADMIN_PREVIEW_KEY = "optigods_admin_preview";
const PRO_EVENT = "optigods_pro_changed";

let _verifiedPro: boolean | null = null;
let _verifyPromise: Promise<boolean> | null = null;
let _verifyGen = 0; // Incremented whenever a pending verify should be discarded

// ─── Admin preview (testing toggle) ─────────────────────────────────────────

export function getAdminPreview(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_PREVIEW_KEY) === "1";
}

export function setAdminPreview(active: boolean): void {
  if (active) {
    localStorage.setItem(ADMIN_PREVIEW_KEY, "1");
  } else {
    localStorage.removeItem(ADMIN_PREVIEW_KEY);
  }
  window.dispatchEvent(new Event(PRO_EVENT));
}

// ─── Customer Pro session ────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setProSession(sessionToken: string): void {
  localStorage.setItem(TOKEN_KEY, sessionToken);
  _verifiedPro = true;
  _verifyPromise = null;
  _verifyGen++;
  window.dispatchEvent(new Event(PRO_EVENT));
}

export function clearProStatus(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_PREVIEW_KEY);
  _verifiedPro = false;
  _verifyPromise = null;
  _verifyGen++;
  window.dispatchEvent(new Event(PRO_EVENT));
}

async function verifyWithServer(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  const gen = _verifyGen;
  try {
    const res = await fetch("/api/pro/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    });
    if (gen !== _verifyGen) return _verifiedPro ?? !!getStoredToken();
    if (!res.ok) return !!getStoredToken();
    const data = await res.json();
    if (gen !== _verifyGen) return _verifiedPro ?? !!getStoredToken();
    const valid = !!data.valid;
    _verifiedPro = valid;
    if (!valid) localStorage.removeItem(TOKEN_KEY);
    return valid;
  } catch {
    return gen === _verifyGen ? !!getStoredToken() : (_verifiedPro ?? false);
  }
}

export function getProStatus(): boolean {
  if (typeof window === "undefined") return false;
  if (getAdminPreview()) return true;
  if (_verifiedPro !== null) return _verifiedPro;
  return !!getStoredToken();
}

export function useProStatus(): boolean {
  const [isPro, setIsPro] = useState(getProStatus);

  useEffect(() => {
    const update = () => setIsPro(getProStatus());
    window.addEventListener(PRO_EVENT, update);
    window.addEventListener("storage", update);

    if (_verifyPromise === null && getStoredToken() && !getAdminPreview()) {
      const capturedGen = _verifyGen;
      _verifyPromise = verifyWithServer().then(valid => {
        if (_verifyGen !== capturedGen) return valid;
        _verifiedPro = valid;
        window.dispatchEvent(new Event(PRO_EVENT));
        return valid;
      });
    }

    return () => {
      window.removeEventListener(PRO_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return isPro;
}

export function setProStatus(value: boolean, sessionToken?: string): void {
  if (value && sessionToken) {
    setProSession(sessionToken);
  } else if (!value) {
    clearProStatus();
  }
}
