import { getMissingRecommendationIds } from "@/lib/missing-recommendations";
import { authorizeHardwarePreset } from "@/lib/hardware-preset";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { EmbeddedProvider } from "@/lib/embedded-context";
import {
  ChevronDown, Settings2, Gamepad2, Crosshair, MonitorPlay, Flame, Monitor, Laptop,
  Cpu, MessageCircle, Power, MemoryStick, Trash2, Server, Wrench, Loader2,
  Swords, Blocks, Target, Eye, Music, X, Zap, Shield, Mouse, Keyboard, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TWEAK_REGISTRY, TOTAL_TWEAK_COUNT, tweaksByCategory, type TweakCategory } from "@/lib/tweak-registry";
import { useHardwareInfo, type HardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useAuth } from "@/hooks/use-auth";
import { useProStatus, useProStatusLoading } from "@/lib/pro-status";
import { canRunNvidiaPreset, isCurrentNvidiaPresetVerified } from "@/lib/nvidia-preset-eligibility";
import { ProUnlockButton } from "@/components/pro-gate";
import { BEST_15_IDS_KEY } from "@/lib/queryClient";
import { applyTweakBatch, NVIDIA_PRESET_ACTION_ID } from "@/lib/native-tweak-runner";
import { getAppliedTweakState } from "@/lib/applied-tweak-state";
import { useToast } from "@/hooks/use-toast";
import { isNative } from "@/lib/tauri-bridge";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { computeSmartRecs, getEligibleSmartRecommendationIds } from "@/lib/smart-recommendations";
import {
  readNativeTweakRun,
  subscribeNativeTweakRun,
  type NativeTweakRunState,
} from "@/lib/native-tweak-runner";

const Registry         = lazy(() => import("@/pages/registry"));
const Nvidia           = lazy(() => import("@/pages/nvidia"));
const Amd              = lazy(() => import("@/pages/amd"));
const IntegratedGraphics = lazy(() => import("@/pages/integrated-graphics"));
const LaptopPage       = lazy(() => import("@/pages/laptop"));
const ProcessLasso     = lazy(() => import("@/pages/process-lasso"));
const ProcessesPage    = lazy(() => import("@/pages/processes"));
const StartupApps      = lazy(() => import("@/pages/startup-apps"));
const Memory           = lazy(() => import("@/pages/memory"));
const Debloat          = lazy(() => import("@/pages/debloat"));
const WinTitus         = lazy(() => import("@/pages/wintitus"));
const CpuPage          = lazy(() => import("@/pages/cpu"));
const MouseTweaks      = lazy(() => import("@/pages/mouse-tweaks"));
const KeyboardTweaks   = lazy(() => import("@/pages/keyboard-tweaks"));

type GroupId = "windows" | "network" | "gpu" | "cpu" | "system" | "peripherals";

type Section = {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  group: GroupId;
  Component: React.ComponentType;
  categories: TweakCategory[];
  tweakIds?: string[];
  hardwareFilter?: (hw: HardwareInfo) => boolean;
};

