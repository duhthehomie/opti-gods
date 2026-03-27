const FPS_IMPACT: Record<string, number> = {
  // ── NVIDIA ────────────────────────────────────────────────────────────────
  EnableHAGS: 5,
  EnableMSIMode: 4,
  NvidiaMaxPerfMode: 4,
  NvidiaPowerMizer: 4,
  NvidiaLowLatency: 3,
  NvidiaOptimizeLatency: 3,
  NvidiaPreRenderedFrames: 3,
  NvidiaForceVSyncOff: 3,
  NvidiaVRAMMax: 3,
  NvidiaThreadedOpt: 2,
  NvidiaShaderCache: 2,
  NvShaderDiskCache: 2,
  NvTextureFilterPerf: 2,
  NvidiaOpenGLOpt: 2,
  NvidiaDisableOverlay: 1,
  NvFXAADriverOff: 1,
  NvidiaAnisoFiltering: 1,
  NvidiaTripleBufferOff: 1,
  NvidiaGSyncOptimize: 1,
  NvidiaReflexEnable: 1,
  NvidiaDisableTelemetry: 0.5,

  // ── AMD ───────────────────────────────────────────────────────────────────
  AmdMaxClockState: 4,
  AmdForcePerformancePowerPlan: 4,
  AmdDisableULPS: 3,
  AmdAntiLag: 3,
  AmdDisableChill: 3,
  AmdDisablePowerEfficiency: 2,
  AmdOptimizeLatency: 2,
  AmdShaderCache: 2,
  AmdTDRTweak: 1,
  AmdDisableTelemetry: 0.5,
  AmdDisableCrashDefender: 0.5,
  AmdDisableStartupApps: 0.5,

  // ── Fortnite ──────────────────────────────────────────────────────────────
  FortniteDisableLumen: 8,
  FortniteLowShadows: 7,
  FortniteDisableMotionBlur: 4,
  FortniteDisableThrottling: 4,
  FortniteHighPriority: 3,
  FortniteAffinityPhysical: 3,
  FortniteEngineStreaming: 3,
  FortniteForceDirectX12: 3,
  FortniteDisableRecording: 2,
  FortniteInputLatency: 1,
  FortniteNetworkBuffer: 0.5,

  // ── FiveM / GTA V ─────────────────────────────────────────────────────────
  FiveMHighPriority: 5,
  FiveMCacheClear: 4,
  FiveMAffinityMask: 3,
  FiveMStreamDistance: 3,
  FiveMIOPriority: 2,
  FiveMExtendedMemory: 2,
  FiveMStreamPool: 2,
  FiveMWorkingSet: 1,
  FiveMDisableNvidiaTelemetry: 0.5,
  FiveMDisablePhysX: 0.5,

  // ── Debloat ───────────────────────────────────────────────────────────────
  DebloatXboxGameBar: 2,
  Win11AutoHDR: 2,
  DebloatXboxApp: 1,
  DebloatXboxIdentity: 1,
  DebloatCortana: 1,
  DebloatOneDrive: 0.5,
  DebloatWeather: 0.5,
  DebloatNews: 0.5,
  Win11Widgets: 0.5,
  Win11TeamsChat: 0.5,
  Win11Copilot: 0.5,

  // ── Laptop performance ────────────────────────────────────────────────────
  Lap_UltimatePerformance: 4,
  Lap_DisableCoreParking: 3,
  Lap_DisableThrottleStates: 3,
  Lap_MaxProcessorStateAC: 2,
  Lap_DisableTurboOnBattery: 0,
  Lap_DisableAdaptiveBrightness: 0.3,
  Lap_DisableHibernate: 0.3,
};

const DEFAULT_UNMAPPED_FPS = 0.25;

export function estimateFpsGain(tweakIds: string[]): { low: number; high: number } {
  if (!tweakIds || tweakIds.length === 0) return { low: 0, high: 0 };

  let raw = 0;
  for (const id of tweakIds) {
    raw += FPS_IMPACT[id] ?? DEFAULT_UNMAPPED_FPS;
  }

  // Diminishing returns — real-world gains plateau; cap around 60
  const effective = raw > 80 ? 60 + Math.log(raw - 79) * 4 : raw;
  const low = Math.max(1, Math.round(effective * 0.55));
  const high = Math.round(effective * 0.85);
  return { low, high };
}
