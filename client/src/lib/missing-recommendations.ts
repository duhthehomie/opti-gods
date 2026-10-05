export interface RecommendationRunItem {
  id: string;
  status: string;
}

export interface MissingRecommendationOptions {
  native: boolean;
  stateReady: boolean;
  appliedState: Readonly<Record<string, boolean>>;
  selectedState: Readonly<Record<string, boolean>>;
  runStatus?: string;
  runItems?: readonly RecommendationRunItem[];
}

const NVIDIA_PRESET_ACTION_ID = "NvidiaControlPanelSettings";
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "stopped"]);

/** One definition of missing/retryable recommendations for every UI surface. */
export function getMissingRecommendationIds(eligibleIds: Iterable<string>, options: MissingRecommendationOptions): string[] {
  const ids = Array.from(new Set(eligibleIds));
  if (!options.native) return ids.filter(id => options.selectedState[id] !== true);
  const terminalRun = options.runStatus !== undefined && TERMINAL_RUN_STATUSES.has(options.runStatus);
  const statusById = new Map<string, string>();
  for (const item of options.runItems ?? []) statusById.set(item.id, item.status);
  return ids.filter(id => {
    const runStatus = statusById.get(id);
    if (runStatus === "skipped") return false;
    if (options.appliedState[id] === false) return true;
    if (runStatus === "applied") return false;
    if (terminalRun && runStatus === "failed") return true;
    if (!options.stateReady) return false;
    if (id === NVIDIA_PRESET_ACTION_ID) return options.appliedState[id] !== true;
    // An absent detector/history entry is unknown, not proof of a missing tweak.
    return false;
  });
}
