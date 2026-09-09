import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MonitorDown, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { detectAppliedTweaks, isNative } from "@/lib/tauri-bridge";
import { useToast } from "@/hooks/use-toast";

type ScanStatus = "idle" | "scanning" | "success" | "error";

export function ScanImport() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [detectedCount, setDetectedCount] = useState(0);
  const { toast } = useToast();
  const native = isNative();

  const runSmartScan = useCallback(async (quiet = false) => {
    if (!native || status === "scanning") return;
    setStatus("scanning");
    try {
      const detected = await detectAppliedTweaks();
      const store = useOptimizationStore.getState();
      const next = { ...store.tweaks };
      const appliedIds: string[] = [];

      for (const [id, applied] of Object.entries(detected)) {
        if (applied && id in next) {
          next[id] = true;
          appliedIds.push(id);
        }
      }

      store.setAllTweaks(next);
      if (appliedIds.length > 0) store.markApplied(appliedIds);
      setDetectedCount(appliedIds.length);
      setStatus("success");

      if (!quiet) {
        toast({
          title: "Smart Scan complete",
          description: appliedIds.length
            ? `${appliedIds.length} existing optimizations recognized.`
            : "No supported Opti Gods tweaks are currently applied.",
        });
      }
    } catch (error) {
      setStatus("error");
      if (!quiet) {
        toast({
          title: "Smart Scan unavailable",
          description: error instanceof Error ? error.message : "Windows state could not be read.",
          variant: "destructive",
        });
      }
    }
  }, [native, status, toast]);

  useEffect(() => {
    if (native) void runSmartScan(true);
  // Automatic once-per-mount scan; runSmartScan intentionally excluded to avoid rescans on state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d0f]/90 p-4">
      <div className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
            {status === "scanning"
              ? <RefreshCw className="h-4 w-4 animate-spin text-red-400" />
              : status === "success"
                ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                : <ScanLine className="h-4 w-4 text-red-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase tracking-[0.14em] text-zinc-200">Smart State Detection</h2>
              {native && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">Automatic</span>}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              {native
                ? status === "scanning"
                  ? "Reading your Windows optimization state…"
                  : status === "success"
                    ? `${detectedCount} supported tweaks already applied. Nothing was changed.`
                    : "Opti Gods quietly recognizes supported tweaks already on this PC."
                : "Automatic state detection is available inside the Opti Gods Windows app."}
            </p>
          </div>
        </div>

        {native ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runSmartScan(false)}
            disabled={status === "scanning"}
            className="h-9 shrink-0 gap-2 border-white/10 bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status === "scanning" ? "animate-spin" : ""}`} />
            Rescan
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            <MonitorDown className="h-3.5 w-3.5" /> Desktop only
          </div>
        )}
      </div>
    </div>
  );
}