import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  Crosshair,
  Gamepad2,
  MemoryStick,
  MessageCircle,
  MonitorPlay,
  Monitor,
  Power,
  Settings2,
  Zap,
  Trash2,
  Search,
  Flame,
  RotateCcw,
  Wrench,
  HardDrive,
  Bell,
  Download,
  ChevronRight,
  Laptop,
  Play,
  TrendingUp,
  Server,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { TOTAL_TWEAKS } from "@/lib/tweak-count";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useProStatus } from "@/lib/pro-status";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  fixAccent?: boolean;
  winTitusAccent?: boolean;
  proAccent?: boolean;
  boostAccent?: boolean;
  aiAccent?: boolean;
  recCount?: number;
};

// Which tweak keys belong to which nav section
const SECTION_PREFIXES: Record<string, string[]> = {
  "/registry":           ["Win32","Disable","Enable","Set","Input","Network","Optimize","ClearPage","Privacy","Service","game_"],
  "/fivem":              ["FiveM"],
  "/fortnite":           ["Fortnite"],
  "/nvidia":             ["Nvidia","Gpu","gpu"],
  "/game-detection":     ["game_"],
  "/process-lasso":      ["ProcessLasso","ProcessAuto","ProcessTrim"],
  "/processes":          ["ProcSvc_"],
  "/discord":            ["Discord"],
  "/memory":             ["Mem","mem"],
  "/debloat":            ["Debloat","Remove","su_debloat"],
  "/startup":            ["su_"],
  "/amd":                ["Amd","amd"],
  "/integrated-graphics":["IntGpu","intgpu"],
  "/laptop":             ["Lap_"],
};

function countForSection(tweaks: Record<string, boolean>, url: string) {
  const prefixes = SECTION_PREFIXES[url];
  if (!prefixes) return 0;
  return Object.entries(tweaks).filter(([k, v]) => v && prefixes.some(p => k.startsWith(p))).length;
}

