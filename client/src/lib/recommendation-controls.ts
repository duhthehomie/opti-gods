import { isNative } from "@/lib/tauri-bridge";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { MANUAL_ONLY_TWEAK_IDS } from "@shared/manual-only-tweak-ids";

/**
 * Native recommendation controls must reflect a confirmed runner result, not
 * the user's pending selection. Browser controls intentionally continue to
 * reflect selection because no Windows mutation has occurred there.
 */
export function getPendingRecommendationIds(
  ids: readonly string[],
  tweaks: Record<string, boolean>,
  appliedAt: Record<string, number>,
): string[] {
  const native = isNative();
  return ids.filter(id =>
    !MANUAL_ONLY_TWEAK_IDS.has(id)
      && getTweakCompatibility(id).ok
      && (native ? !appliedAt[id] : !tweaks[id]),
  );
}