const SECTIONS: Section[] = [
  { id: "debloat",       title: "Debloat Win10/11",            desc: "Remove bloatware, telemetry, background services",         icon: Trash2,        group: "windows", Component: Debloat,            categories: ["debloat"] },
  { id: "wintitus",      title: "WinUtil + OO ShutUp",          desc: "Bundled WinUtil tasks and privacy hardening",              icon: Wrench,        group: "windows", Component: WinTitus,           categories: ["wintitus"] },
  { id: "registry",      title: "Registry, Network & Latency",  desc: "TCP/IP stack, MSI mode, timer resolution, priority",       icon: Settings2,     group: "network", Component: Registry,           categories: ["registry", "network"] },
  {
    id: "nvidia", title: "NVIDIA Tweaks", desc: "Low-latency, max performance, Reflex, HAGS",
    icon: MonitorPlay, group: "gpu", Component: Nvidia, categories: ["nvidia"],
    hardwareFilter: (hw) => hw.isNvidia,
  },
  {
    id: "amd", title: "AMD Tweaks", desc: "Anti-lag, shader cache, surface format",
    icon: Flame, group: "gpu", Component: Amd, categories: ["amd"],
    hardwareFilter: (hw) => hw.isAmdGpu || hw.isAmdApu,
  },
  {
    id: "intgpu", title: "Intel iGPU & AMD Vega", desc: "Integrated GPU tweaks (UHD / Iris / Vega 8)",
    icon: Monitor, group: "gpu", Component: IntegratedGraphics, categories: ["intgpu"],
    hardwareFilter: (hw) => hw.isIntel || hw.isAmdApu,
  },
  {
    id: "laptop", title: "Laptop Optimizer", desc: "Thermal, GPU switching, USB suspend, fan curve",
    icon: Laptop, group: "gpu", Component: LaptopPage, categories: ["laptop"],
    hardwareFilter: (hw) => hw.isLaptop,
  },
  { id: "cpu",          title: "CPU Tweaks",                    desc: "Scheduler, power plan, core parking, affinity, Win32Priority", icon: Cpu,         group: "cpu",     Component: CpuPage,            categories: [] as TweakCategory[],
    tweakIds: [
      "Win32PrioritySeparation","SetTimerResolution","SetResponsiveness","GameModeTweaks",
      "ProcMMCSSGaming","ProcGPUSchedulerHigh","DisableHungAppDetection","DisableAutoMaintenance",
      "SetHighPerformancePlan","DisableCoreParking","CpuBoostModeAggressive","CpuIdleMin100",
      "DisableDynamicTick","DisablePowerThrottlingAdv","DisableUSBSuspend","Win11ParkingCoreOverride","Win11ProcessorIdleMin",
      "ProcNUMAAware","ProcAffinityFPS",
      "SysHypervisorOff","Win11DisableVBS","Win11DisableHVCI","CpuDisableSpectreMitigation","IntelOldGenPowerOpt",
    ],
  },
  { id: "mouse",        title: "Mouse Tweaks",                  desc: "Pointer precision, input buffer, HID power — lowest click latency", icon: Mouse, group: "peripherals",  Component: MouseTweaks,        categories: ["mouse"],
    tweakIds: ["DisablePointerPrecision","MousePointerSpeed611","MouseDataQueueSize","MouseHIDPowerSave","DisableUSBSuspend","MouseHoverTimeMin"],
  },
  { id: "keyboard",     title: "Keyboard Tweaks",               desc: "Filter Keys, repeat rate, input buffer, HID power",         icon: Keyboard,      group: "peripherals",  Component: KeyboardTweaks,     categories: ["keyboard"],
    tweakIds: ["KeyboardDisableFilterKeys","KeyboardDisableStickyKeys","KeyboardRepeatRateMax","KeyboardRepeatDelayMin","KeyboardDataQueueSize","KeyboardHIDPowerSave","DisableUSBSuspend"],
  },
  { id: "memory",       title: "Memory & Pagefile",             desc: "Pagefile, compression, standby trim, RAM profile",          icon: MemoryStick,   group: "system",  Component: Memory,             categories: ["memory"] },
  { id: "startup",      title: "Startup Apps",                  desc: "Disable boot-time apps",                                    icon: Power,         group: "system",  Component: StartupApps,        categories: ["startup"] },
  { id: "process-lasso",title: "Process Lasso",                 desc: "CPU affinity & priority automation",                        icon: Cpu,           group: "system",  Component: ProcessLasso,       categories: ["process-lasso"] },
  { id: "processes",    title: "Process Reduction",             desc: "Disable services & idle processes",                         icon: Server,        group: "system",  Component: ProcessesPage,      categories: ["processes"] },
];

function isDetecting(hw: HardwareInfo): boolean {
  return hw.gpuName === "Detecting..." || hw.gpuName === "";
}

function applyHardwareFilter(sections: Section[], hw: HardwareInfo, showAll: boolean): Section[] {
  if (showAll || isDetecting(hw)) return sections;
  return sections.filter(s => !s.hardwareFilter || s.hardwareFilter(hw));
}

function sectionCount(section: Section): number {
  if (section.tweakIds) return section.tweakIds.length;
  return section.categories.reduce((sum, c) => sum + tweaksByCategory(c).length, 0);
}

function sectionRecommendedIds(section: Section, ids: readonly string[]): string[] {
  return ids.filter(id => section.tweakIds
    ? section.tweakIds.includes(id)
    : section.categories.some(category => TWEAK_REGISTRY.some(t => t.id === id && t.category === category)));
}

const TAB_STORAGE_KEY  = "optigods_tweaks_active_group";
const SHOW_ALL_KEY     = "optigods_tweaks_show_all";
const ACTIVE_SECT_KEY  = "optigods_tweaks_active_section";
function summarizeRunFailures(failures: { id: string; message: string }[]): string {
  const messages = Array.from(new Set(failures.map(failure => failure.message))).slice(0, 2);
  const detail = messages.join(" ");
  const remaining = failures.length - messages.length;
  return `${failures.length} result${failures.length === 1 ? "" : "s"} failed. ${detail}${remaining > 0 ? ` ${remaining} other results are listed in the runner.` : ""}`;
}

type TabId = "all" | GroupId;
const TABS: { id: TabId; label: string }[] = [
  { id: "all",     label: "All"     },
  { id: "windows", label: "Windows" },
  { id: "network", label: "Network" },
  { id: "gpu",     label: "GPU"     },
  { id: "cpu",     label: "CPU"     },
  { id: "peripherals", label: "Peripherals" },
  { id: "system",      label: "System"      },
];

