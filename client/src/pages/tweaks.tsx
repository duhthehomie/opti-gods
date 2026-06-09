import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { EmbeddedProvider } from "@/lib/embedded-context";
import {
  ChevronDown, Settings2, Gamepad2, Crosshair, MonitorPlay, Flame, Monitor, Laptop,
  Cpu, MessageCircle, Power, MemoryStick, Trash2, Server, Wrench, Loader2,
  Swords, Blocks, Target, Eye, Music, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TWEAK_REGISTRY, TOTAL_TWEAK_COUNT, tweaksByCategory, type TweakCategory } from "@/lib/tweak-registry";
import { useHardwareInfo, type HardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useOptimizationStore } from "@/store/use-optimization-store";

const Registry         = lazy(() => import("@/pages/registry"));
const CallOfDuty       = lazy(() => import("@/pages/call-of-duty"));
const Fivem            = lazy(() => import("@/pages/fivem"));
const Fortnite         = lazy(() => import("@/pages/fortnite"));
const RustGame         = lazy(() => import("@/pages/rust-game"));
const RobloxPage       = lazy(() => import("@/pages/roblox"));
const Nvidia           = lazy(() => import("@/pages/nvidia"));
const Amd              = lazy(() => import("@/pages/amd"));
const IntegratedGraphics = lazy(() => import("@/pages/integrated-graphics"));
const LaptopPage       = lazy(() => import("@/pages/laptop"));
const ProcessLasso     = lazy(() => import("@/pages/process-lasso"));
const ProcessesPage    = lazy(() => import("@/pages/processes"));
const DiscordPage      = lazy(() => import("@/pages/discord"));
const StartupApps      = lazy(() => import("@/pages/startup-apps"));
const Memory           = lazy(() => import("@/pages/memory"));
const Debloat          = lazy(() => import("@/pages/debloat"));
const WinTitus         = lazy(() => import("@/pages/wintitus"));
const SpotifyPage      = lazy(() => import("@/pages/spotify"));
const CpuPage          = lazy(() => import("@/pages/cpu"));

type GroupId = "windows" | "network" | "gpu" | "games" | "system";

type Section = {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  group: GroupId;
  Component: React.ComponentType;
  categories: TweakCategory[];
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
  { id: "cod",          title: "Call of Duty (BO6 / Warzone)", desc: "Textures, VRAM overflow, HAGS, network, CPU boost",         icon: Target,        group: "games",   Component: CallOfDuty,         categories: ["cod"] },
  { id: "fivem",        title: "FiveM / GTA V",                desc: "Priority, cache, streaming, network buffers",               icon: Gamepad2,      group: "games",   Component: Fivem,              categories: ["fivem"] },
  { id: "fortnite",     title: "Fortnite",                      desc: "DX12, shader precompile, input lag",                        icon: Crosshair,     group: "games",   Component: Fortnite,           categories: ["fortnite"] },
  { id: "rust",         title: "Rust",                          desc: "FPS uncap, client.cfg tweaks, CPU priority, shadows",       icon: Swords,        group: "games",   Component: RustGame,           categories: ["rust"] },
  { id: "roblox",       title: "Roblox",                        desc: "FPS unlock via FFlags, process priority, post-FX off",      icon: Blocks,        group: "games",   Component: RobloxPage,         categories: ["roblox"] },
  { id: "discord",      title: "Discord",                       desc: "CPU/RAM reduction while gaming",                            icon: MessageCircle, group: "games",   Component: DiscordPage,        categories: ["discord"] },
  { id: "spotify",      title: "Spotify While Gaming",          desc: "Stop Spotify stealing FPS — GPU, CPU priority, bandwidth",  icon: Music,         group: "games",   Component: SpotifyPage,        categories: ["spotify"] },
  { id: "cpu",          title: "CPU Tweaks",                    desc: "Scheduler, power plan, core parking, affinity, Win32Priority", icon: Cpu,         group: "gpu",     Component: CpuPage,            categories: [] as TweakCategory[] },
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
  return section.categories.reduce((sum, c) => sum + tweaksByCategory(c).length, 0);
}

