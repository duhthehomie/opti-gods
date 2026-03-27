import { useState, useEffect } from "react";

const TOKEN_KEY = "optigods_session_v2";
const PRO_EVENT = "optigods_pro_changed";

let _verifiedPro: boolean | null = null;
let _verifyPromise: Promise<boolean> | null = null;

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setProSession(sessionToken: string): void {
  localStorage.setItem(TOKEN_KEY, sessionToken);
  _verifiedPro = true;
  _verifyPromise = null;
  window.dispatchEvent(new Event(PRO_EVENT));
}

export function clearProStatus(): void {
  localStorage.removeItem(TOKEN_KEY);
  _verifiedPro = false;
  _verifyPromise = null;
  window.dispatchEvent(new Event(PRO_EVENT));
}

async function verifyWithServer(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/pro/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    });
    // If rate-limited or server error — don't clear a legitimate session
    if (!res.ok) return !!token;
    const data = await res.json();
    const valid = !!data.valid;
    _verifiedPro = valid;
    if (!valid) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return valid;
  } catch {
    // Network error — trust stored token (graceful degradation)
    return !!token;
  }
}

export function getProStatus(): boolean {
  if (typeof window === "undefined") return false;
  if (_verifiedPro !== null) return _verifiedPro;
  return !!getStoredToken();
}

export function useProStatus(): boolean {
  const [isPro, setIsPro] = useState(getProStatus);

  useEffect(() => {
    const update = () => setIsPro(getProStatus());
    window.addEventListener(PRO_EVENT, update);
    window.addEventListener("storage", update);

    // Fire server verify once per session (skipped if already in progress/done)
    if (_verifyPromise === null && getStoredToken()) {
      _verifyPromise = verifyWithServer().then(valid => {
        _verifiedPro = valid;
        // Dispatch event so EVERY mounted useProStatus instance updates at once
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
