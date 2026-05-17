import { useState, useEffect, lazy, Suspense, ReactNode } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { EmbeddedProvider } from "@/lib/embedded-context";
import { Wrench, RotateCcw, Search, HardDrive, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Fixes = lazy(() => import("@/pages/fixes"));
const CustomOS = lazy(() => import("@/pages/custom-os"));
const GameDetection = lazy(() => import("@/pages/game-detection"));
const Help = lazy(() => import("@/pages/help"));

type Tab = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  Component: React.ComponentType;
};

const TABS: Tab[] = [
  { id: "fixes", label: "Fixes & Restore", icon: RotateCcw, Component: Fixes },
  { id: "game-detection", label: "Game Detection", icon: Search, Component: GameDetection },
  { id: "custom-os", label: "Custom OS", icon: HardDrive, Component: CustomOS },
  { id: "help", label: "Help", icon: HelpCircle, Component: Help },
];

function readHashTab(): string {
  if (typeof window === "undefined") return "fixes";
  const hash = window.location.hash.replace("#", "");
  return TABS.some(t => t.id === hash) ? hash : "fixes";
}

export default function ToolsFixesPage() {
  const [location] = useLocation();
  const [active, setActive] = useState<string>(readHashTab);

  // Re-sync when the route/hash changes (e.g. arriving via a Redirect).
  useEffect(() => {
    setActive(readHashTab());
    const onHash = () => setActive(readHashTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [location]);

  const Active = TABS.find(t => t.id === active)!;
  const ActiveComp = Active.Component;

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Wrench className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">Tools & Fixes</h1>
          </div>
          <p className="text-sm text-zinc-500">One-click fixes, game scanner, custom Windows images, and help.</p>
        </header>

        <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const on = active === t.id;
            return (
              <button
                key={t.id}
                data-testid={`tab-tools-${t.id}`}
                onClick={() => { setActive(t.id); window.history.replaceState({}, "", `#${t.id}`); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px shrink-0",
                  on ? "text-red-400 border-red-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div>
          <EmbeddedProvider>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-red-400 animate-spin" /></div>}>
              <ActiveComp />
            </Suspense>
          </EmbeddedProvider>
        </div>
      </div>
    </AppLayout>
  );
}
