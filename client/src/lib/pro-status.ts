import { useState, useEffect } from "react";

const TOKEN_KEY = "optigods_session_v2"; // stores server-issued hex token, NOT "true"
const PRO_EVENT = "optigods_pro_changed";

// In-memory verified state — cleared on page refresh and re-verified from server
// This means manipulating localStorage does nothing without a valid server session
let _verifiedPro: boolean | null = null;
let _verifyPromise: Promise<boolean> | null = null;

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setProSession(sessionToken: string): void {
  localStorage.setItem(TOKEN_KEY, sessionToken);
  _verifiedPro = true;
  window.dispatchEvent(new Event(PRO_EVENT));
}

export function clearProStatus(): void {
  localStorage.removeItem(TOKEN_KEY);
  _verifiedPro = false;
  _verifyPromise = null;
  window.dispatchEvent(new Event(PRO_EVENT));
}

// Verify the stored session token with the server
// Returns true only if the server confirms the session is real
async function verifyWithServer(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/pro/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    });
    const data = await res.json();
    _verifiedPro = !!data.valid;
    if (!data.valid) {
      // Token is invalid (was fabricated or expired) — clear it
      localStorage.removeItem(TOKEN_KEY);
    }
    return _verifiedPro;
  } catch {
    // Network error — assume pro if token exists (graceful degradation)
    return !!token;
  }
}

export function getProStatus(): boolean {
  if (typeof window === "undefined") return false;
  // Use in-memory verified state if available
  if (_verifiedPro !== null) return _verifiedPro;
  // Optimistically trust stored token (server verify happens in background)
  return !!getStoredToken();
}

export function useProStatus(): boolean {
  const [isPro, setIsPro] = useState(getProStatus);

  useEffect(() => {
    const update = () => setIsPro(getProStatus());
    window.addEventListener(PRO_EVENT, update);
    window.addEventListener("storage", update);

    // Verify with server in background on mount
    if (_verifyPromise === null && getStoredToken()) {
      _verifyPromise = verifyWithServer().then(valid => {
        _verifiedPro = valid;
        setIsPro(valid);
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

// Legacy compat — keep setProStatus so callers that haven't updated still compile
// But now it requires a token, not just a boolean
export function setProStatus(value: boolean, sessionToken?: string): void {
  if (value && sessionToken) {
    setProSession(sessionToken);
  } else if (!value) {
    clearProStatus();
  }
}
