import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { Loader2, Download, X, Zap, MessageSquare, Trophy, Shield, Gamepad2, Monitor, ChevronRight } from "lucide-react";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useGenerateScript } from "@/hooks/use-script";
import { ScriptDialog } from "../script-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { ProGate } from "@/components/pro-gate";
import { HardwareDetectionBanner } from "@/components/hardware-detection-banner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useLocation } from "wouter";

const MOBILE_FEATURES = [
  { icon: Zap, title: "437+ Optimizations", desc: "Registry, GPU, network, memory, and game-specific tweaks" },
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

function MobileShowcase() {
  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-y-auto">
      <div className="px-5 pt-8 pb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          OPTI <span className="text-red-500">GODS</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">by leaq</p>
        <p className="text-sm text-zinc-400 mt-3 max-w-xs mx-auto leading-relaxed">
          The ultimate Windows 10/11 PC optimizer. 437+ tweaks. One script. Maximum FPS with lowest latency.
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
const OPTIMIZER_PAGES = ["/", "/registry", "/fivem", "/fortnite", "/nvidia", "/amd", "/integrated-graphics", "/laptop", "/discord", "/game-detection", "/startup", "/memory", "/debloat", "/process-lasso", "/processes"];

function SmartAiPopup() {
  const [show, setShow] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    if (localStorage.getItem(AI_POPUP_KEY)) return;
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(AI_POPUP_KEY, "1");
  };

  if (!show || !OPTIMIZER_PAGES.includes(location)) return null;

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

function FloatingAiButton() {
  const [location] = useLocation();
  if (!OPTIMIZER_PAGES.includes(location) || location === "/ai") return null;

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
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState<string | null>(null);

  const { tweaks, nvidiaPreset, reset } = useOptimizationStore();
  const generateScript = useGenerateScript();
  const { toast } = useToast();
  const osInfo = useOsDetection();

  const handleApply = () => {
    generateScript.mutate({ tweaks, nvidiaPreset }, {
      onSuccess: (data) => {
        setCommand(data.command);
        setDialogOpen(true);
      },
      onError: (error) => {
        toast({ title: "Error Generating Script", description: error.message, variant: "destructive" });
      }
    });
  };

  const osLabel = osInfo.loading ? "Detecting..." : osInfo.os;
  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  const MOBILE_SHOWCASE_KEY = "optigods_mobile_showcase_dismissed";
  const showMobileShowcaseOnDashboard = isMobile && location === "/" && !localStorage.getItem(MOBILE_SHOWCASE_KEY);
  const [showcaseDismissed, setShowcaseDismissed] = useState(false);

  if (showMobileShowcaseOnDashboard && !showcaseDismissed) {
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
              <div className="flex items-center gap-2">
                <button
                  data-testid="button-mobile-skip-showcase"
                  onClick={() => {
                    localStorage.setItem(MOBILE_SHOWCASE_KEY, "1");
                    setShowcaseDismissed(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-white/10 text-zinc-400 text-[10px] font-bold hover:text-white transition-colors"
                >
                  Use Optimizer
                </button>
                <Link href="/ai">
                  <button data-testid="button-mobile-header-ai" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-500/25 text-red-400 text-[10px] font-bold">
                    <MessageSquare className="w-3 h-3" />
                    AI
                  </button>
                </Link>
              </div>
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
              {enabledCount > 0 && (
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
              <ProGate>
                <Button
                  data-testid="button-apply-optimizations"
                  onClick={handleApply}
                  disabled={generateScript.isPending}
                  className={cn(
                    "font-display tracking-wide px-6 border transition-all duration-300",
                    enabledCount > 0
                      ? "bg-red-600 hover:bg-red-500 text-white border-red-400/50 shadow-[0_0_20px_-3px_rgba(239,68,68,0.5)]"
                      : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}
                >
                  {generateScript.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {enabledCount > 0 ? `GET MY SCRIPT (${enabledCount})` : "GET MY SCRIPT"}
                </Button>
              </ProGate>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none z-[-1]" />
            <div className="max-w-5xl mx-auto w-full h-full space-y-6">
              <HardwareDetectionBanner compact />
              {children}
            </div>
          </main>
        </div>
      </div>

      <SmartAiPopup />
      <FloatingAiButton />

      <ScriptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        command={command}
      />
    </SidebarProvider>
  );
}
