import { useState } from "react";
import { useLocation } from "wouter";
import { ScanLine, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { HardwareScanZone } from "@/components/hardware-scan";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "optigods_scangates_dismissed";

const SKIP_ROUTES = new Set([
  "/", "/admin", "/ai", "/get-code", "/pro", "/welcome",
  "/account", "/payment-success", "/payment-cancel", "/scan",
]);

function isDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
function setDismissed() {
  try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
}

export function ScanGateBanner() {
  const [location] = useLocation();
  const hw = useHardwareInfo();
  const [dismissed, setDismissedState] = useState(isDismissed);
  const [scanExpanded, setScanExpanded] = useState(true);
  const [scanned, setScanned] = useState(hw.scanned);

  if (hw.loading) return null;
  if (scanned || hw.scanned) return null;
  if (dismissed) return null;
  if (SKIP_ROUTES.has(location)) return null;

  const handleScanned = () => {
    setScanned(true);
  };

  const handleDismiss = () => {
    setDismissed();
    setDismissedState(true);
  };

  return (
    <div
      data-testid="banner-scan-gate"
      className="rounded-2xl border border-red-500/40 bg-red-500/[0.04] overflow-hidden mb-6"
    >
      <div className="px-5 py-3.5 flex items-center gap-3 border-b border-red-500/15">
        <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <ScanLine className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Hardware scan required</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
            Win10 and Win11 use different registry paths.{" "}
            <span className="text-zinc-300 font-semibold">Without a scan, tweaks may not apply correctly to your system.</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            data-testid="button-scan-gate-toggle"
            onClick={() => setScanExpanded(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            {scanExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {scanExpanded ? "Hide" : "Show scan"}
          </button>
          <button
            data-testid="button-scan-gate-dismiss"
            onClick={handleDismiss}
            title="Dismiss for this session"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {scanExpanded && (
        <div className="px-5 py-4">
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300 leading-relaxed">
              Run the scan below — it takes 5 seconds and outputs a tiny JSON file. Drag it in to unlock accurate Win10/Win11 tweak targeting.
            </p>
          </div>
          <HardwareScanZone
            onScanned={handleScanned}
            onCleared={() => setScanned(false)}
            isScanned={false}
            defaultExpanded={true}
          />
        </div>
      )}
    </div>
  );
}