const TAB_STORAGE_KEY  = "optigods_tweaks_active_group";
const SHOW_ALL_KEY     = "optigods_tweaks_show_all";
const ACTIVE_SECT_KEY  = "optigods_tweaks_active_section";

type TabId = "all" | GroupId;
const TABS: { id: TabId; label: string }[] = [
  { id: "all",     label: "All"     },
  { id: "windows", label: "Windows" },
  { id: "network", label: "Network" },
  { id: "gpu",     label: "GPU"     },
  { id: "games",   label: "Games"   },
  { id: "system",  label: "System"  },
];

// ─── Per-section active-tweak count ───────────────────────────────────────────
function sectionActiveTweaks(section: Section, tweaks: Record<string, boolean>): number {
  return section.categories.reduce((sum, c) => {
    return sum + tweaksByCategory(c).filter(t => tweaks[t.id]).length;
  }, 0);
}

// ─── Section card (grid tile + compact sidebar variant) ───────────────────────
function SectionCard({
  section, active, onClick, activeTweaks = 0, compact = false,
}: {
  section: Section;
  active: boolean;
  onClick: () => void;
  activeTweaks?: number;
  compact?: boolean;
}) {
  const Icon  = section.icon;
  const count = sectionCount(section);
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
      {activeTweaks > 0 && count > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">{pct}% configured</span>
          </div>
          <div className="h-1 bg-zinc-800/80 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TweaksPage() {
  const [location] = useLocation();
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
  const detecting = isDetecting(hw);
  const { tweaks } = useOptimizationStore();
  const enabledCount = Object.values(tweaks).filter(Boolean).length;

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

  const filteredSections = applyHardwareFilter(SECTIONS, hw, showAll);
  const visibleSections  = activeTab === "all"
    ? filteredSections
    : filteredSections.filter(s => s.group === activeTab);

  const allForTab   = activeTab === "all" ? SECTIONS : SECTIONS.filter(s => s.group === activeTab);
  const hiddenCount = allForTab.length - visibleSections.length;

  const gpuChip = !detecting && hw.gpuName ? hw.gpuName : null;

  const activeSection = SECTIONS.find(s => s.id === activeSectionId) ?? null;

  function toggle(id: string) {
    setActiveSectionId(prev => prev === id ? null : id);
  }

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
                V3.0.0
              </span>
              {gpuChip && !showAll && (
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
              {activeTab === "all"
                ? `${visibleSections.length} section${visibleSections.length !== 1 ? "s" : ""} matched to your hardware.`
                : `${visibleSections.length} section${visibleSections.length !== 1 ? "s" : ""} in the ${TABS.find(t => t.id === activeTab)?.label} category.`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!detecting && (
              <button
                data-testid="button-toggle-show-all"
                onClick={() => setShowAll(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors",
                  showAll
                    ? "border-zinc-500/40 text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/60"
                    : "border-white/10 text-zinc-500 hover:text-zinc-200 hover:border-white/20 bg-transparent"
                )}
              >
                <Eye className="w-3 h-3" />
                {showAll ? "Matched only" : `Show all${hiddenCount > 0 ? ` (+${hiddenCount} hidden)` : ""}`}
              </button>
            )}
          </div>
        </header>

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
                {isFiltered && !showAll && (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" title="Some tabs hidden by hardware filter" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hidden tabs notice */}
        {!showAll && !detecting && hiddenCount > 0 && (
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
                      activeTweaks={sectionActiveTweaks(s, tweaks)}
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
                      <span className="text-[10px] text-zinc-600 font-mono">— {sectionCount(activeSection)} tweaks</span>
                      {(() => {
                        const on = sectionActiveTweaks(activeSection, tweaks);
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
                    activeTweaks={sectionActiveTweaks(s, tweaks)}
                  />
                ))}
              </div>
            )}
        </>
      </div>
    </AppLayout>
  );
}
