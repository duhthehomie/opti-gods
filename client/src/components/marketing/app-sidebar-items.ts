import {
  BatteryCharging,
  Gamepad2,
  HelpCircle,
  Home,
  Library,
  Palette,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Undo2,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type AppSidebarItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  accent?: "pro" | "admin";
};

export const APP_PRIMARY_NAV: AppSidebarItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "AI Optimize", url: "/ai-optimize", icon: ScanLine },
  { title: "Tweaks", url: "/tweaks", icon: Settings2 },
  { title: "Applied Tweaks", url: "/applied-tweaks", icon: Undo2 },
  { title: "Power Plans", url: "/power-plans", icon: BatteryCharging },
  { title: "Game Profiles", url: "/game-profiles", icon: Library },
  { title: "FiveM Graphics", url: "/graphics-studio", icon: Palette },
  { title: "Support", url: "/support", icon: HelpCircle },
  { title: "Updates", url: "/updates", icon: RefreshCw },
  { title: "Fixes & Restore", url: "/tools", icon: Wrench },
  { title: "Account", url: "/account", icon: UserRound },
];

/** Public browser routes mount the read-only preview, never Windows pages. */
export function isWebsiteWorkspacePath(path: string): boolean {
  return APP_PRIMARY_NAV.some(item => item.url === path)
    || ["/system-scan", "/game-detection", "/fivem-graphics", "/help"].includes(path);
}

export const APP_ADMIN_NAV: AppSidebarItem = {
  title: "Admin",
  url: "/admin",
  icon: ShieldCheck,
  accent: "admin",
};
