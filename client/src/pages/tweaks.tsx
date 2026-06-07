import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { EmbeddedProvider } from "@/lib/embedded-context";
import {
  ChevronDown, Settings2, Gamepad2, Crosshair, MonitorPlay, Flame, Monitor, Laptop,
  Cpu, MessageCircle, Power, MemoryStick, Trash2, Server, Wrench, Loader2,
  Swords, Blocks, Target, Eye, Music, X, BookmarkCheck, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TWEAK_REGISTRY, TOTAL_TWEAK_COUNT, tweaksByCategory, type TweakCategory } from "@/lib/tweak-registry";
import { useHardwareInfo, type HardwareInfo } from "@/hooks/use-hardware-info";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";

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
    id: "nvidia", title: "NVIDIA Presets", desc: "Low-latency, max performance, Reflex, HAGS",
    icon: MonitorPlay, group: "gpu", Component: Nvidia, categories: ["nvidia"],
    hardwareFilter: (hw) => hw.isNvidia,
  },
  {
    id: "amd", title: "AMD Radeon", desc: "Anti-lag, shader cache, surface format",
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

type TabId = "all" | GroupId | "presets";
const TABS: { id: TabId; label: string }[] = [
  { id: "all",     label: "All"     },
  { id: "windows", label: "Windows" },
  { id: "network", label: "Network" },
  { id: "gpu",     label: "GPU"     },
  { id: "games",   label: "Games"   },
  { id: "system",  label: "System"  },
  { id: "presets", label: "Presets" },
];

// ─── Section card (grid tile) ─────────────────────────────────────────────────
function SectionCard({
  section, active, onClick,
}: { section: Section; active: boolean; onClick: () => void }) {
  const Icon  = section.icon;
  const count = sectionCount(section);
  return (
    <button
      id={`card-${section.id}`}
      onClick={onClick}
      data-testid={`card-${section.id}`}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200 group",
        active
          ? "bg-red-500/8 border-red-500/40 shadow-[inset_0_0_20px_-10px_rgba(239,68,68,0.12)]"
          : "bg-zinc-950/40 border-white/5 hover:border-white/15 hover:bg-zinc-900/50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 transition-colors",
          active ? "bg-red-500/15 border-red-500/30" : "bg-zinc-900 border-white/5 group-hover:border-white/10"
        )}>
          <Icon className={cn("w-4 h-4 transition-colors", active ? "text-red-400" : "text-zinc-400 group-hover:text-zinc-300")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-bold leading-tight truncate transition-colors", active ? "text-white" : "text-zinc-200")}>{section.title}</p>
          <p className="text-[11px] text-zinc-500 leading-tight mt-0.5 line-clamp-2">{section.desc}</p>
        </div>
      </div>
      {count > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border",
            active ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-zinc-900 text-zinc-500 border-white/8"
          )}>
            {count} tweaks
          </span>
          {active && <ChevronDown className="w-3.5 h-3.5 text-red-400 rotate-180" />}
        </div>
      )}
    </button>
  );
}

