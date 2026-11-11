import { detectAppliedTweaks, getRecordedAppliedTweaks, isNative } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { isCurrentNvidiaPresetVerified } from "@/lib/nvidia-preset-eligibility";

export interface AppliedTweakSources {
  currentWindows: Record<string, boolean>;
  recordedAt: Record<string, number>;
  nvidiaPresetSubmittedAt: number | null;
  /** When this read started; successes recorded after it are newer than the snapshot. */
  readAt: number;
}

/**
 * During a long run the Windows snapshot is only re-read at the end, so a
 * success the runner confirmed after the snapshot started must count right
 * away. A "missing" result from before that confirmation is stale for that ID.
 */
export function withLiveRunSuccesses<T extends Pick<AppliedTweakSources, "currentWindows" | "recordedAt" | "readAt">>(
  sources: T,
  appliedAt: Record<string, number>,
): T {
  let currentWindows = sources.currentWindows;
  let recordedAt = sources.recordedAt;
  for (const [id, at] of Object.entries(appliedAt)) {
    if (id === "NvidiaControlPanelSettings" || !(at > sources.readAt)) continue;
    if (recordedAt === sources.recordedAt) recordedAt = { ...recordedAt };
    recordedAt[id] = Math.max(recordedAt[id] ?? 0, at);
    if (currentWindows[id] === false) {
      if (currentWindows === sources.currentWindows) currentWindows = { ...currentWindows };
      delete currentWindows[id];
    }
  }
  return { ...sources, currentWindows, recordedAt };
}

/** Same rule as the Applied Tweaks card: recorded or live-true, minus live conflicts. */
export function countAppliedTweaks(currentWindows: Record<string, boolean>, recordedAt: Record<string, number>): number {
  const ids = new Set<string>();
  for (const [id, at] of Object.entries(recordedAt)) if (at > 0 && id !== "NvidiaControlPanelSettings") ids.add(id);
  for (const [id, on] of Object.entries(currentWindows)) if (on && id !== "NvidiaControlPanelSettings") ids.add(id);
  for (const id of Array.from(ids)) if (currentWindows[id] === false) ids.delete(id);
  if (isCurrentNvidiaPresetVerified()) ids.add("NvidiaControlPanelSettings");
  return ids.size;
}

export function boundedWindowsRead<T>(operation: Promise<T>, label: string, milliseconds = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out. Retry the Windows state check; no success was assumed.`)), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
let pendingSources: Promise<AppliedTweakSources> | null = null;
export function getAppliedTweakSources(): Promise<AppliedTweakSources> {
  if (!pendingSources) pendingSources = readAppliedTweakSources().finally(() => { pendingSources = null; });
  return pendingSources;
}
async function readAppliedTweakSources(): Promise<AppliedTweakSources> {
  const readAt = Date.now();
  const localHistory = useOptimizationStore.getState().appliedAt;
  const recordedAt: Record<string, number> = { ...localHistory };
  let nvidiaPresetSubmittedAt: number | null = localHistory.NvidiaControlPanelSettings ?? null;
  delete recordedAt.NvidiaControlPanelSettings;
  let currentWindows: Record<string, boolean> = {};
  if (isNative()) {
    const [liveResult, historyResult] = await Promise.allSettled([
      boundedWindowsRead(detectAppliedTweaks(), "Live Windows detection"),
      boundedWindowsRead(getRecordedAppliedTweaks(), "Applied history"),
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
    if (liveResult.status === "rejected") {
      throw liveResult.reason;
    }
  }

  return { currentWindows, recordedAt, nvidiaPresetSubmittedAt, readAt };
}

/**
 * For recommendations, app history fills gaps in Windows readback, but a
 * known live false always wins over an older success record.
 */
export async function getAppliedTweakState(): Promise<Record<string, boolean>> {
  const { currentWindows, recordedAt, nvidiaPresetSubmittedAt } = await getAppliedTweakSources();
  return {
    ...Object.fromEntries(Object.keys(recordedAt).filter(id => recordedAt[id] > 0).map(id => [id, true])),
    ...currentWindows,
    NvidiaControlPanelSettings: isCurrentNvidiaPresetVerified(),
  };
}
