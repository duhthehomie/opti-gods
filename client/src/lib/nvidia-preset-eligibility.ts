export interface NvidiaPresetEligibilityInput {
  native: boolean;
  pro: boolean;
  hardwareScanned: boolean;
  dedicatedNvidiaGpuCount: number;
}

/**
 * Profile import is supported on one active NVIDIA card, including Optimus/
 * hybrid laptops. The native driver API verifies the current global preset;
 * NVIDIA Control Panel is needed for the separate PhysX/preview controls.
 */
export function canRunNvidiaPreset(input: NvidiaPresetEligibilityInput): boolean {
  return input.native
    && input.pro
    && input.hardwareScanned
    && input.dedicatedNvidiaGpuCount === 1;
}

export const NVIDIA_PRESET_REQUEUE_RELEASE_KEY = "optigods-nvidia-preset-requeue-v5.2.66";
export const NVIDIA_UI_RELEASE_KEY_PREFIX = "optigods-nvidia-ui-v5.2.66-";
export const NVIDIA_UI_IDS = ["NvidiaPreviewPerformance", "NvidiaPhysxGpu"] as const;

export function isCurrentNvidiaPresetVerified(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(NVIDIA_PRESET_REQUEUE_RELEASE_KEY) === "verified"; }
  catch { return false; }
}

/** Display/queue intent only. Scanning never runs or reverifies the preset. */
export function getPendingNvidiaPresetIds(input: NvidiaPresetEligibilityInput): string[] {
  if (!canRunNvidiaPreset(input)) return [];
  const pendingUi = NVIDIA_UI_IDS.filter(id => {
    try { return localStorage.getItem(NVIDIA_UI_RELEASE_KEY_PREFIX + id) !== "verified"; }
    catch { return true; }
  });
  return [...pendingUi, ...(!isCurrentNvidiaPresetVerified() ? ["NvidiaControlPanelSettings"] : [])];
}

export function shouldQueueNvidiaPresetReapplyOnce(input: NvidiaPresetEligibilityInput, alreadyQueued: boolean): boolean {
  return !alreadyQueued && canRunNvidiaPreset(input);
}

export type FullOptimizeNvidiaPresetDecision =
  | { status: "omit" }
  | { status: "queue" }
  | { status: "skip"; reason: string };

export function getFullOptimizeNvidiaPresetDecision(
  input: NvidiaPresetEligibilityInput,
): FullOptimizeNvidiaPresetDecision {
  if (!input.native || !input.pro) return { status: "omit" };
  if (canRunNvidiaPreset(input)) return { status: "queue" };
  if (!input.hardwareScanned) {
    return {
      status: "skip",
      reason: "Run a hardware scan before importing the NVIDIA preset. No NVIDIA profile settings were changed.",
    };
  }
  if (input.dedicatedNvidiaGpuCount === 0) {
    return {
      status: "skip",
      reason: "No dedicated NVIDIA GPU was detected. The NVIDIA preset was not attempted.",
    };
  }
  return {
    status: "skip",
    reason: `The NVIDIA preset requires exactly one dedicated NVIDIA GPU; the scan found ${input.dedicatedNvidiaGpuCount}. No NVIDIA profile settings were changed.`,
  };
}

export function getNvidiaRecommendationIds(
  recommendedIds: readonly string[],
  presetEligible: boolean,
  presetId = "NvidiaControlPanelSettings",
): string[] {
  return Array.from(new Set([
    ...recommendedIds.filter(id => id !== presetId && !NVIDIA_UI_IDS.some(uiId => uiId === id)),
    ...(presetEligible ? [...NVIDIA_UI_IDS, presetId] : []),
  ]));
}
