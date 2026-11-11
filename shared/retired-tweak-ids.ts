/**
 * Tweaks whose trusted Windows script always skips. They were retired because
 * they caused crashes, are unverified, or do not configure current drivers.
 * They can never be applied, so they must never count as "missing".
 */
export const RETIRED_TWEAK_IDS: ReadonlySet<string> = new Set([
  // Retired memory/FiveM actions (crash or game-exit risk).
  "MemDisableKernelPaging", "MemDisableGPUPagefile", "FiveMWorkingSet", "FiveMDisableVSync",
  // Unverified or unrelated to gaming performance.
  "Win11ProcessorIdleMin", "WinTitusAdobeBlock", "WinTitusEdgeRemove", "AmdCpuCapabilities",
  // Legacy NVIDIA registry actions replaced by the verified NVIDIA Preset.
  "NvidiaTripleBufferOff", "NvidiaForceVSyncOff", "FiveMDisablePhysX",
  "NvidiaCUDAPriority", "NvidiaShaderCacheUnlimited", "NvidiaFrameBufferOpt",
]);

/**
 * One-off actions that only work while an app is in a particular state (a game
 * running, Discord closed). They leave no lasting Windows setting to confirm,
 * so they are not part of the applied score.
 */
export const RUNTIME_ONLY_TWEAK_IDS: ReadonlySet<string> = new Set([
  "FortniteAffinityPhysical", "DiscordClearCache",
]);
