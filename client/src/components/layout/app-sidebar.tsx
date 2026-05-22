import { Link, useLocation } from "wouter";
import { Home, Activity, Settings2, Wrench, Crown, Download, ChevronRight, LogIn, Bot, LogOut, UserCircle, ShieldCheck, X } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { APP_VERSION } from "@/generated/version";
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
import { useAuth, useLogout, loginWithDiscord } from "@/hooks/use-auth";
import { isNative, discordLogin } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { NATIVE_TOKEN_KEY, NATIVE_ADMIN_KEY, queryClient } from "@/lib/queryClient";
import { GUEST_MODE_KEY } from "@/pages/welcome";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect } from "react";

const ADMIN_UNLOCK_CODE = "4258";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "pro" | "admin";
};

const PRIMARY: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "System Scan", url: "/system-scan", icon: Activity },
  { title: "Tweaks", url: "/tweaks", icon: Settings2 },
  { title: "Tools & Fixes", url: "/tools", icon: Wrench },
  { title: "AI Assistant", url: "/ai", icon: Bot },
  { title: "Pro", url: "/pro", icon: Crown, accent: "pro" },
  { title: "Account", url: "/account", icon: UserCircle },
];

const ADMIN_NAV: NavItem = { title: "Admin", url: "/admin", icon: ShieldCheck, accent: "admin" };

function isGuestMode(): boolean {
  try { return localStorage.getItem(GUEST_MODE_KEY) === "1"; } catch { return false; }
}

function clearGuestMode() {
  try { localStorage.removeItem(GUEST_MODE_KEY); } catch {}
}

function getStoredAdminKey(): string | null {
  try { return localStorage.getItem(NATIVE_ADMIN_KEY); } catch { return null; }
}

function storeAdminKey(key: string) {
  // NATIVE_ADMIN_KEY = "optigods_admin_key" — same key the /admin page reads,
  // so the panel is already authenticated when opened from the sidebar.
  try { localStorage.setItem(NATIVE_ADMIN_KEY, key); } catch {}
}

function clearAdminKey() {
  try { localStorage.removeItem(NATIVE_ADMIN_KEY); } catch {}
}

export function AppSidebar() {
  const [location] = useLocation();
  const { tweaks } = useOptimizationStore();
  const osInfo = useOsDetection();
  const isPro = useProStatus();
  const { user } = useAuth();
  const logout = useLogout();
  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const isGuest = isGuestMode();
  const showSignIn = isGuest && !user;

  const [adminUnlocked, setAdminUnlocked] = useState(() => !!getStoredAdminKey());
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const handleVersionTap = useCallback(() => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      setUnlockInput("");
      setUnlockError(false);
      setShowUnlockModal(true);
    }
  }, []);

  const handleUnlockSubmit = () => {
    if (unlockInput.trim() === ADMIN_UNLOCK_CODE) {
      storeAdminKey(unlockInput.trim());
      setAdminUnlocked(true);
      setShowUnlockModal(false);
      setUnlockError(false);
    } else {
      setUnlockError(true);
    }
  };

  const handleAdminLock = () => {
    clearAdminKey();
    setAdminUnlocked(false);
  };

  useEffect(() => {
    return () => { if (tapTimer.current) clearTimeout(tapTimer.current); };
  }, []);

  const isActive = (url: string) => {
    if (url === "/") return location === "/" || location === "/dashboard";
    return location === url || location.startsWith(url + "/");
  };

  const handleSignIn = async () => {
    clearGuestMode();
    if (isNative()) {
      try {
        const cfgRes = await fetch(apiUrl("/api/auth/discord/config"));
        if (!cfgRes.ok) throw new Error("not configured");
        const { clientId } = await cfgRes.json() as { clientId: string };
        const session = await discordLogin(clientId);
        try { localStorage.setItem(NATIVE_TOKEN_KEY, session.native_token); } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
        window.location.href = "/tweaks";
      } catch {
        loginWithDiscord();
      }
    } else {
      loginWithDiscord();
    }
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.url);
    const isProAccent = item.accent === "pro";
    const isAdminAccent = item.accent === "admin";
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton
          asChild
          isActive={active}
          className={cn(
            "h-10 transition-all",
            active && !isAdminAccent && "bg-red-500/10 text-red-300 border-l-2 border-red-500",
            active && isAdminAccent && "bg-purple-500/10 text-purple-300 border-l-2 border-purple-500",
            isProAccent && !active && !isPro && "text-amber-300 hover:text-amber-200",
            isAdminAccent && !active && "text-purple-300 hover:text-purple-200",
          )}
        >
          <Link href={item.url} data-testid={`nav-${item.title.replace(/\s+/g, "-").toLowerCase()}`}>
            <Icon className={cn(
              "w-4 h-4",
              active && isAdminAccent ? "text-purple-400" :
              active ? "text-red-400" :
              isProAccent && !isPro ? "text-amber-400" :
              isAdminAccent ? "text-purple-500" :
              "text-zinc-500"
            )} />
            <span className="text-sm font-semibold">{item.title}</span>
            {isProAccent && isPro && (
              <span className="ml-auto text-[8px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider">ON</span>
            )}
            {isAdminAccent && (
              <span className="ml-auto text-[8px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider">DEV</span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const navItems = adminUnlocked ? [...PRIMARY, ADMIN_NAV] : PRIMARY;

  return (
    <>
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
                <p
                  className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 cursor-default select-none"
                  onClick={handleVersionTap}
                  data-testid="text-version-tap"
                >
                  by leaq · v{APP_VERSION}
                </p>
              </div>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-white/5 space-y-3">
          {user && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-zinc-900/60 border border-white/5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                  <SiDiscord className="w-4 h-4 text-[#5865F2]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white leading-tight truncate">
                  {user.globalName || user.username}
                </p>
                <p className="text-[9px] text-zinc-500 leading-tight truncate">@{user.username}</p>
              </div>
              <button
                data-testid="button-sidebar-logout"
                onClick={() => logout.mutate()}
                title="Sign out"
                className="p-1 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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

      {showUnlockModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-72 rounded-2xl border border-purple-500/30 bg-[#0a0a0a] shadow-2xl shadow-purple-900/40 p-6">
            <button
              onClick={() => setShowUnlockModal(false)}
              className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-purple-400 font-bold">Admin Access</p>
                <p className="text-sm font-bold text-white">Enter unlock code</p>
              </div>
            </div>
            <input
              autoFocus
              type="password"
              value={unlockInput}
              onChange={e => { setUnlockInput(e.target.value); setUnlockError(false); }}
              onKeyDown={e => e.key === "Enter" && handleUnlockSubmit()}
              placeholder="••••"
              data-testid="input-admin-unlock"
              className={cn(
                "w-full bg-zinc-900 border rounded-xl px-4 py-2.5 text-white text-sm font-mono text-center tracking-[0.3em] outline-none transition-colors mb-3",
                unlockError ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-purple-500/60"
              )}
            />
            {unlockError && (
              <p className="text-[11px] text-red-400 text-center mb-3">Wrong code</p>
            )}
            <button
              onClick={handleUnlockSubmit}
              data-testid="button-admin-unlock-submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-colors"
            >
              Unlock
            </button>
          </div>
        </div>
      )}
    </>
  );
}
