import { detectAppliedTweaks, getRecordedAppliedTweaks, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";

export interface AppliedTweakSources {
  currentWindows: Record<string, boolean>;
  recordedAt: Record<string, number>;
  nvidiaPresetSubmittedAt: number | null;
}

export async function getAppliedTweakSources(): Promise<AppliedTweakSources> {
  const localHistory = useOptimizationStore.getState().appliedAt;
  const recordedAt: Record<string, number> = { ...localHistory };
  let nvidiaPresetSubmittedAt: number | null = localHistory.NvidiaControlPanelSettings ?? null;
  delete recordedAt.NvidiaControlPanelSettings;
  let currentWindows: Record<string, boolean> = {};
  if (isNative()) {
    const [liveResult, historyResult] = await Promise.allSettled([
      detectAppliedTweaks(),
      getRecordedAppliedTweaks(),
    ]);
    if (liveResult.status === "fulfilled") currentWindows = liveResult.value;
    else console.warn("Windows live tweak detection failed.", liveResult.reason);
    if (historyResult.status === "fulfilled") {
      for (const [id, timestamp] of Object.entries(historyResult.value)) {
        if (id === "NvidiaControlPanelSettings") {
          if (timestamp > 0) {
            nvidiaPresetSubmittedAt = Math.max(nvidiaPresetSubmittedAt ?? 0, timestamp);
          }
          continue;
        }
        recordedAt[id] = Math.max(recordedAt[id] ?? 0, timestamp);
      }
    } else {
      console.warn("Could not read the machine's recorded applied-tweak history.", historyResult.reason);
    }
    if (liveResult.status === "rejected" && historyResult.status === "rejected" && Object.keys(recordedAt).length === 0) {
      throw liveResult.reason;
    }
  }

  return { currentWindows, recordedAt, nvidiaPresetSubmittedAt };
}

/**
 * For recommendations, app history fills gaps in Windows readback, but a
 * known live false always wins over an older success record.
 */
export async function getAppliedTweakState(): Promise<Record<string, boolean>> {
  const { currentWindows, recordedAt } = await getAppliedTweakSources();
  return {
    ...Object.fromEntries(Object.keys(recordedAt).map(id => [id, true])),
    ...currentWindows,
  };
}
