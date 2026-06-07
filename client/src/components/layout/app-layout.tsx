import { ReactNode, useState, useEffect } from "react";
import { useIsEmbedded } from "@/lib/embedded-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { Button } from "@/components/ui/button";
import { Download, X, Zap, MessageSquare, Trophy, Shield, Gamepad2, Monitor, ChevronRight } from "lucide-react";
import { BRAND } from "@/components/branding/assets";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { ScriptDialog } from "../script-dialog";
import { useOsDetection } from "@/hooks/use-os-detection";
import { ProGate } from "@/components/pro-gate";
import { UserChip } from "@/components/user-chip";
import { HardwareDetectionBanner } from "@/components/hardware-detection-banner";
import { ScanGateBanner } from "@/components/scan-gate-banner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useLocation } from "wouter";

const MOBILE_FEATURES = [
  { icon: Zap, title: `${TOTAL_TWEAKS_LABEL} Optimizations`, desc: "Registry, GPU, network, memory, and game-specific tweaks" },
  { icon: Shield, title: "One-Click Script", desc: "Single PowerShell script — everything applied in seconds" },
  { icon: Monitor, title: "Hardware Aware", desc: "Auto-detects your GPU, CPU, and RAM for tailored tweaks" },
  { icon: Gamepad2, title: "Game Packs", desc: "FiveM, Fortnite, Rocket League, Valorant — and more" },
  { icon: Trophy, title: "Real Results", desc: "Users see 2-5× FPS gains with zero compromise" },
  { icon: MessageSquare, title: "AI Assistant", desc: "Ask Opti Gods AI for personalized optimization help" },
];

const MOBILE_RESULTS = [
  { game: "FiveM RP", before: "48", after: "120+", mult: "2.5×", color: "text-red-400", border: "border-red-500/20" },
  { game: "Fortnite", before: "120", after: "300+", mult: "2.5×", color: "text-blue-400", border: "border-blue-500/20" },
  { game: "Integrated GPU", before: "60", after: "300+", mult: "5×", color: "text-emerald-400", border: "border-emerald-500/20" },
];

