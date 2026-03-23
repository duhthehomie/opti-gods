import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  Crosshair,
  Gamepad2,
  MemoryStick,
  MonitorPlay,
  Power,
  Settings2,
  Zap,
  Trash2,
  Search,
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
  { title: "Process Lasso", url: "/process-lasso", icon: Cpu },
  { title: "Startup Apps", url: "/startup", icon: Power },
  { title: "Memory Optimizer", url: "/memory", icon: MemoryStick },
  { title: "Debloat Win10/11", url: "/debloat", icon: Trash2 },
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
            <p className="text-base font-bold font-display text-white">130+</p>
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
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "h-auto rounded-md transition-all",
                        isActive
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300 font-medium"
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
                        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-red-400" : "")} />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5">
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
