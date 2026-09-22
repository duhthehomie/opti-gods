export const AUTH_TRANSITION_EVENT = "optigods:auth-transition";
export const AUTH_TRANSITION_STORAGE_KEY = "optigods_auth_transition";

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

export function beginAuthTransition(): void {
  if (!canUseWindow()) return;
  try {
    sessionStorage.setItem(AUTH_TRANSITION_STORAGE_KEY, "1");
  } catch {
    // The overlay still works for same-page transitions if sessionStorage is unavailable.
  }
  window.dispatchEvent(new Event(AUTH_TRANSITION_EVENT));
}

export function clearAuthTransition(): void {
  if (!canUseWindow()) return;
  try {
    sessionStorage.removeItem(AUTH_TRANSITION_STORAGE_KEY);
  } catch {
    // Best effort — the next load will simply expire the visual transition.
  }
  window.dispatchEvent(new Event(`${AUTH_TRANSITION_EVENT}:end`));
}

export function hasPendingAuthTransition(): boolean {
  if (!canUseWindow()) return false;
  try {
    return sessionStorage.getItem(AUTH_TRANSITION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}