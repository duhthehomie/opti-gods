import { useEffect, useState, lazy, Suspense, ReactNode } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { EmbeddedProvider } from "@/lib/embedded-context";
import { ChevronDown, Settings2, Gamepad2, Crosshair, MonitorPlay, Flame, Monitor, Laptop, Cpu, MessageCircle, Power, MemoryStick, Trash2, Server, Wrench, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TWEAK_REGISTRY, TOTAL_TWEAK_COUNT, tweaksByCategory, type TweakCategory } from "@/lib/tweak-registry";

const Registry = lazy(() => import("@/pages/registry"));
const Fivem = lazy(() => import("@/pages/fivem"));
const Fortnite = lazy(() => import("@/pages/fortnite"));
const Nvidia = lazy(() => import("@/pages/nvidia"));
const Amd = lazy(() => import("@/pages/amd"));
const IntegratedGraphics = lazy(() => import("@/pages/integrated-graphics"));
const LaptopPage = lazy(() => import("@/pages/laptop"));
const ProcessLasso = lazy(() => import("@/pages/process-lasso"));
const ProcessesPage = lazy(() => import("@/pages/processes"));
const DiscordPage = lazy(() => import("@/pages/discord"));
const StartupApps = lazy(() => import("@/pages/startup-apps"));
const Memory = lazy(() => import("@/pages/memory"));
const Debloat = lazy(() => import("@/pages/debloat"));
const WinTitus = lazy(() => import("@/pages/wintitus"));

type GroupId = "windows" | "network" | "gpu" | "games" | "system";

type Section = {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  group: GroupId;
  Component: React.ComponentType;
  /** Registry categories whose tweaks live in this section (for live counts). */
  categories: TweakCategory[];
};

const SECTIONS: Section[] = [
  { id: "debloat", title: "Debloat Win10/11", desc: "Remove bloatware, telemetry, background services", icon: Trash2, group: "windows", Component: Debloat, categories: ["debloat"] },
  { id: "wintitus", title: "WinUtil + OO ShutUp", desc: "Bundled WinUtil tasks and privacy hardening", icon: Wrench, group: "windows", Component: WinTitus, categories: ["wintitus"] },
  { id: "registry", title: "Registry, Network & Latency", desc: "TCP/IP stack, MSI mode, timer resolution, priority scheduling", icon: Settings2, group: "network", Component: Registry, categories: ["registry", "network"] },
  { id: "nvidia", title: "NVIDIA Presets", desc: "Low-latency, max performance, Reflex, HAGS", icon: MonitorPlay, group: "gpu", Component: Nvidia, categories: ["nvidia"] },
  { id: "amd", title: "AMD Radeon", desc: "Anti-lag, shader cache, surface format", icon: Flame, group: "gpu", Component: Amd, categories: ["amd"] },
  { id: "intgpu", title: "Intel iGPU & AMD Vega", desc: "Integrated GPU tweaks (UHD / Iris / Vega 8)", icon: Monitor, group: "gpu", Component: IntegratedGraphics, categories: ["intgpu"] },
  { id: "laptop", title: "Laptop Optimizer", desc: "Thermal, GPU switching, USB suspend, fan curve", icon: Laptop, group: "gpu", Component: LaptopPage, categories: ["laptop"] },
  { id: "fivem", title: "FiveM / GTA V", desc: "Priority, cache, streaming, network buffers", icon: Gamepad2, group: "games", Component: Fivem, categories: ["fivem"] },
  { id: "fortnite", title: "Fortnite", desc: "DX12, shader precompile, input lag", icon: Crosshair, group: "games", Component: Fortnite, categories: ["fortnite"] },
  { id: "discord", title: "Discord", desc: "CPU/RAM reduction while gaming", icon: MessageCircle, group: "games", Component: DiscordPage, categories: ["discord"] },
  { id: "memory", title: "Memory & Pagefile", desc: "Pagefile, compression, standby trim, RAM profile", icon: MemoryStick, group: "system", Component: Memory, categories: ["memory"] },
  { id: "startup", title: "Startup Apps", desc: "Disable boot-time apps", icon: Power, group: "system", Component: StartupApps, categories: ["startup"] },
  { id: "process-lasso", title: "Process Lasso", desc: "CPU affinity & priority automation", icon: Cpu, group: "system", Component: ProcessLasso, categories: ["process-lasso"] },
  { id: "processes", title: "Process Reduction", desc: "Disable services & idle processes", icon: Server, group: "system", Component: ProcessesPage, categories: ["processes"] },
];

