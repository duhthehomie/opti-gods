import { create } from 'zustand';

interface OptimizationState {
  tweaks: Record<string, boolean>;
  nvidiaPreset: string;
  toggleTweak: (key: string) => void;
  setTweak: (key: string, value: boolean) => void;
  setNvidiaPreset: (preset: string) => void;
  setAllTweaks: (tweaks: Record<string, boolean>) => void;
  reset: () => void;
}

const DEFAULT_TWEAKS: Record<string, boolean> = {
  // Registry - CPU
  Win32PrioritySeparation: false,
  DisableHungAppDetection: false,
  EnableLargeSystemCache: false,
  DisablePagefileEncryption: false,
  SetTimerResolution: false,
  // Registry - Network
  NetworkThrottling: false,
  OptimizeTCP: false,
  DisableNagle: false,
  EnableTCPAutoTuning: false,
  DisablePowerThrottling: false,
  SetDNSPriority: false,
  // Registry - Memory
  DisablePrefetch: false,
  ClearPagefileOnShutdown: false,
  DisableMemoryCompression: false,
  OptimizeRAMUsage: false,
  // Registry - Visual/Gaming
  DisableAnimations: true,
  DisableTelemetry: true,
  DisableXboxGameBar: true,
  DisableGameDVR: true,
  EnableHAGS: false,
  DisablePointerPrecision: true,
  // Registry - Power
  SetHighPerformancePlan: false,
  DisableUSBSuspend: false,
  DisableCoreParking: false,
  DisableDynamicTick: false,
  // FiveM
  FiveMCacheClear: false,
  FiveMHighPriority: false,
  FiveMDisablePhysX: false,
  FiveMExtendedMemory: false,
  FiveMNetworkBuffer: false,
  FiveMDisableVSync: false,
  FiveMStreamDistance: false,
  FiveMDisableFullscreen: false,
  FiveMDisableDWM: false,
  FiveMAffinityMask: false,
  FiveMIOPriority: false,
  FiveMDisableP2P: false,
  FiveMDNSOverride: false,
  FiveMQueueFix: false,
  // Process Lasso
  ProcessLassoProBalance: false,
  ProcessLassoSmartTrim: false,
  ProcessLassoRestrain: false,
  ProcessLassoAffinityGaming: false,
  ProcessLassoInstanceBalancer: false,
  ProcessTrimWorkingSet: false,
  ProcessDisableWindowsErrorReporting: false,
  ProcessAutoKillHung: false,
  // Debloat - Apps
  DebloatCortana: false,
  DebloatOneDrive: false,
  DebloatXboxApp: false,
  DebloatXboxGameBar: false,
  DebloatXboxIdentity: false,
  DebloatBing: false,
  DebloatWeather: false,
  DebloatNews: false,
  DebloatMaps: false,
  DebloatSolitaire: false,
  DebloatMixedReality: false,
  DebloatSkype: false,
  DebloatZune: false,
  DebloatOfficeHub: false,
  DebloatFeedback: false,
  DebloatGetHelp: false,
  DebloatGrooveMusic: false,
  DebloatMSPaint3D: false,
  DebloatWindowsCamera: false,
  DebloatYourPhone: false,
  // Debloat - Services
  ServiceDiagTrack: false,
  ServiceWSearch: false,
  ServiceSysMain: false,
  ServiceRemoteReg: false,
  ServiceWMPNetworkSvc: false,
  // Debloat - Privacy
  PrivacyTelemetry: true,
  PrivacyActivityHistory: false,
  PrivacyLocationTracking: false,
  PrivacyAdvertisingID: true,
  PrivacyDiagFeedback: false,
  // Memory
  MemFixedPagefile: false,
  MemDisablePagefile: false,
  MemClearPagefileShutdown: false,
  MemMovePagefileFast: false,
  MemDisableCompression: false,
  MemDisableSuperfetch: false,
  MemTrimStandbyList: false,
  MemDisableKernelPaging: false,
  MemSystemCacheBoost: false,
  MemTrimOnMinimize: false,
  MemLargePageSupport: false,
  MemSetWorkingSetSize: false,
  MemDisableHeapTermination: false,
  MemGPUOptimize: false,
  MemDisableGPUPagefile: false,
  MemGPUSchedulerTweak: false,
  // Startup Apps
  su_discord: true,
  su_spotify: true,
  su_steam: false,
  su_onedrive: true,
  su_teams: true,
  su_skype: false,
  su_zoom: false,
  su_rtss: false,
  su_msiab: false,
  su_nvidia: false,
  su_ccleaner: false,
  su_realtek: false,
  su_logitech: false,
  su_corsair: false,
  su_amdradeon: false,
};

export const useOptimizationStore = create<OptimizationState>((set) => ({
  tweaks: { ...DEFAULT_TWEAKS },
  nvidiaPreset: 'Balanced',

  toggleTweak: (key) => set((state) => ({
    tweaks: { ...state.tweaks, [key]: !state.tweaks[key] }
  })),

  setTweak: (key, value) => set((state) => ({
    tweaks: { ...state.tweaks, [key]: value }
  })),

  setNvidiaPreset: (preset) => set({ nvidiaPreset: preset }),

  setAllTweaks: (tweaks) => set({ tweaks }),

  reset: () => set({ tweaks: { ...DEFAULT_TWEAKS }, nvidiaPreset: 'Balanced' }),
}));
