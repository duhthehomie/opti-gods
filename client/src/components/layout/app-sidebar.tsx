import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  Crosshair,
  Gamepad2,
  HelpCircle,
  MemoryStick,
  MessageCircle,
  MonitorPlay,
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
import { useOsDetection } from "@/hooks/use-os-detection";
import { useProStatus } from "@/lib/pro-status";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: Activity },
  { title: "Registry Tweaks", url: "/registry", icon: Settings2 },
  { title: "FiveM Optimizer", url: "/fivem", icon: Gamepad2 },
  { title: "Fortnite Optimizer", url: "/fortnite", icon: Crosshair },
  { title: "Game Detection", url: "/game-detection", icon: Search },
  { title: "NVIDIA Presets", url: "/nvidia", icon: MonitorPlay },
  { title: "AMD Optimizer", url: "/amd", icon: Flame },
  { title: "Process Lasso", url: "/process-lasso", icon: Cpu },
  { title: "Discord Optimizer", url: "/discord", icon: MessageCircle },
  { title: "Startup Apps", url: "/startup", icon: Power },
  { title: "Memory Optimizer", url: "/memory", icon: MemoryStick },
  { title: "Debloat Win10/11", url: "/debloat", icon: Trash2 },
  { title: "WinUtil + OO ShutUp", url: "/wintitus", icon: Wrench, winTitusAccent: true },
  { title: "Custom OS", url: "/custom-os", icon: HardDrive, proAccent: true },
  { title: "Updates", url: "/updates", icon: Bell },
  { title: "Fixes & Restore", url: "/fixes", icon: RotateCcw, fixAccent: true },
  { title: "Help & Discord", url: "/help", icon: MessageCircle, accent: true },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { tweaks } = useOptimizationStore();
  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const osInfo = useOsDetection();
  const isPro = useProStatus();

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

        {/* Quick stats strip */}
        <div className="mt-4 flex items-center justify-between px-1">
          <div className="text-center">
            <p className="text-base font-bold font-display text-white">{enabledCount}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Active</p>
          </div>
          <div className="h-6 w-px bg-white/5" />
          <div className="text-center">
            <p className="text-base font-bold font-display text-white">220+</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Tweaks</p>
          </div>
          <div className="h-6 w-px bg-white/5" />
          <div className="text-center">
            <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mb-1 animate-pulse" />
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Live</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 gap-0.5">
              {navItems.map((item, idx) => {
                const isActive = location === item.url;
                const isAccent = (item as any).accent;
                const isFixAccent = (item as any).fixAccent;
                const isWinTitusAccent = (item as any).winTitusAccent;
                const isProAccent = (item as any).proAccent;
                const isLast = idx === navItems.length - 1;
                return (
                  <SidebarMenuItem key={item.title} className={isLast ? "mt-1 pt-1 border-t border-white/5" : ""}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-auto rounded-md transition-all",
                        isActive
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300 font-medium"
                          : isAccent
                          ? "text-[#5865F2] hover:text-[#818cf8] hover:bg-[#5865F2]/10"
                          : isFixAccent
                          ? "text-cyan-500 hover:text-cyan-300 hover:bg-cyan-500/10"
                          : isWinTitusAccent
                          ? "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          : isProAccent
                          ? "text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
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
                          isAccent ? "text-[#5865F2]" :
                          isFixAccent ? "text-cyan-500" :
                          isWinTitusAccent ? "text-orange-400" :
                          isProAccent ? "text-violet-400" : ""
                        )} />
                        <span className="text-sm">{item.title}</span>
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
