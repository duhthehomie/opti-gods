/**
 * Tweaks that must never be included in an automatic recommendation or
 * bulk-apply action. They remain available for an informed manual choice.
 */
export const MANUAL_ONLY_TWEAK_IDS: ReadonlySet<string> = new Set([
  "WinTitusDiskCleanup",
  "FiveMCacheClear",
  "FiveMFixProductId",
  "OpenMsiUtilityPro",
  "DisableSearchIndexing",
  "CodDisableHAGS",
  "FiveM1060DisableHAGS",
  "FiveM1650DisableHAGS",
  "FiveM1650HAGSOffPack",
  "EnableHAGS",
  "FiveM5060EnableHAGS",
  "IGpu_DisableHAGSForIGpu",
  "Lap_DisableHAGS",
]);