const MOBILE_PAGE_INFO: Record<string, { title: string; desc: string; tweakCount: string; highlights: string[] }> = {
  "/registry": {
    title: "Registry & System",
    desc: "Deep Windows registry optimizations for timer resolution, priority scheduling, network stack, memory management, and power plan tuning.",
    tweakCount: "45+",
    highlights: ["Win32 Priority Separation", "Timer Resolution 0.5ms", "Nagle Algorithm Bypass", "DPC Latency Fix", "MSI Mode"],
  },
  "/fivem": {
    title: "FiveM Optimization",
    desc: "Dedicated FiveM/GTA V tweaks: priority scheduling, cache management, streaming distance, network buffers, and GPU-specific performance stacks.",
    tweakCount: "45+",
    highlights: ["High Priority Mode", "Cache Clear", "Network Buffer Boost", "Full Performance Stack", "GPU Priority Stack"],
  },
  "/fortnite": {
    title: "Fortnite Optimization",
    desc: "Fortnite-specific tweaks: DirectX 12 optimization, shader compilation, input lag reduction, process priority, and competitive settings.",
    tweakCount: "25+",
    highlights: ["DX12 Optimization", "Shader Precompile", "Input Lag Fix", "Process Priority", "Competitive Config"],
  },
  "/nvidia": {
    title: "NVIDIA GPU",
    desc: "NVIDIA Control Panel and driver-level optimizations: low latency mode, shader cache, power management, Reflex, and G-Sync tuning.",
    tweakCount: "21",
    highlights: ["Ultra Low Latency", "Max Performance Mode", "Shader Cache Unlimited", "Reflex Enable", "HAGS Toggle"],
  },
  "/amd": {
    title: "AMD GPU",
    desc: "AMD Radeon driver optimizations: anti-lag, shader cache, surface format optimization, and power tuning for maximum framerates.",
    tweakCount: "15+",
    highlights: ["Anti-Lag Enable", "Shader Cache Max", "Surface Format Opt", "Power Tuning", "Freesync Optimize"],
  },
  "/integrated-graphics": {
    title: "Integrated Graphics",
    desc: "Tweaks for Intel UHD/Iris and AMD APU integrated GPUs: VRAM allocation, power policy, media decode optimization.",
    tweakCount: "10+",
    highlights: ["VRAM Allocation", "Power Policy", "Media Decode Boost", "Display Optimization", "Driver Tuning"],
  },
  "/laptop": {
    title: "Laptop Optimization",
    desc: "Battery-aware tweaks for laptops: thermal management, GPU switching, display power optimization, and fan curve control.",
    tweakCount: "10+",
    highlights: ["Thermal Management", "GPU Switch Control", "Display Power Opt", "USB Selective Suspend", "Fan Curve Tuning"],
  },
  "/discord": {
    title: "Discord Optimization",
    desc: "Reduce Discord's CPU and RAM usage while gaming: hardware acceleration toggle, voice processing optimization, overlay disable.",
    tweakCount: "8+",
    highlights: ["Hardware Accel Toggle", "Voice Processing Opt", "Overlay Disable", "Bandwidth Reduce", "Startup Disable"],
  },
  "/memory": {
    title: "Memory & RAM",
    desc: "Windows memory management tweaks: pagefile optimization, kernel paging, heap termination, NTFS memory tuning, and compression control.",
    tweakCount: "15+",
    highlights: ["Pagefile Optimization", "Kernel Paging Off", "Heap Termination", "Memory Compression", "NTFS Optimize"],
  },
  "/debloat": {
    title: "Windows Debloat",
    desc: "Remove unnecessary Windows services, scheduled tasks, telemetry, and bloatware to free up CPU cycles and RAM for gaming.",
    tweakCount: "20+",
    highlights: ["Telemetry Disable", "Bloatware Remove", "Service Cleanup", "Task Scheduler Trim", "Cortana Disable"],
  },
  "/startup": {
    title: "Startup Apps",
    desc: "Manage and disable startup applications to reduce boot time and free up system resources for gaming performance.",
    tweakCount: "Custom",
    highlights: ["Boot Time Reduction", "Resource Freeing", "Auto-Start Control", "Service Management", "Priority Ordering"],
  },
  "/process-lasso": {
    title: "Process Lasso",
    desc: "CPU affinity, priority class, and I/O priority optimizations per-process for games and system processes.",
    tweakCount: "10+",
    highlights: ["CPU Affinity", "Priority Class", "I/O Priority", "ProBalance", "Core Parking"],
  },
  "/processes": {
    title: "Process Manager",
    desc: "View and manage running processes, kill unnecessary background tasks, and optimize CPU scheduling for maximum game performance.",
    tweakCount: "System",
    highlights: ["Background Kill", "Priority Boost", "CPU Scheduling", "Memory Trim", "Handle Cleanup"],
  },
  "/game-detection": {
    title: "Game Detection",
    desc: "Automatically detect installed games and scan your hardware (GPU, CPU, RAM) to get personalized tweak recommendations.",
    tweakCount: "Auto",
    highlights: ["Hardware Scanner", "Game Library Detect", "Auto-Recommendations", "GPU Detection", "System Profile"],
  },
  "/task-manager": {
    title: "Task Manager",
    desc: "Kill background apps and remove them from Windows startup — more RAM and CPU dedicated to your games.",
    tweakCount: "Live",
    highlights: ["Kill Background Apps", "Disable Startup Entries", "Browser Cleanup", "Game Launcher Trim", "Cloud Sync Off"],
  },
  "/help": {
    title: "Help & Support",
    desc: "FAQ, crash recovery guide, and direct support via Discord ticket.",
    tweakCount: "Support",
    highlights: ["Safe to Run", "Crash Recovery", "Script Help", "Discord Support", "Ping @leaq"],
  },
};