function sectionCount(section: Section): number {
  return section.categories.reduce((sum, c) => sum + tweaksByCategory(c).length, 0);
}

const GROUPS: { id: GroupId; label: string }[] = [
  { id: "windows", label: "Windows" },
  { id: "network", label: "Network" },
  { id: "gpu", label: "GPU" },
  { id: "games", label: "Game-Specific" },
  { id: "system", label: "System" },
];

const STORAGE_KEY = "optigods_tweaks_open_sections";
const TAB_STORAGE_KEY = "optigods_tweaks_active_group";

type TabId = "all" | GroupId;
const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "windows", label: "Windows" },
  { id: "network", label: "Network" },
  { id: "gpu", label: "GPU" },
  { id: "games", label: "Games" },
  { id: "system", label: "System" },
];

function loadOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function Accordion({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  const Icon = section.icon;
  const count = sectionCount(section);
  return (
    <div id={section.id} className="border border-white/5 rounded-xl overflow-hidden bg-zinc-950/40 scroll-mt-20">
      <button
        onClick={onToggle}
        data-testid={`accordion-${section.id}`}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 text-left transition-colors",
          open ? "bg-red-500/5 border-b border-red-500/15" : "hover:bg-zinc-900/60"
        )}
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border shrink-0", open ? "bg-red-500/15 border-red-500/30" : "bg-zinc-900 border-white/5")}>
          <Icon className={cn("w-4 h-4", open ? "text-red-400" : "text-zinc-400")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-bold leading-tight", open ? "text-white" : "text-zinc-200")}>{section.title}</p>
          <p className="text-[11px] text-zinc-500 leading-tight mt-0.5 truncate">{section.desc}</p>
        </div>
        {count > 0 && (
          <span
            data-testid={`count-${section.id}`}
            className={cn(
              "shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border",
              open
                ? "bg-red-500/15 text-red-300 border-red-500/30"
                : "bg-zinc-900 text-zinc-400 border-white/10"
            )}
          >
            {count}
          </span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="bg-black/40">
          <EmbeddedProvider>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-red-400 animate-spin" /></div>}>
              <section.Component />
            </Suspense>
          </EmbeddedProvider>
        </div>
      )}
    </div>
  );
}

export default function TweaksPage() {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(loadOpen);
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try { return (localStorage.getItem(TAB_STORAGE_KEY) as TabId) || "all"; } catch { return "all"; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openMap));
  }, [openMap]);

  useEffect(() => {
    try { localStorage.setItem(TAB_STORAGE_KEY, activeTab); } catch {}
  }, [activeTab]);

  // Auto-open + scroll if hash is set
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && SECTIONS.some(s => s.id === hash)) {
      // Switch to the correct tab for the hash
      const section = SECTIONS.find(s => s.id === hash);
      if (section) setActiveTab(section.group);
      setOpenMap(prev => ({ ...prev, [hash]: true }));
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [location]);

  const toggle = (id: string) => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  const visibleSections = activeTab === "all"
    ? SECTIONS
    : SECTIONS.filter(s => s.group === activeTab);

  const openAll = () => setOpenMap(Object.fromEntries(visibleSections.map(s => [s.id, true])));
  const closeAll = () => setOpenMap(prev => {
    const next = { ...prev };
    visibleSections.forEach(s => { next[s.id] = false; });
    return next;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
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
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {activeTab === "all"
                ? `All ${TOTAL_TWEAK_COUNT} optimization toggles across ${SECTIONS.length} sections.`
                : `${visibleSections.length} section${visibleSections.length !== 1 ? "s" : ""} in the ${TABS.find(t => t.id === activeTab)?.label} category.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={openAll} data-testid="button-expand-all" className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors">Expand All</button>
            <button onClick={closeAll} data-testid="button-collapse-all" className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors">Collapse All</button>
          </div>
        </header>

        {/* Category Tab Bar */}
        <div className="flex gap-1.5 flex-wrap border-b border-white/5 pb-4">
          {TABS.map(tab => {
            const count = tab.id === "all"
              ? SECTIONS.length
              : SECTIONS.filter(s => s.group === tab.id).length;
            return (
              <button
                key={tab.id}
                data-testid={`tab-tweaks-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
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
              </button>
            );
          })}
        </div>

        {/* Sections */}
        <div className="space-y-2">
          {visibleSections.map(s => (
            <Accordion key={s.id} section={s} open={!!openMap[s.id]} onToggle={() => toggle(s.id)} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
