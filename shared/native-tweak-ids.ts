/** IDs that the elevated desktop executor can actually apply. */
export const NATIVE_TWEAK_IDS = [
  "Win32PrioritySeparation", "SetTimerResolution", "SetResponsiveness",
  "GameModeTweaks", "NetworkThrottling", "DisableNagle", "InputLagTCP",
  "DisableNDU", "DisablePrefetch", "EnableHAGS", "DisablePointerPrecision",
  "DisableFastStartup", "DisableGameDVR", "SysVisualBestPerf",
  "DisableTelemetry", "SysHibernateOff", "SetDNSPriority",
  "ClearDnsCache", "DisableMMAgentMemoryCompression", "ResetTcpAutotune",
  "SetHighPerformancePlan",
  "MousePointerSpeed611", "MouseHoverTimeMin",
  "MouseDataQueueSize", "KeyboardRepeatRateMax", "KeyboardRepeatDelayMin",
  "KeyboardDisableStickyKeys", "KeyboardDataQueueSize",
  "WinTitusShowExtensions", "WinTitusShowHidden",
] as const;

export type NativeTweakId = typeof NATIVE_TWEAK_IDS[number];
export const NATIVE_TWEAK_ID_SET: ReadonlySet<string> = new Set(NATIVE_TWEAK_IDS);

/** Highest-impact order used by the hardware-aware free Best 15 flow. */
export const BEST_15_PRIORITY = [
  "Win32PrioritySeparation",
  "GameModeTweaks",
  "SetHighPerformancePlan",
  "SetResponsiveness",
  "NetworkThrottling",
  "InputLagTCP",
  "DisableNagle",
  "EnableHAGS",
  "DisableGameDVR",
  "DisablePointerPrecision",
  "DisableFastStartup",
  "DisablePrefetch",
  "DisableNDU",
  "SysVisualBestPerf",
  "DisableTelemetry",
  "SysHibernateOff",
  "SetDNSPriority",
] as const;

export function selectBestInstantTweaks(
  candidates: readonly string[],
  chargedIds: ReadonlySet<string>,
  freeRemaining: number,
  pro: boolean,
): { ids: string[]; requestedCount: number } {
  const rank = new Map<string, number>(BEST_15_PRIORITY.map((id, index) => [id, index]));
  const ranked = Array.from(new Set(candidates))
    .filter(id => NATIVE_TWEAK_ID_SET.has(id) && rank.has(id as typeof BEST_15_PRIORITY[number]))
    .sort((a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER));
  const requestedCount = pro ? 15 : Math.min(15, Math.max(0, freeRemaining));
  const available = pro ? ranked : ranked.filter(id => !chargedIds.has(id));
  return { ids: available.slice(0, requestedCount), requestedCount };
}