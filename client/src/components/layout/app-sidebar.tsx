import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Cpu, 
  Gamepad2, 
  MonitorPlay, 
  Power, 
  Settings2,
  Zap
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
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: Activity },
  { title: "Registry Tweaks", url: "/registry", icon: Settings2 },
  { title: "FiveM Optimizer", url: "/fivem", icon: Gamepad2 },
  { title: "NVIDIA Presets", url: "/nvidia", icon: MonitorPlay },
  { title: "Process Lasso", url: "/process-lasso", icon: Cpu },
  { title: "Startup Apps", url: "/startup", icon: Power },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-white/5 bg-[#050505]">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-500 box-glow">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-white tracking-tight">OPTI <span className="text-red-500">GODS</span></h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">by leaq</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="px-3 gap-2">
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className={
                      isActive 
                        ? "bg-red-500/10 text-red-500 hover:bg-red-500/15 hover:text-red-400 font-medium" 
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }>
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-all">
                        <item.icon className="w-5 h-5" />
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
    </Sidebar>
  );
}
