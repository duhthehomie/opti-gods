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

export const useOptimizationStore = create<OptimizationState>((set) => ({
  tweaks: {
    // Default mock states
    Win32PrioritySeparation: false,
    NetworkThrottling: false,
    DisableTelemetry: true,
    DisablePrefetch: false,
    OptimizeTCP: false,
    DisableXboxGameBar: true,
    EnableHAGS: true, // Hardware Accelerated GPU Scheduling
    DisableGameDVR: true,
    FiveMCacheClear: false,
    FiveMHighPriority: false,
    ProcessLassoProBalance: false,
    ProcessLassoSmartTrim: false,
    StartupDiscord: true,
    StartupSpotify: true,
    StartupSteam: true,
  },
  nvidiaPreset: 'Balanced',
  
  toggleTweak: (key) => set((state) => ({ 
    tweaks: { ...state.tweaks, [key]: !state.tweaks[key] } 
  })),
  
  setTweak: (key, value) => set((state) => ({
    tweaks: { ...state.tweaks, [key]: value }
  })),
  
  setNvidiaPreset: (preset) => set({ nvidiaPreset: preset }),
  
  setAllTweaks: (tweaks) => set({ tweaks }),
  
  reset: () => set({
    tweaks: {},
    nvidiaPreset: 'Balanced'
  })
}));
