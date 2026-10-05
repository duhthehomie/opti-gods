import { isNative } from "@/lib/tauri-bridge";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { MANUAL_ONLY_TWEAK_IDS } from "@shared/manual-only-tweak-ids";
import { queryClient } from "@/lib/queryClient";
import { getMissingRecommendationIds } from "@/lib/missing-recommendations";
import { readNativeTweakRun } from "@/lib/native-tweak-runner";
import { getTweakMeta } from "@/lib/tweak-registry";

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
  const eligibleIds = ids.filter(id =>
    !MANUAL_ONLY_TWEAK_IDS.has(id)
      && getTweakCompatibility(id).ok
      && getTweakMeta(id)?.safety !== "expert",
  );
  const run = native ? readNativeTweakRun() : null;
  const current = queryClient.getQueryData<Record<string, boolean>>(["native-applied-tweak-state"]);
  return getMissingRecommendationIds(eligibleIds, {
    native,
    stateReady: true,
    appliedState: {
      ...Object.fromEntries(Object.keys(appliedAt).filter(id => appliedAt[id] > 0).map(id => [id, true])),
      ...current,
    },
    selectedState: tweaks,
    runStatus: run?.status,
    runItems: run?.items,
  });
}