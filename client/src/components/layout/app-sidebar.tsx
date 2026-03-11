import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  Gamepad2,
  MonitorPlay,
  Power,
  Settings2,
  Zap,
  Trash2,
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

const navItems = [
  { title: "Dashboard", url: "/", icon: Activity },
  { title: "Registry Tweaks", url: "/registry", icon: Settings2 },
  { title: "FiveM Optimizer", url: "/fivem", icon: Gamepad2 },
  { title: "NVIDIA Presets", url: "/nvidia", icon: MonitorPlay },
  { title: "Process Lasso", url: "/process-lasso", icon: Cpu },
  { title: "Startup Apps", url: "/startup", icon: Power },
  { title: "Debloat Win10", url: "/debloat", icon: Trash2 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { tweaks } = useOptimizationStore();
  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  return (
    <Sidebar className="border-r border-white/5 bg-[#050505]">
      <SidebarHeader className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-500 box-glow">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-white tracking-tight">
              OPTI <span className="text-red-500">GODS</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">by leaq</p>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="mt-5 flex items-center justify-between px-1">
          <div className="text-center">
            <p className="text-lg font-bold font-display text-white">{enabledCount}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Tweaks On</p>
          </div>
          <div className="h-8 w-px bg-white/5" />
          <div className="text-center">
            <p className="text-lg font-bold font-display text-white">50+</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Available</p>
          </div>
          <div className="h-8 w-px bg-white/5" />
          <div className="text-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mb-1 animate-pulse" />
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Live</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="px-3 gap-1">
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "bg-red-500/10 text-red-500 hover:bg-red-500/15 hover:text-red-400 font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                      }
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-all">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="text-sm">{item.title}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
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

      <SidebarFooter className="p-4 border-t border-white/5">
        <div className="px-2 py-3 rounded-lg bg-zinc-900/60 border border-white/5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">System</p>
          <p className="text-xs text-zinc-400 font-mono">Windows 10 Pro (22H2)</p>
          <p className="text-[10px] text-zinc-600 mt-1">Build 19045.4170</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
