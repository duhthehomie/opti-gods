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
  forcePendingIds?: readonly string[];
}

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "stopped"]);

/** Unconfirmed compatible actions are pending, never silently treated as applied. */
export function getMissingRecommendationIds(
  eligibleIds: Iterable<string>,
  options: MissingRecommendationOptions,
): string[] {
  const ids = Array.from(new Set(eligibleIds));
  if (!options.native) return ids.filter(id => options.selectedState[id] !== true);
  const terminalRun = options.runStatus !== undefined && TERMINAL_RUN_STATUSES.has(options.runStatus);
  const statusById = new Map((options.runItems ?? []).map(item => [item.id, item.status]));
  return ids.filter(id => {
    if (options.forcePendingIds?.includes(id)) return true;
    const status = statusById.get(id);
    if (terminalRun && status === "failed") return true;
    if (!options.stateReady) return false;
    if (options.appliedState[id] === false) return true;
    if (status === "applied" || options.appliedState[id] === true) return false;
    // A skip in an earlier run is not success. Eligibility is checked again
    // by the caller and by the native runner before any Windows mutation.
    return true;
  });
}
