import { useState, useEffect, useMemo } from "react";

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
      } catch (err) {
        // Don't crash — but surface in dev so integration regressions are visible.
        if (import.meta.env.DEV) {
          console.warn("[useDetectedAntiCheats] Tauri bridge threw:", err);
        }
      }
    }
  }, []);

  // Union with the user-asserted toggles (web fallback). Memoized so every
  // TweakRow that consumes this hook gets a stable Set reference per render
  // batch — keeps row re-renders cheap when AC state hasn't changed.
  const vanguard = !!manualToggles?.vanguard;
  const eac = !!manualToggles?.eac;
  const battleye = !!manualToggles?.battleye;
  return useMemo(() => {
    const out = new Set(detected);
    if (vanguard) out.add("Vanguard");
    if (eac) out.add("EAC");
    if (battleye) {
      out.add("BattlEye");
      out.add("FACEIT");
    }
    return out;
  }, [detected, vanguard, eac, battleye]);
}
