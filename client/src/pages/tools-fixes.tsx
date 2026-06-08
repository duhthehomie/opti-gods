import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { EmbeddedProvider } from "@/lib/embedded-context";
import { Wrench, RotateCcw, HardDrive, Loader2, Activity, History, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/lib/pro-status";
import { useOptimizationStore } from "@/store/use-optimization-store";

const Fixes = lazy(() => import("@/pages/fixes"));
const CustomOS = lazy(() => import("@/pages/custom-os"));
const DPCLatency = lazy(() => import("@/pages/dpc-latency"));

type Tab = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  Component: React.ComponentType;
};

const TABS: Tab[] = [
  { id: "fixes",          label: "Fixes & Restore", icon: RotateCcw,   Component: Fixes },
  { id: "dpc-latency",    label: "DPC Latency",     icon: Activity,     Component: DPCLatency },
  { id: "custom-os",      label: "Custom OS",       icon: HardDrive,    Component: CustomOS },
];

function readHashTab(): string {
  if (typeof window === "undefined") return "fixes";
  const hash = window.location.hash.replace("#", "");
  return TABS.some(t => t.id === hash) ? hash : "fixes";
}

export default function ToolsFixesPage() {
  const [location] = useLocation();
  const [active, setActive] = useState<string>(readHashTab);
  const [restoring, setRestoring] = useState(false);
  const { toast } = useToast();
  const clearAllApplied = useOptimizationStore((s) => s.clearAllApplied);

  const handleRestoreLast = async () => {
    if (restoring) return;
    if (!window.confirm("Download the 'Restore Last Working State' script? This script reverts your PC to the most recent OptiGods restore point. A reboot is required.")) {
      return;
    }
    setRestoring(true);
    try {
      const sessionToken = getStoredToken();
      const url = `/api/restore-points/latest/restore${sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed (${res.status})`);
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "OptiGods-Restore-Last-Working-State.bat";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      // Wipe local appliedAt — assume rollback is in flight.
      clearAllApplied();
      toast({ title: "Restore script downloaded", description: "Run as Administrator. Windows will reboot to roll back to the last OptiGods restore point." });
    } catch (e) {
      toast({ title: "Restore failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

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
      <div className="flex flex-col gap-6 min-h-full">
        <header>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Wrench className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">Tools & Fixes</h1>
          </div>
          <p className="text-sm text-zinc-500">System restore, DPC latency tweaks, and custom Windows images.</p>
        </header>

        {/* Task #39 — Restore Last Working State banner */}
        <section
          data-testid="banner-restore-last"
          className="rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent p-4 flex flex-wrap items-center gap-4"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <History className="w-5 h-5 text-violet-300" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-bold text-white">Restore Last Working State</p>
            <p className="text-xs text-zinc-400 leading-snug mt-0.5">
              Rolls back to the most recent OptiGods Windows restore point — undoes every applied tweak in one shot. Requires Pro · reboots your PC.
            </p>
          </div>
          <Button
            data-testid="button-restore-last-working"
            onClick={handleRestoreLast}
            disabled={restoring}
            className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
          >
            {restoring ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing…</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Get Restore Script</>
            )}
          </Button>
        </section>

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

        <div className="flex-1 min-h-0">
          <EmbeddedProvider>
            <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-red-400 animate-spin" /></div>}>
              <ActiveComp />
            </Suspense>
          </EmbeddedProvider>
        </div>
      </div>
    </AppLayout>
  );
}