const navItems: NavItem[] = [
  { title: "Dashboard",           url: "/",                   icon: Activity },
  { title: "Opti Gods AI",        url: "/ai",                 icon: Bot,          aiAccent: true },
  { title: "Quick Boost",         url: "/boost",              icon: TrendingUp,   boostAccent: true },
  { title: "Registry Tweaks",     url: "/registry",           icon: Settings2,    recCount: 20 },
  { title: "FiveM Optimizer",     url: "/fivem",              icon: Gamepad2,     recCount: 13 },
  { title: "Fortnite Optimizer",  url: "/fortnite",           icon: Crosshair,    recCount: 8  },
  { title: "Game Detection",      url: "/game-detection",     icon: Search },
  { title: "NVIDIA Presets",      url: "/nvidia",             icon: MonitorPlay,  recCount: 12 },
  { title: "AMD Optimizer",       url: "/amd",                icon: Flame,        recCount: 9  },
  { title: "Integrated Graphics", url: "/integrated-graphics",icon: Monitor,      recCount: 17 },
  { title: "Laptop Optimizer",    url: "/laptop",             icon: Laptop,       recCount: 29 },
  { title: "Process Lasso",       url: "/process-lasso",      icon: Cpu },
  { title: "Processes Reduction", url: "/processes",          icon: Server, recCount: 20 },
  { title: "Discord Optimizer",   url: "/discord",            icon: MessageCircle,recCount: 5  },
  { title: "Startup Apps",        url: "/startup",            icon: Power },
  { title: "Memory Optimizer",    url: "/memory",             icon: MemoryStick,  recCount: 6  },
  { title: "Debloat Win10/11",    url: "/debloat",            icon: Trash2,       recCount: 10 },
  { title: "WinUtil + OO ShutUp", url: "/wintitus",           icon: Wrench,   winTitusAccent: true },
  { title: "Custom OS",           url: "/custom-os",          icon: HardDrive, proAccent: true },
  { title: "Updates",             url: "/updates",            icon: Bell },
  { title: "Fixes & Restore",     url: "/fixes",              icon: RotateCcw, fixAccent: true },
  { title: "Showcase",            url: "/showcase",           icon: Play },
  { title: "Help & Discord",      url: "/help",               icon: MessageCircle, accent: true },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { tweaks } = useOptimizationStore();
  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const optPct = Math.round((enabledCount / TOTAL_TWEAKS) * 100);
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
  const isPro = useProStatus();

  // Sidebar filtering: hide GPU tabs that don't match detected hardware
  // Only hide if we have confident GPU detection (not just loading/unknown)
  const gpuKnown = !hw.loading && hw.gpuName && hw.gpuName !== "Unknown GPU" && hw.gpuName !== "Detecting...";

  const shouldHide = (url: string): boolean => {
    if (!gpuKnown) return false;
    if (url === "/nvidia") return !hw.isNvidia;
    if (url === "/amd") return !hw.isAMD || hw.isAmdApu;
    if (url === "/integrated-graphics") return !hw.isIntel && !hw.isAmdApu;
    if (url === "/laptop") return !hw.isLaptop;
    return false;
  };

  return (
    <Sidebar className="border-r border-white/5 bg-[#050505]">
      <SidebarHeader className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-500 box-glow shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-lg text-white tracking-tight leading-none">
                OPTI <span className="text-red-500">GODS</span>
              </h1>
              {isPro && (
                <span className="text-[8px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-sm tracking-widest uppercase leading-none">
                  PRO
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">by leaq</p>
          </div>
        </div>

        {/* Optimization meter */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Optimization Level</span>
            <span className={cn(
              "text-[10px] font-bold",
              optPct === 0 ? "text-zinc-600" :
              optPct < 20  ? "text-zinc-400" :
              optPct < 50  ? "text-yellow-400" :
              optPct < 80  ? "text-orange-400" : "text-red-400"
            )}>
              {enabledCount}/{TOTAL_TWEAKS}
            </span>
          </div>
          <div className="relative h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                optPct === 0 ? "bg-zinc-800" :
                optPct < 20  ? "bg-zinc-500" :
                optPct < 50  ? "bg-yellow-500" :
                optPct < 80  ? "bg-orange-500" : "bg-red-500"
              )}
              style={{ width: `${Math.max(optPct, optPct > 0 ? 3 : 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-[9px] font-semibold uppercase tracking-wider",
              optPct === 0 ? "text-zinc-700" :
              optPct < 20  ? "text-zinc-500" :
              optPct < 50  ? "text-yellow-500" :
              optPct < 80  ? "text-orange-500" : "text-red-400"
            )}>
              {optPct === 0 ? "Not optimized" :
               optPct < 20  ? "Light boost" :
               optPct < 50  ? "Medium boost" :
               optPct < 80  ? "High boost" : "Maximum performance"}
            </span>
            {enabledCount > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 gap-0.5">
              {navItems.filter(item => !shouldHide(item.url)).map((item, idx, filteredItems) => {
                const isActive = location === item.url;
                const isAccent = item.accent;
                const isFixAccent = item.fixAccent;
                const isWinTitusAccent = item.winTitusAccent;
                const isProAccent = item.proAccent;
                const isBoostAccent = item.boostAccent;
                const isAiAccent = item.aiAccent;
                const isLast = idx === filteredItems.length - 1;
                const sectionCount = countForSection(tweaks, item.url);
                return (
                  <SidebarMenuItem key={item.title} className={isLast ? "mt-1 pt-1 border-t border-white/5" : ""}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-auto rounded-md transition-all",
                        isActive
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300 font-medium"
                          : isAiAccent
                          ? "text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold"
                          : isAccent
                          ? "text-[#5865F2] hover:text-[#818cf8] hover:bg-[#5865F2]/10"
                          : isFixAccent
                          ? "text-cyan-500 hover:text-cyan-300 hover:bg-cyan-500/10"
                          : isWinTitusAccent
                          ? "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          : isProAccent
                          ? "text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                          : isBoostAccent
                          ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                      )}
                    >
                      <Link href={item.url} className={cn(
                        "relative flex items-center gap-3 py-2.5 rounded-md transition-all overflow-hidden",
                        isActive ? "pl-4 pr-3" : "px-3"
                      )}>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[22px] bg-red-500 rounded-r-full" />
                        )}
                        <item.icon className={cn(
                          "w-4 h-4 shrink-0",
                          isActive ? "text-red-400" :
                          isAiAccent ? "text-red-400" :
                          isAccent ? "text-[#5865F2]" :
                          isFixAccent ? "text-cyan-500" :
                          isWinTitusAccent ? "text-orange-400" :
                          isProAccent ? "text-violet-400" :
                          isBoostAccent ? "text-amber-400" : ""
                        )} />
                        <span className="text-sm flex-1">{item.title}</span>
                        {/* Active tweak count badge for sections */}
                        {sectionCount > 0 && !isProAccent && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                            isActive
                              ? "bg-red-500/20 text-red-300"
                              : "bg-zinc-800 text-zinc-400"
                          )}>
                            {sectionCount}
                          </span>
                        )}
                        {/* Recommended count badge — shown when no active tweaks yet */}
                        {sectionCount === 0 && item.recCount && !isProAccent && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500/70 border border-red-500/15 shrink-0">
                            {item.recCount} rec
                          </span>
                        )}
                        {isProAccent && !isPro && (
                          <span className="ml-auto text-[8px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/25 px-1 py-0.5 rounded uppercase tracking-wider">PRO</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5 space-y-3">
        {/* Download nudge — only when tweaks are selected */}
        {enabledCount > 0 && (
          <div className="relative rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-red-300 leading-tight">
                  {enabledCount} tweak{enabledCount !== 1 ? "s" : ""} selected!
                </p>
                <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                  Click <span className="text-zinc-300 font-semibold">GET MY SCRIPT</span> above ↑
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-red-500/60 shrink-0" />
            </div>
          </div>
        )}

        {/* System info */}
        <div className="px-2 py-2.5 rounded-lg bg-zinc-900/60 border border-white/5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Detected System</p>
          <p className="text-xs text-zinc-400 font-mono truncate">
            {osInfo.loading ? "Detecting..." : osInfo.os}
          </p>
          {osInfo.build && (
            <p className="text-[9px] text-zinc-600 mt-0.5">Build {osInfo.build}</p>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