// ─── Per-section active-tweak count ───────────────────────────────────────────
function sectionActiveTweaks(section: Section, activeIds: ReadonlySet<string>): number {
  if (section.tweakIds) return section.tweakIds.filter(id => activeIds.has(id)).length;
  return section.categories.reduce((sum, c) => {
    return sum + tweaksByCategory(c).filter(t => activeIds.has(t.id)).length;
  }, 0);
}

// ─── Section card (grid tile + compact sidebar variant) ───────────────────────
function SectionCard({
  section, active, onClick, activeTweaks = 0, compact = false, eligibleIds, activeIds,
}: {
  section: Section;
  active: boolean;
  onClick: () => void;
  activeTweaks?: number;
  compact?: boolean;
  eligibleIds?: readonly string[];
  activeIds?: ReadonlySet<string>;
}) {
  const Icon  = section.icon;
  const eligible = eligibleIds ? sectionRecommendedIds(section, eligibleIds) : null;
  const profileIncluded = section.id === "nvidia" && eligibleIds?.includes(NVIDIA_PRESET_ACTION_ID) && !eligible?.includes(NVIDIA_PRESET_ACTION_ID);
  const count = (eligible ? eligible.length : sectionCount(section)) + (profileIncluded ? 1 : 0);
  if (eligible && activeIds) activeTweaks = eligible.filter(id => activeIds.has(id)).length;
  if (profileIncluded && activeIds?.has(NVIDIA_PRESET_ACTION_ID)) activeTweaks++;
  const pct   = count > 0 ? Math.min(Math.round((activeTweaks / count) * 100), 100) : 0;

  // ── Compact: slim sidebar nav item ──────────────────────────────────────────
  if (compact) {
    return (
      <button
        id={`card-${section.id}`}
        onClick={onClick}
        data-testid={`card-${section.id}`}
        className={cn(
          "w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 flex items-center gap-2.5 group",
          active
            ? "bg-red-500/10 border-red-500/35 shadow-[inset_0_0_12px_-6px_rgba(239,68,68,0.15)]"
            : "bg-zinc-950/40 border-white/5 hover:border-white/15 hover:bg-zinc-900/50"
        )}
      >
        <div className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center border shrink-0 transition-colors",
          active ? "bg-red-500/15 border-red-500/30" : "bg-zinc-900 border-white/5 group-hover:border-white/10"
        )}>
          <Icon className={cn("w-3.5 h-3.5 transition-colors", active ? "text-red-400" : "text-zinc-500 group-hover:text-zinc-400")} />
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className={cn("text-xs font-bold leading-tight truncate transition-colors", active ? "text-white" : "text-zinc-300")}>{section.title}</p>
          {activeTweaks > 0 && (
            <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {activeTweaks > 0 ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 tabular-nums">
            {activeTweaks}
          </span>
        ) : active ? (
          <ChevronDown className="w-3 h-3 text-red-400 shrink-0" />
        ) : null}
      </button>
    );
  }

  // ── Full: grid card ──────────────────────────────────────────────────────────
  return (
    <button
      id={`card-${section.id}`}
      onClick={onClick}
      data-testid={`card-${section.id}`}
      className={cn(
        "w-full text-left p-5 rounded-xl border transition-all duration-200 group",
        active
          ? "bg-red-500/8 border-red-500/40 shadow-[inset_0_0_28px_-8px_rgba(239,68,68,0.14)]"
          : "bg-zinc-950/50 border-white/6 hover:border-white/18 hover:bg-zinc-900/60"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 transition-colors",
          active ? "bg-red-500/15 border-red-500/35" : "bg-zinc-900/80 border-white/8 group-hover:border-white/15"
        )}>
          <Icon className={cn("w-6 h-6 transition-colors", active ? "text-red-400" : "text-zinc-400 group-hover:text-zinc-300")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-base font-bold leading-tight transition-colors", active ? "text-white" : "text-zinc-100 group-hover:text-white")}>{section.title}</p>
            {activeTweaks > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/35 uppercase tracking-wide tabular-nums animate-in fade-in duration-200">
                {activeTweaks} ON
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed mt-1">{section.desc}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {count > 0 && (
            <span className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border",
              active ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-zinc-800/80 text-zinc-500 border-white/8"
            )}>
              {count} tweaks
            </span>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 transition-all duration-200",
            active ? "text-red-400 rotate-180" : "text-zinc-600 -rotate-90 group-hover:text-zinc-400"
          )} />
        </div>
      </div>
      {count > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">{pct}% configured</span>
          </div>
          <div className="h-1 bg-zinc-800/80 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {count === 0 && <p className="mt-4 text-[10px] text-zinc-500">Manual tools · no automatic recommendations</p>}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TweaksPage() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const hasProEntitlement = useProStatus();
  const proStatusLoading = useProStatusLoading();
  const isPro = isAuthenticated && hasProEntitlement;
  const accessReady = !authLoading && !proStatusLoading;
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try { return (localStorage.getItem(TAB_STORAGE_KEY) as TabId) || "all"; } catch { return "all"; }
  });
  const [showAll, setShowAll] = useState<boolean>(() => {
    try { return localStorage.getItem(SHOW_ALL_KEY) === "1"; } catch { return false; }
  });
  const [activeSectionId, setActiveSectionId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_SECT_KEY) || null; } catch { return null; }
  });
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(260);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - dragStartX.current;
      setSidebarWidth(Math.max(160, Math.min(420, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);
  const detecting = isDetecting(hw);
  const { tweaks } = useOptimizationStore();
  const { toast } = useToast();
  const native = isNative();
  const nvidiaGpuCount = hw.gpus.filter(gpu => gpu.vendor === "nvidia" && !gpu.isIntegrated).length;
  const nvidiaPresetEligible = canRunNvidiaPreset({
    native,
    pro: isPro,
    hardwareScanned: hw.scanned,
    dedicatedNvidiaGpuCount: nvidiaGpuCount,
  });
  const [detectedTweaks, setDetectedTweaks] = useState<Record<string, boolean>>({});
  const [nativeDetectionReady, setNativeDetectionReady] = useState(!native);
  const [nativeDetectionError, setNativeDetectionError] = useState(false);
  const [nativeRun, setNativeRun] = useState<NativeTweakRunState | null>(() => readNativeTweakRun());
  const [confirmApply, setConfirmApply] = useState(false);
  const [applyingMatched, setApplyingMatched] = useState(false);
  useEffect(() => {
    if (!native) return;
    let mounted = true;
    const refreshDetected = () => {
      void getAppliedTweakState()
        .then(state => {
          if (!mounted) return;
          setDetectedTweaks(state);
          setNativeDetectionError(false);
          setNativeDetectionReady(true);
        })
        .catch(() => {
          if (!mounted) return;
          setNativeDetectionError(true);
          setNativeDetectionReady(true);
        });
    };
    const syncRun = (state: NativeTweakRunState | null) => {
      if (!mounted) return;
      setNativeRun(state);
      if (state && ["completed", "failed", "stopped"].includes(state.status)) refreshDetected();
    };
    refreshDetected();
    syncRun(readNativeTweakRun());
    const unsubscribe = subscribeNativeTweakRun(syncRun);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [native]);
  const registryIds = new Set(TWEAK_REGISTRY.map(tweak => tweak.id));
  const displayedActiveIds = new Set(
    native
      ? Object.keys(detectedTweaks).filter(id => detectedTweaks[id] && registryIds.has(id))
      : Object.entries(tweaks).filter(([, enabled]) => enabled).map(([id]) => id),
  );
  if (nvidiaPresetEligible && isCurrentNvidiaPresetVerified()) displayedActiveIds.add(NVIDIA_PRESET_ACTION_ID);
  else displayedActiveIds.delete(NVIDIA_PRESET_ACTION_ID);
  const liveRunActive = native
    && Boolean(nativeRun)
    && ["running", "stopping"].includes(nativeRun!.status);
   if (nativeRun) {
    nativeRun!.items
       .filter(item => item.status === "applied" && registryIds.has(item.id) && detectedTweaks[item.id] !== false)
      .forEach(item => displayedActiveIds.add(item.id));
  }
  const enabledCount = displayedActiveIds.size;
  const showBest15 = !isPro || new URLSearchParams(window.location.search).get("best15") === "1";
  const serverBest15Ids = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(BEST_15_IDS_KEY) || "[]");
      if (!Array.isArray(value)) return [] as string[];
      const knownIds = new Set(TWEAK_REGISTRY.map(tweak => tweak.id));
      return Array.from(new Set(value.filter((id): id is string => typeof id === "string" && knownIds.has(id)))).slice(0, 15);
    } catch {
      return [] as string[];
    }
  })();
  const fallbackBest15Ids = !isPro
    ? getEligibleSmartRecommendationIds(
        Array.from(smartRecs.ids),
        id => getTweakCompatibility(id).ok,
      ).filter(id => TWEAK_REGISTRY.some(tweak => tweak.id === id)).slice(0, 15)
    : [];
  const best15Ids = serverBest15Ids.length > 0 ? serverBest15Ids : fallbackBest15Ids;
  const best15IdSignature = best15Ids.join("|");
  const best15IdSet = useMemo(
    () => new Set(best15IdSignature ? best15IdSignature.split("|") : []),
    [best15IdSignature],
  );
  const best15ServerAuthorized = serverBest15Ids.length > 0;
  const best15 = best15Ids
    .map(id => TWEAK_REGISTRY.find(tweak => tweak.id === id))
    .filter((tweak): tweak is NonNullable<typeof tweak> => Boolean(tweak));
  useEffect(() => {
    if (isPro || !accessReady) return;
    const store = useOptimizationStore.getState();
    const selected = Object.entries(store.tweaks).filter(([, enabled]) => enabled).map(([id]) => id);
    const allowed = best15IdSet.size > 0 ? best15IdSet : new Set(selected.slice(0, 15));
    if (selected.some(id => !allowed.has(id))) {
      store.setAllTweaks(Object.fromEntries(
        Object.keys(store.tweaks).map(id => [id, allowed.has(id) && Boolean(store.tweaks[id])]),
      ));
    }
  }, [isPro, accessReady, best15IdSet]);
  const matchedProIds = getEligibleSmartRecommendationIds(
    [...Array.from(smartRecs.ids), NVIDIA_PRESET_ACTION_ID],
    id => id === NVIDIA_PRESET_ACTION_ID ? nvidiaPresetEligible : getTweakCompatibility(id).ok,
  );
  const missingMatchedIds = getMissingRecommendationIds(matchedProIds, {
    native,
    stateReady: !native || (nativeDetectionReady && !nativeDetectionError),
    appliedState: detectedTweaks,
    selectedState: tweaks,
    runStatus: nativeRun?.status,
    runItems: nativeRun?.items,
    forcePendingIds: native && nvidiaPresetEligible && !isCurrentNvidiaPresetVerified() ? [NVIDIA_PRESET_ACTION_ID] : [],
  });

  const applyMatched = async () => {
    if (applyingMatched || !missingMatchedIds.length) return;
    setApplyingMatched(true);
    try {
      const forceReapplyIds = nativeRun && ["completed", "failed", "stopped"].includes(nativeRun.status)
        ? nativeRun.items.filter(item => item.status === "failed" && missingMatchedIds.includes(item.id)).map(item => item.id)
        : [];
      const result = await applyTweakBatch(missingMatchedIds, undefined, { forceReapplyIds });
      toast({
        title: isNative() ? "Matched tweaks queued" : "Matched tweaks selected",
        description: isNative()
          ? `${result.selectedIds.length} missing hardware-matched tweaks are queued in Applied Tweaks.`
          : `${result.selectedIds.length} missing hardware-matched tweaks are selected for your script.`,
      });
    } catch (error) {
      toast({
        title: "Could not apply matched tweaks",
        description: error instanceof Error ? error.message : "The hardware-matched tweaks could not be started.",
        variant: "destructive",
      });
    } finally {
      setApplyingMatched(false);
    }
  };

  useEffect(() => { try { localStorage.setItem(TAB_STORAGE_KEY, activeTab); } catch {} }, [activeTab]);
  useEffect(() => { try { localStorage.setItem(SHOW_ALL_KEY, showAll ? "1" : "0"); } catch {} }, [showAll]);
  useEffect(() => { try { localStorage.setItem(ACTIVE_SECT_KEY, activeSectionId ?? ""); } catch {} }, [activeSectionId]);

  // Auto-open section from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && SECTIONS.some(s => s.id === hash)) {
      const section = SECTIONS.find(s => s.id === hash);
      if (section) setActiveTab(section.group as TabId);
      setActiveSectionId(hash);
    }
  }, [location]);

  const canShowAll = isPro && showAll;
  const filteredSections = applyHardwareFilter(SECTIONS, hw, canShowAll);
  const visibleSections  = activeTab === "all"
    ? filteredSections
    : filteredSections.filter(s => s.group === activeTab);

  const allForTab   = activeTab === "all" ? SECTIONS : SECTIONS.filter(s => s.group === activeTab);
  const hiddenCount = allForTab.length - visibleSections.length;

  const gpuChip = !detecting && hw.gpuName ? hw.gpuName : null;

  const activeSection = SECTIONS.find(s => s.id === activeSectionId) ?? null;
  const sectionPendingIds = activeSection ? sectionRecommendedIds(activeSection, missingMatchedIds) : [];

  function toggle(id: string) {
    setActiveSectionId(prev => prev === id ? null : id);
  }

  function openRecommendedTweak(id: string, category: TweakCategory) {
    const section = SECTIONS.find(candidate =>
      candidate.tweakIds?.includes(id) || candidate.categories.includes(category)
    );
    if (!section) return;
    setActiveTab(section.group);
    setActiveSectionId(section.id);
    window.setTimeout(() => {
      document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const selectedIds = Object.entries(tweaks)
    .filter(([, enabled]) => enabled)
    .map(([id]) => id)
    .filter(id => isPro || best15IdSet.size === 0 || best15IdSet.has(id))
    .slice(0, isPro ? TWEAK_REGISTRY.length : 15);
  const runSelected = async () => {
    setConfirmApply(false);
    if (!selectedIds.length) return;
    try {
      let allowedIds = best15Ids;
      let requestedIds = selectedIds;
      if (!isPro && !best15ServerAuthorized && native) {
        const approval = await authorizeHardwarePreset();
        allowedIds = approval.authorizedIds.filter(id =>
          id !== NVIDIA_PRESET_ACTION_ID && getTweakCompatibility(id).ok,
        ).slice(0, 15);
        localStorage.setItem(BEST_15_IDS_KEY, JSON.stringify(allowedIds));
        if (selectedIds.length === best15Ids.length && best15Ids.every(id => selectedIds.includes(id))) {
          requestedIds = allowedIds;
        }
      }
      const allowed = new Set(allowedIds);
      const safeIds = isPro ? selectedIds : requestedIds.filter(id => allowed.has(id)).slice(0, 15);
      if (!safeIds.length) return;
      const result = await applyTweakBatch(safeIds);
      // Native mode navigates to the live runner. Browser mode still reports
      // selection/compatibility clearly and never claims an OS change.
      if (result.failures.length || result.skippedIds.length) {
        const skippedMessage = result.skippedIds.length
          ? `${result.skippedIds.length} incompatible tweak${result.skippedIds.length === 1 ? " was" : "s were"} skipped without changing Windows.`
          : "";
        toast({
          title: result.failures.length ? "Some selected tweaks failed" : "Incompatible tweaks skipped",
          description: [result.failures.length ? summarizeRunFailures(result.failures) : "", skippedMessage].filter(Boolean).join(" "),
          variant: result.failures.length ? "destructive" : undefined,
        });
      } else if (!isNative()) {
        toast({
          title: `${result.selectedIds.length} tweaks selected`,
          description: "Open the Windows app to apply these changes to your system.",
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Selected tweak run failed",
        description: error instanceof Error ? error.message : "The selected tweaks could not be started.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-white">Tweaks</h1>
              <span
                data-testid="badge-total-tweaks"
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-300 border border-red-500/30 uppercase tracking-wide"
              >
                {TOTAL_TWEAK_COUNT} total
              </span>
              {enabledCount > 0 ? (
                <span
                  data-testid="badge-active-tweaks"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/50 uppercase tracking-wide animate-in fade-in duration-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  {enabledCount} active
                </span>
              ) : null}
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 uppercase tracking-wide">
                V5
              </span>
              {gpuChip && !canShowAll && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/8 uppercase tracking-wide">
                  <MonitorPlay className="w-3 h-3" />
                  {gpuChip}
                </span>
              )}
              {!detecting && hw.cpuLabel && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/8 uppercase tracking-wide">
                  <Cpu className="w-3 h-3" />
                  {hw.cpuLabel}
                </span>
              )}
              {!detecting && hw.ramGB > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/8 uppercase tracking-wide">
                  <MemoryStick className="w-3 h-3" />
                  {hw.ramLabel} RAM
                </span>
              )}
              {!os.loading && os.displayName && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/8 uppercase tracking-wide">
                  <Monitor className="w-3 h-3" />
                  {os.displayName}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {isPro
                ? activeTab === "all"
                  ? `${visibleSections.length} section${visibleSections.length !== 1 ? "s" : ""} matched to your hardware.`
                  : `${visibleSections.length} section${visibleSections.length !== 1 ? "s" : ""} in the ${TABS.find(t => t.id === activeTab)?.label} category.`
                : `Showing up to ${Math.min(best15.length, 15)} hardware-matched tweaks. Full Tweaks is locked on Free.`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              data-testid="button-apply-selected"
              disabled={!selectedIds.length || !accessReady}
              onClick={() => setConfirmApply(true)}
              className="flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap className="h-3 w-3" />
              Apply selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
            </button>
             <button
               type="button"
               data-testid="button-unselect-all"
               disabled={!selectedIds.length}
               onClick={() => {
                 const store = useOptimizationStore.getState();
                 store.setAllTweaks(Object.fromEntries(Object.keys(store.tweaks).map(id => [id, false])));
               }}
               className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-300 hover:bg-white/5 disabled:opacity-40"
             >
               Unselect all
             </button>
             {isPro && !detecting && (
              <button
                data-testid="button-toggle-show-all"
                onClick={() => setShowAll(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors",
                   canShowAll
                    ? "border-zinc-500/40 text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/60"
                    : "border-white/10 text-zinc-500 hover:text-zinc-200 hover:border-white/20 bg-transparent"
                )}
              >
                <Eye className="w-3 h-3" />
                 {canShowAll ? "Matched only" : `Show all${hiddenCount > 0 ? ` (+${hiddenCount} hidden)` : ""}`}
              </button>
            )}
             {!isPro && (
               <ProUnlockButton>
                 <button
                   type="button"
                   data-testid="button-full-tweaks-locked"
                   title="Full Tweaks requires Pro."
                   className="flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-300 transition-colors hover:bg-amber-500/10"
                 >
                   <Lock className="h-3 w-3" />
                   Full Tweaks · Pro
                 </button>
               </ProUnlockButton>
             )}
          </div>
        </header>

        <section
          data-testid="card-matched-pro-inventory"
          className="rounded-xl border border-red-500/25 bg-gradient-to-r from-red-500/10 via-black/60 to-black/50 p-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  {isPro ? matchedProIds.length : Math.min(best15.length, 15)} tweaks match this PC
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {isPro
                  ? native && !nativeDetectionReady
                    ? "Checking which compatible tweaks are already applied on this PC."
                    : native && nativeDetectionError
                      ? "Could not verify applied tweaks, so the missing count is unavailable."
                      : `${missingMatchedIds.length} compatible tweaks are still missing. Already-applied Windows changes are excluded.`
                  : best15ServerAuthorized
                    ? "Free access is limited to the 15 server-authorized picks below. Full Tweaks requires Pro."
                    : "Only a 15-tweak hardware-matched preview is shown. Load a server-authorized Best 15 from the dashboard to apply free changes. Full Tweaks requires Pro."}
              </p>
            </div>
            {isPro ? (
              <button
                type="button"
                data-testid="button-apply-matched-tweaks"
                disabled={applyingMatched || !missingMatchedIds.length || (native && (!nativeDetectionReady || nativeDetectionError))}
                onClick={() => void applyMatched()}
                className="shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-[0_0_20px_-5px_rgba(220,38,38,0.7)] transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {applyingMatched
                  ? "Applying…"
                  : native && !nativeDetectionReady
                    ? "Checking applied state…"
                    : native && nativeDetectionError
                      ? "Applied state unavailable"
                      : missingMatchedIds.length
                        ? `Apply ${missingMatchedIds.length} pending tweaks`
                        : "All matched tweaks already applied"}
              </button>
            ) : (
              <ProUnlockButton>
                <button
                  type="button"
                  data-testid="button-unlock-matched-tweaks"
                  className="shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-[0_0_20px_-5px_rgba(220,38,38,0.7)] transition-colors hover:bg-red-500"
                >
                  Unlock full hardware-matched set
                </button>
              </ProUnlockButton>
            )}
          </div>
        </section>

        {showBest15 && (
          <section className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-zinc-950/80 to-black p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-black text-white">Your Best 15</h2>
                  <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300 border border-red-500/30">
                    Hardware matched
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {isPro
                    ? "These are the hardware-matched recommendations for this PC. Open any one to review its toggle."
                    : best15ServerAuthorized
                      ? "These are the 15 server-authorized picks for this PC. Select only from this list; Windows changes still require server authorization."
                      : "This is a hardware-matched preview. To apply Free tweaks, load the server-authorized Best 15 from the dashboard after scanning."}
                </p>
              </div>
            </div>
            {best15.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {best15.map((tweak, index) => (
                  <button
                    key={tweak.id}
                    type="button"
                    aria-pressed={!isPro ? Boolean(tweaks[tweak.id]) : undefined}
                    onClick={() => {
                      if (isPro) {
                        openRecommendedTweak(tweak.id, tweak.category);
                        return;
                      }
                      const store = useOptimizationStore.getState();
                      store.setTweak(tweak.id, !Boolean(store.tweaks[tweak.id]));
                    }}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      !isPro && tweaks[tweak.id]
                        ? "border-red-500/45 bg-red-500/10"
                        : "border-white/8 bg-black/35 hover:border-red-500/40 hover:bg-red-500/10",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-[10px] font-black text-red-300 border border-red-500/25">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-zinc-100 group-hover:text-white">
                        {tweak.title || tweak.id}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wide text-zinc-600">
                        {tweak.category}
                      </span>
                    </span>
                    {isPro ? (
                      <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-zinc-600 group-hover:text-red-400" />
                    ) : (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                        {tweaks[tweak.id] ? "Selected" : "Select"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
                No recommendations were returned. Run System Scan, then choose “Choose Myself” again.
              </div>
            )}
          </section>
        )}

        {isPro && (
          <>
        {/* Category Tab Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {TABS.map(tab => {
            const allInGroup  = tab.id === "all" ? SECTIONS : SECTIONS.filter(s => s.group === tab.id);
            const showInGroup = tab.id === "all" ? filteredSections : filteredSections.filter(s => s.group === tab.id);
            const count       = showInGroup.length;
            const isFiltered  = showInGroup.length < allInGroup.length;
            return (
              <button
                key={tab.id}
                data-testid={`tab-tweaks-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0",
                  activeTab === tab.id
                    ? "bg-red-500/15 border-red-500/40 text-red-300"
                    : "bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-200 hover:border-white/15"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded font-bold",
                  activeTab === tab.id ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-600"
                )}>
                  {count}
                </span>
                {isFiltered && !canShowAll && (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" title="Some tabs hidden by hardware filter" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hidden tabs notice */}
        {!canShowAll && !detecting && hiddenCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/5 text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
            {hiddenCount} tab{hiddenCount !== 1 ? "s" : ""} hidden — not relevant to your detected hardware ({hw.gpuName}).
            <button
              onClick={() => setShowAll(true)}
              className="ml-auto text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Show anyway
            </button>
          </div>
        )}

        {/* ── SECTION GRID + ACTIVE PANEL ──────────────────────────────────── */}
        <>
          {visibleSections.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold mb-1">No sections in this category</p>
                <p className="text-xs">Your hardware filter may be hiding them.</p>
                <button onClick={() => setShowAll(true)} className="mt-3 text-xs text-zinc-400 hover:text-white underline">Show all sections</button>
              </div>
            ) : activeSection ? (
              /* ── TWO-PANEL: left nav + right content ── */
              <div className="flex gap-0 items-start">
                {/* Left: compact section list */}
                <div
                  className="shrink-0 flex flex-col gap-1.5 sticky top-4 max-h-[calc(100vh-160px)] overflow-y-auto pr-0.5"
                  style={{ width: sidebarWidth, scrollbarWidth: "thin" }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 px-1 mb-1">Sections</p>
                  {visibleSections.map(s => (
                    <SectionCard
                      key={s.id}
                      section={s}
                      active={activeSectionId === s.id}
                      onClick={() => toggle(s.id)}
                      eligibleIds={matchedProIds}
                      activeIds={displayedActiveIds}
                      compact
                    />
                  ))}
                </div>

                {/* Drag handle */}
                <div
                  onMouseDown={onDragStart}
                  className="group shrink-0 w-5 self-stretch flex items-center justify-center cursor-col-resize relative select-none"
                  title="Drag to resize panels"
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/8 group-hover:bg-red-500/50 group-active:bg-red-500/70 transition-colors duration-150" />
                  <div className="relative z-10 w-4 h-10 rounded-sm bg-zinc-900/80 border border-white/10 group-hover:border-red-500/40 group-active:border-red-500/60 flex items-center justify-center transition-all duration-150 group-hover:bg-zinc-800/80 shadow-sm">
                    <div className="flex flex-col gap-[3px]">
                      <div className="w-0.5 h-3.5 rounded-full bg-zinc-600 group-hover:bg-red-400 group-active:bg-red-300 transition-colors duration-150" />
                    </div>
                  </div>
                </div>

                {/* Right: active section content panel */}
                <div
                  id={activeSection.id}
                  className="flex-1 min-w-0 border border-red-500/20 rounded-xl overflow-hidden animate-in fade-in duration-200"
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-zinc-950/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{activeSection.title}</span>
                      <span className="text-[10px] text-zinc-600 font-mono">— {sectionRecommendedIds(activeSection, matchedProIds).length} recommended</span>
                      {isPro && (
                        <Button size="sm" disabled={!sectionPendingIds.length || (native && (!nativeDetectionReady || nativeDetectionError))}
                          onClick={() => void applyTweakBatch(sectionPendingIds, undefined, {
                            forceReapplyIds: nativeRun?.items.filter(item => item.status === "failed").map(item => item.id),
                          }).catch(error => toast({ title: "Could not queue recommendations", description: error instanceof Error ? error.message : String(error), variant: "destructive" }))}
                          data-testid="button-apply-section-recommendations" className="ml-2 bg-red-600 text-[10px]">
                          {sectionPendingIds.length ? `Apply ${sectionPendingIds.length} recommended` : "Recommendations confirmed"}
                        </Button>
                      )}
                      {(() => {
                        const on = sectionActiveTweaks(activeSection, displayedActiveIds);
                        return on > 0 ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                            {on} on
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <button
                      onClick={() => setActiveSectionId(null)}
                      data-testid="button-close-section"
                      className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Panel body — scrollable, fixed height */}
                  <div
                    className="bg-black/40 px-7 pt-7 pb-12 overflow-y-auto"
                    style={{ maxHeight: "calc(100vh - 200px)" }}
                  >
                    <EmbeddedProvider>
                      <Suspense fallback={
                        <div className="flex items-center justify-center py-14">
                          <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                        </div>
                      }>
                        <activeSection.Component />
                      </Suspense>
                    </EmbeddedProvider>
                  </div>
                </div>
              </div>
            ) : (
              /* ── GRID: no section open ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleSections.map(s => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    active={false}
                    onClick={() => toggle(s.id)}
                    eligibleIds={matchedProIds}
                    activeIds={displayedActiveIds}
                  />
                ))}
              </div>
            )}
        </>
          </>
        )}
      </div>
      {confirmApply && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="apply-selected-title">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <h2 id="apply-selected-title" className="text-base font-bold text-white">Confirm Windows changes</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Opti Gods is about to run {selectedIds.length} selected tweak{selectedIds.length === 1 ? "" : "s"}.
                  A verified restore point is required first. Incompatible or unavailable tweaks will fail safely and show their full reason.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmApply(false)} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-white/25 hover:text-white">Cancel</button>
              <button type="button" onClick={() => void runSelected()} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">Confirm and run</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
