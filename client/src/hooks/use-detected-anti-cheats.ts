import { useState, useEffect } from "react";

/**
 * Known anti-cheat product identifiers. Used by tweak-registry `incompatibleWith`
 * entries and by TweakRow to grey out tweaks the AC would ban.
 */
export type AntiCheatId = "Vanguard" | "EAC" | "BattlEye" | "FACEIT";

/**
 * Returns the set of anti-cheats currently detected on the user's machine.
 *
 * Web flow: always returns an empty Set (real detection requires kernel access).
 * Tauri build: the native side will populate this via a window.optigods.detect()
 * bridge — when present, it is read once on mount.
 *
 * The web-side opt-in is the user toggling one of the ACDetect* diagnostic
 * tweaks ON — that signals "I know I have this AC installed, treat me as if it
 * were detected" so the TweakRow guard kicks in.
 */
export function useDetectedAntiCheats(
  manualToggles?: { vanguard?: boolean; eac?: boolean; battleye?: boolean }
): Set<AntiCheatId> {
  const [detected, setDetected] = useState<Set<AntiCheatId>>(() => new Set());

  useEffect(() => {
    const bridge = (window as unknown as {
      optigods?: { detectAntiCheats?: () => AntiCheatId[] };
    }).optigods;
    if (bridge?.detectAntiCheats) {
      try {
        setDetected(new Set(bridge.detectAntiCheats()));
      } catch {
        // bridge not ready — leave empty
      }
    }
  }, []);

  // Union with the user-asserted toggles (web fallback)
  const out = new Set(detected);
  if (manualToggles?.vanguard) out.add("Vanguard");
  if (manualToggles?.eac) out.add("EAC");
  if (manualToggles?.battleye) {
    out.add("BattlEye");
    out.add("FACEIT");
  }
  return out;
}
