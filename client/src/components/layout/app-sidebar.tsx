import { Link, useLocation } from "wouter";
import { Home, Activity, Settings2, Wrench, Crown, Download, ChevronRight, LogIn, Bot } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { BRAND } from "@/components/branding/assets";
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
import { useAuth, loginWithDiscord } from "@/hooks/use-auth";
import { isNative } from "@/lib/tauri-bridge";
import { apiBase } from "@/lib/api-base";
import { GUEST_MODE_KEY } from "@/pages/welcome";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "pro";
};

const PRIMARY: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "System Scan", url: "/system-scan", icon: Activity },
  { title: "Tweaks", url: "/tweaks", icon: Settings2 },
  { title: "Tools & Fixes", url: "/tools", icon: Wrench },
  { title: "AI Assistant", url: "/ai", icon: Bot },
  { title: "Pro", url: "/pro", icon: Crown, accent: "pro" },
];

function isGuestMode(): boolean {
  try { return localStorage.getItem(GUEST_MODE_KEY) === "1"; } catch { return false; }
}

function clearGuestMode() {
  try { localStorage.removeItem(GUEST_MODE_KEY); } catch {}
}

export function AppSidebar() {
  const [location] = useLocation();
  const { tweaks } = useOptimizationStore();
  const osInfo = useOsDetection();
  const isPro = useProStatus();
  const { user } = useAuth();
  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const isGuest = isGuestMode();
  const showSignIn = isGuest && !user;

  const isActive = (url: string) => {
    if (url === "/") return location === "/" || location === "/dashboard";
    return location === url || location.startsWith(url + "/");
  };

  const handleSignIn = () => {
    clearGuestMode();
    if (isNative()) {
      window.location.href = `${apiBase()}/api/auth/discord/login?native=1`;
    } else {
      loginWithDiscord();
    }
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.url);
    const isProAccent = item.accent === "pro";
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton
          asChild
          isActive={active}
          className={cn(
            "h-10 transition-all",
            active && "bg-red-500/10 text-red-300 border-l-2 border-red-500",
            isProAccent && !active && !isPro && "text-amber-300 hover:text-amber-200",
          )}
        >
          <Link href={item.url} data-testid={`nav-${item.title.replace(/\s+/g, "-").toLowerCase()}`}>
            <Icon className={cn("w-4 h-4", active ? "text-red-400" : isProAccent && !isPro ? "text-amber-400" : "text-zinc-500")} />
            <span className="text-sm font-semibold">{item.title}</span>
            {isProAccent && isPro && (
              <span className="ml-auto text-[8px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider">ON</span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-white/5">
      <SidebarHeader className="p-5 border-b border-white/5">
        <Link href="/" data-testid="link-home-logo">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-black border border-red-500/30 flex items-center justify-center overflow-hidden shadow-[0_0_12px_-4px_rgba(239,68,68,0.5)]">
              <img src={BRAND.goldPng} alt="Opti Gods" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="font-display font-black text-base leading-tight text-white">
                OPTI <span className="text-red-500">GODS</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">by leaq · v2</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/5 space-y-3">
        {/* Guest mode sign-in CTA */}
        {showSignIn && (
          <button
            data-testid="button-sidebar-signin"
            onClick={handleSignIn}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/50 transition-all group"
          >
            <SiDiscord className="w-4 h-4 text-[#5865F2] shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[11px] font-bold text-[#7289DA] leading-tight">Sign in with Discord</p>
              <p className="text-[9px] text-zinc-600 leading-tight truncate">Save your config permanently</p>
            </div>
            <LogIn className="w-3 h-3 text-[#5865F2]/60 shrink-0" />
          </button>
        )}

        {enabledCount > 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-red-300 leading-tight">
                  {enabledCount} tweak{enabledCount !== 1 ? "s" : ""} selected
                </p>
                <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                  Hit <span className="text-zinc-300 font-semibold">GET MY SCRIPT</span> ↑
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-red-500/60 shrink-0" />
            </div>
          </div>
        )}

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
