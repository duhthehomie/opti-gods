/** Test-stage actions. Deliberately NOT part of automatic Full Optimize yet. */
export const PRO_VALIDATION_ACTION_IDS = [
  "DirectXFiveMCacheRefresh",
  "WindowsGameModeAlignment",
  "NvidiaMsiModeValidation",
] as const;

export function validationActionCompatible(
  id: string,
  hardware: { osVersion?: string; gpuVendor: string },
): { ok: boolean; reason?: string } | undefined {
  if (!(PRO_VALIDATION_ACTION_IDS as readonly string[]).includes(id)) return undefined;
  if (!hardware.osVersion || !["win10", "win11"].includes(hardware.osVersion)) {
    return { ok: false, reason: "Run a Windows 10/11 hardware scan before testing this action." };
  }
  if (id !== "WindowsGameModeAlignment" && hardware.gpuVendor !== "nvidia") {
    return { ok: false, reason: "This test requires an NVIDIA display adapter." };
  }
  return { ok: true };
}