// ─── Inline Presets Panel ─────────────────────────────────────────────────────
function PresetsPanel() {
  const { tweaks, nvidiaPreset } = useOptimizationStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: savedPresets = [], isError } = useQuery<any[]>({
    queryKey: [api.presets.list.path],
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, config: { tweaks, nvidiaPreset } }),
      });
      if (!res.ok) throw new Error("Failed to save preset");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.presets.list.path] });
      setPresetName("");
      setSaving(false);
      toast({ title: "Preset saved", description: `"${presetName}" added to your presets.` });
    },
    onError: () => {
      toast({ title: "Could not save preset", description: "You must be logged in to save presets.", variant: "destructive" });
      setSaving(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/presets/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.presets.list.path] }),
  });

  const { setAllTweaks, setNvidiaPreset } = useOptimizationStore();

  function loadPreset(preset: any) {
    const cfg = preset.config as { tweaks?: Record<string, boolean>; nvidiaPreset?: string };
    if (cfg?.tweaks) setAllTweaks(cfg.tweaks);
    if (cfg?.nvidiaPreset) setNvidiaPreset(cfg.nvidiaPreset);
    toast({ title: `Preset loaded`, description: `"${preset.name}" applied — toggles updated.` });
  }

  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  if (isError) {
    return (
      <div className="px-6 py-10 text-center">
        <BookmarkCheck className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm font-bold text-zinc-400 mb-1">Login required</p>
        <p className="text-xs text-zinc-600">Presets are linked to your session. Connect via Discord to save and load presets across devices.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-2 space-y-6">
      {/* Save current */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Save current selection</p>
        <p className="text-[11px] text-zinc-600 mb-3">{enabledCount} tweaks currently enabled</p>
        {saving ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Preset name (e.g. FiveM Night Session)..."
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && presetName.trim()) createMutation.mutate(presetName.trim()); if (e.key === "Escape") setSaving(false); }}
              className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/40"
              data-testid="input-preset-name"
            />
            <button
              onClick={() => presetName.trim() && createMutation.mutate(presetName.trim())}
              disabled={createMutation.isPending || !presetName.trim()}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40 transition-colors"
            >
              Save
            </button>
            <button onClick={() => setSaving(false)} className="px-3 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white transition-colors text-sm">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            data-testid="button-save-preset"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors"
          >
            <BookmarkCheck className="w-4 h-4" /> Save Preset
          </button>
        )}
      </div>

      {/* Saved presets */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">{savedPresets.length} saved preset{savedPresets.length !== 1 ? "s" : ""}</p>
        {savedPresets.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">No presets yet — save your current selection above.</div>
        ) : (
          <div className="space-y-2">
            {savedPresets.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-colors" data-testid={`preset-item-${p.id}`}>
                <BookmarkCheck className="w-4 h-4 text-red-500 shrink-0" />
                <span className="flex-1 text-sm font-bold text-white truncate">{p.name}</span>
                <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                  {Object.values((p.config?.tweaks || {}) as Record<string, boolean>).filter(Boolean).length} tweaks
                </span>
                <button
                  onClick={() => loadPreset(p)}
                  data-testid={`button-load-preset-${p.id}`}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40 transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  data-testid={`button-delete-preset-${p.id}`}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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

  const hw = useHardwareInfo();
  const detecting = isDetecting(hw);

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
      setTimeout(() => {
        document.getElementById(`card-${hash}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [location]);

  const filteredSections = applyHardwareFilter(SECTIONS, hw, showAll);
  const visibleSections  = (activeTab === "all" || activeTab === "presets")
    ? filteredSections
    : filteredSections.filter(s => s.group === activeTab);

  const allForTab   = (activeTab === "all" || activeTab === "presets") ? SECTIONS : SECTIONS.filter(s => s.group === activeTab);
  const hiddenCount = allForTab.length - visibleSections.length;

  const gpuChip = !detecting && hw.gpuName ? hw.gpuName : null;

  const activeSection = SECTIONS.find(s => s.id === activeSectionId) ?? null;
  const ActiveIcon    = activeSection?.icon;

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
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800/80 text-zinc-400 border border-white/8 uppercase tracking-wide">
                V3.0.0
              </span>
              {gpuChip && !showAll && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/8 uppercase tracking-wide">
                  <MonitorPlay className="w-3 h-3" />
                  {gpuChip}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {activeTab === "presets"
                ? "Save and load your tweak configurations."
                : activeTab === "all"
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
            const isPresets    = tab.id === "presets";
            const allInGroup   = isPresets ? [] : tab.id === "all" ? SECTIONS : SECTIONS.filter(s => s.group === tab.id);
            const showInGroup  = isPresets ? [] : tab.id === "all" ? filteredSections : filteredSections.filter(s => s.group === tab.id);
            const count        = isPresets ? null : showInGroup.length;
            const isFiltered   = !isPresets && showInGroup.length < allInGroup.length;
            return (
              <button
                key={tab.id}
                data-testid={`tab-tweaks-${tab.id}`}
                onClick={() => { setActiveTab(tab.id); if (tab.id === "presets") setActiveSectionId(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0",
                  activeTab === tab.id
                    ? "bg-red-500/15 border-red-500/40 text-red-300"
                    : "bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-200 hover:border-white/15"
                )}
              >
                {tab.label}
                {count !== null && (
                  <span className={cn(
                    "text-[9px] px-1 py-0.5 rounded font-bold",
                    activeTab === tab.id ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-600"
                  )}>
                    {count}
                  </span>
                )}
                {isFiltered && !showAll && (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" title="Some tabs hidden by hardware filter" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hidden tabs notice */}
        {!showAll && !detecting && hiddenCount > 0 && activeTab !== "presets" && (
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

        {/* ── PRESETS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "presets" && (
          <div className="rounded-xl border border-white/5 bg-zinc-950/40 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
              <BookmarkCheck className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-white">My Presets</h2>
              <p className="text-xs text-zinc-500 ml-1">Save your current toggles as a named preset to reload later.</p>
            </div>
            <PresetsPanel />
          </div>
        )}

        {/* ── SECTION GRID + ACTIVE PANEL ──────────────────────────────────── */}
        {activeTab !== "presets" && (
          <>
            {/* 2-column card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleSections.map(s => (
                <SectionCard
                  key={s.id}
                  section={s}
                  active={activeSectionId === s.id}
                  onClick={() => toggle(s.id)}
                />
              ))}
            </div>

            {/* Active section content panel */}
            {activeSection && (
              <div
                id={activeSection.id}
                className="border border-red-500/20 rounded-xl overflow-hidden scroll-mt-6 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                {/* Panel header */}
                <div className="flex items-center gap-3 px-5 py-3 bg-red-500/5 border-b border-red-500/10">
                  {ActiveIcon && <ActiveIcon className="w-4 h-4 text-red-400 shrink-0" />}
                  <h2 className="text-sm font-bold text-white flex-1 truncate">{activeSection.title}</h2>
                  <span className="text-[10px] text-zinc-600 font-mono hidden sm:block">{sectionCount(activeSection)} tweaks</span>
                  <button
                    onClick={() => setActiveSectionId(null)}
                    data-testid="button-close-section"
                    className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Panel body */}
                <div className="bg-black/40 pt-2 pb-4">
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
            )}

            {/* Empty state */}
            {visibleSections.length === 0 && (
              <div className="text-center py-16 text-zinc-600">
                <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold mb-1">No sections in this category</p>
                <p className="text-xs">Your hardware filter may be hiding them.</p>
                <button onClick={() => setShowAll(true)} className="mt-3 text-xs text-zinc-400 hover:text-white underline">Show all sections</button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