function MobilePageDescription({ pageInfo }: { pageInfo: { title: string; desc: string; tweakCount: string; highlights: string[] } }) {
  return (
    <div className="min-h-[60vh] space-y-5">
      <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-black border border-red-500/30 flex items-center justify-center overflow-hidden">
            <img src={BRAND.goldPng} alt="Opti Gods" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-white" data-testid="text-mobile-page-title">{pageInfo.title}</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">{pageInfo.tweakCount} tweaks</span>
          </div>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed" data-testid="text-mobile-page-desc">{pageInfo.desc}</p>
      </div>

      <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Key Optimizations</p>
        <div className="space-y-2">
          {pageInfo.highlights.map((h) => (
            <div key={h} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-xs text-zinc-300">{h}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-[11px] text-amber-300 font-semibold">
          Open Opti Gods on your Windows PC to enable and download these tweaks.
        </p>
      </div>

      <div className="space-y-2.5">
        <Link href="/ai">
          <button
            data-testid="button-mobile-page-ai"
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Ask AI About These Tweaks
          </button>
        </Link>
        <Link href="/get-code">
          <button
            data-testid="button-mobile-page-pro"
            className="w-full py-3 rounded-xl bg-zinc-900 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 mt-2"
          >
            <Zap className="w-4 h-4" />
            Get Pro — $15
          </button>
        </Link>
      </div>
    </div>
  );
}

function MobileShowcase() {
  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-y-auto">
      <div className="px-5 pt-8 pb-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-black border border-red-500/30 flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-[0_0_24px_-6px_rgba(239,68,68,0.55)]">
          <img src={BRAND.goldPng} alt="Opti Gods" className="w-14 h-14 object-contain" />
        </div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          OPTI <span className="text-red-500">GODS</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">by leaq</p>
        <p className="text-sm text-zinc-400 mt-3 max-w-xs mx-auto leading-relaxed">
          The ultimate Windows 10/11 PC optimizer. {TOTAL_TWEAKS_LABEL} tweaks. One script. Maximum FPS with lowest latency.
        </p>
      </div>

      <div className="px-5 space-y-3 mb-8">
        {MOBILE_FEATURES.map(f => {
          const FIcon = f.icon;
          return (
            <div key={f.title} className="flex items-start gap-3 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <FIcon className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{f.title}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 mb-8">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 text-center">Real Results</p>
        <div className="space-y-2">
          {MOBILE_RESULTS.map(r => (
            <div key={r.game} className={cn("flex items-center justify-between bg-zinc-900/60 border rounded-xl px-4 py-3", r.border)}>
              <div>
                <p className="text-xs font-bold text-white">{r.game}</p>
                <p className="text-[10px] text-zinc-600">{r.before} → {r.after} FPS</p>
              </div>
              <span className={cn("text-sm font-bold font-display", r.color)}>{r.mult}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-10 space-y-3">
        <Link href="/ai">
          <button
            data-testid="button-mobile-try-ai"
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Try Opti Gods AI
          </button>
        </Link>
        <a href="https://discord.gg/optigods" target="_blank" rel="noopener noreferrer">
          <button
            data-testid="button-mobile-discord"
            className="w-full py-3 rounded-xl bg-zinc-800 border border-white/10 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 mt-3"
          >
            Join Discord
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </a>
        <Link href="/get-code">
          <button
            data-testid="button-mobile-get-pro"
            className="w-full py-3 rounded-xl bg-zinc-900 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 mt-3"
          >
            <Zap className="w-4 h-4" />
            Get Pro — $15
          </button>
        </Link>
      </div>
    </div>
  );
}

const AI_POPUP_KEY = "optigods_ai_popup_dismissed";
const DETECT_POPUP_KEY = "optigods_detect_popup_dismissed";
const OPTIMIZER_PAGES = ["/tweaks", "/tools"];

function SmartAiPopup() {
  const [show, setShow] = useState(false);
  const [location] = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (localStorage.getItem(AI_POPUP_KEY)) return;
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(AI_POPUP_KEY, "1");
  };

  if (isMobile || !show || location !== "/") return null;

  return (
    <div className="fixed bottom-20 right-6 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-4 shadow-2xl shadow-red-500/10 max-w-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-white mb-1">Need help picking tweaks?</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">Ask our AI assistant for personalized recommendations based on your hardware.</p>
            <div className="flex items-center gap-2">
              <Link href="/ai">
                <button
                  data-testid="button-popup-try-ai"
                  onClick={dismiss}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-all"
                >
                  Try AI
                </button>
              </Link>
              <button
                data-testid="button-popup-dismiss"
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 text-[11px] font-bold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-zinc-700 hover:text-zinc-400 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function GameDetectionPopup() {
  const [show, setShow] = useState(false);
  const [location] = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (localStorage.getItem(DETECT_POPUP_KEY)) return;
    const timer = setTimeout(() => setShow(true), 35000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DETECT_POPUP_KEY, "1");
  };

  if (isMobile || !show || (location !== "/" && location !== "/tweaks") || location.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-20 left-6 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="relative bg-zinc-900 border border-zinc-700/60 rounded-2xl p-4 shadow-2xl shadow-black/50 max-w-xs">
        <button onClick={dismiss} className="absolute top-3 right-3 text-zinc-700 hover:text-zinc-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="flex-1 pr-4">
            <p className="text-xs font-bold text-white mb-1">Game Detection</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
              Haven&apos;t run game detection yet? Auto-detect your installed games and apply per-game optimization packs in seconds.
            </p>
            <div className="flex items-center gap-2">
              <Link href="/game-detection">
                <button
                  data-testid="button-detect-popup-scan"
                  onClick={dismiss}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-[11px] font-bold transition-all"
                >
                  Scan Games
                </button>
              </Link>
              <button
                data-testid="button-detect-popup-dismiss"
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 text-[11px] font-bold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingAiButton() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  if (isMobile || !OPTIMIZER_PAGES.includes(location) || location === "/ai") return null;

  return (
    <Link href="/ai">
      <button
        data-testid="button-floating-ai"
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Ask Opti Gods AI"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const embedded = useIsEmbedded();
  if (embedded) return <>{children}</>;
  return <AppLayoutInner>{children}</AppLayoutInner>;
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { tweaks, nvidiaPreset, reset } = useOptimizationStore();
  const osInfo = useOsDetection();

  const handleApply = () => {
    setDialogOpen(true);
  };

  const osLabel = osInfo.loading ? "Detecting..." : osInfo.os;
  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  const isMobileDashboard = isMobile && location === "/";

  if (isMobileDashboard) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full bg-[#020202] text-white overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 relative z-10 overflow-hidden">
            <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-zinc-400 hover:text-white" />
                <span className="font-display font-bold text-sm">OPTI <span className="text-red-500">GODS</span></span>
              </div>
              <Link href="/ai">
                <button data-testid="button-mobile-header-ai" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-500/25 text-red-400 text-[10px] font-bold">
                  <MessageSquare className="w-3 h-3" />
                  AI
                </button>
              </Link>
            </header>
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <MobileShowcase />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#020202] text-white overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative z-10 overflow-hidden">

          {/* Top Header */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-zinc-400 hover:text-white" />
              <div className="h-4 w-px bg-white/10 hidden md:block" />
              <span className="text-xs font-mono text-zinc-500 hidden md:block">
                {osLabel} |{" "}
                {enabledCount > 0 ? (
                  <span className="text-red-400 font-semibold">{enabledCount} tweaks selected</span>
                ) : (
                  <span className="text-zinc-600">no tweaks selected yet</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isMobile && enabledCount > 0 && (
                <Button
                  data-testid="button-clear-all-tweaks"
                  variant="ghost"
                  size="sm"
                  onClick={() => reset()}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 transition-all duration-200 font-mono text-xs px-3"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Unselect All
                </Button>
              )}
              {!isMobile && (
                <ProGate>
                  <Button
                    data-testid="button-apply-optimizations"
                    onClick={handleApply}
                    disabled={false}
                    className={cn(
                      "font-display tracking-wide px-6 border transition-all duration-300",
                      enabledCount > 0
                        ? "bg-red-600 hover:bg-red-500 text-white border-red-400/50 shadow-[0_0_20px_-3px_rgba(239,68,68,0.5)]"
                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {enabledCount > 0 ? `GET MY SCRIPT (${enabledCount})` : "GET MY SCRIPT"}
                  </Button>
                </ProGate>
              )}
              {isMobile && (
                <Link href="/ai">
                  <button data-testid="button-mobile-header-ai-main" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-500/25 text-red-400 text-[10px] font-bold">
                    <MessageSquare className="w-3 h-3" />
                    AI
                  </button>
                </Link>
              )}
              <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
              <UserChip />
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none z-[-1]" />
            <div className="max-w-[1600px] mx-auto w-full h-full space-y-6">
              {!isMobile && <HardwareDetectionBanner compact />}
              {!isMobile && <ScanGateBanner />}
              {isMobile && MOBILE_PAGE_INFO[location] ? (
                <MobilePageDescription pageInfo={MOBILE_PAGE_INFO[location]} />
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>

      <SmartAiPopup />
      <GameDetectionPopup />
      <FloatingAiButton />

      <ScriptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        command={null}
      />
    </SidebarProvider>
  );
}
