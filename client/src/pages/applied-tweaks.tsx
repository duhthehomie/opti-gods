import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { detectAppliedTweaks, isNative, openDownloadsFolder, scanHardware, undoTweak, type NativeHardwareScan } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { FREE_NATIVE_TWEAK_LIMIT, NATIVE_TWEAK_ID_SET } from "@shared/native-tweak-ids";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { getTweakMeta } from "@/lib/tweak-registry";
import { getHardwareAwareTweakTitle, getTweakCompatibility } from "@/lib/tweak-compatibility";
import { getScannedInfo } from "@/hooks/use-hardware-info";
import { APP_VERSION } from "@/generated/version";
import { useToast } from "@/hooks/use-toast";
import {
  applyTweakBatch,
  clearQueuedTweakBatch,
  hasNativeTweakRunInFlight,
  readNativeTweakRun,
  readQueuedTweakBatch,
  readQueuedTweakBatchOptions,
  stopNativeTweakRun,
  subscribeNativeTweakRun,
  type NativeTweakRunState,
  type TweakRunProgress,
} from "@/lib/native-tweak-runner";
import { AlertCircle, CheckCircle2, Download, Loader2, Play, RefreshCw, Undo2, ShieldCheck, Radio, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "optigods-native-undo-tokens";
type LedgerView = "selected" | "applied" | "failed";

function initialLedgerView(): LedgerView {
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "selected" || requested === "failed" ? requested : "applied";
}

function tokenFor(id: string) { try { return (JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}") as Record<string,string>)[id] || null; } catch { return null; } }
function summarizeFailures(failures: { id: string; message: string }[], appliedCount: number): string {
  if (!failures.length) return "Every selected Windows change was confirmed. Restart your PC for the full boost.";
  const messages = Array.from(new Set(failures.map(failure => failure.message))).slice(0, 2);
  const detail = messages.join(" ");
  const remaining = failures.length - messages.length;
  return `${appliedCount} applied. ${failures.length} failed. ${detail}${remaining > 0 ? ` ${remaining} other result${remaining === 1 ? "" : "s"} are listed below.` : ""}`;
}

function getRunCompatibility(item: Pick<TweakRunProgress, "id" | "status" | "message">): { ok: boolean; reason?: string } {
  const savedScanResult = getTweakCompatibility(item.id);
  const runtimeLooksIncompatible = item.status === "failed"
    && /not for this system|not compatible|not supported|not detected|requires exactly|hybrid|did not expose|unavailable/i.test(item.message || "");
  return runtimeLooksIncompatible
    ? { ok: false, reason: item.message || "Windows rejected this hardware configuration." }
    : savedScanResult;
}

async function downloadUndoScript(id: string): Promise<boolean> {
  const sessionToken = localStorage.getItem("optigods_session_v2");
  const res = await fetch(apiUrl("/api/script/undo"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, sessionToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Undo failed (${res.status})`);
  }
  const granular = res.headers.get("X-Undo-Available") === "true";
  const text = await res.text();
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `OptiGods-Undo-${id}.bat`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return granular;
}

async function downloadRunDiagnosticLog(
  runState: NativeTweakRunState | null,
  items: TweakRunProgress[],
  nativeState: Record<string, boolean>,
): Promise<string> {
  let hardware: NativeHardwareScan | null = null;
  let hardwareSource = "not available";
  if (isNative()) {
    try {
      hardware = await scanHardware();
      if (hardware) hardwareSource = "live native WMI scan";
    } catch {
      // Fall through to the last saved scan so the log still identifies the PC.
    }
  }
  if (!hardware) {
    const saved = getScannedInfo();
    if (saved) {
      hardware = {
        cpu: saved.CPU || "unknown",
        gpu: saved.GPU || "unknown",
        vram_mb: saved.VRAM_MB ?? null,
        ram_gb: saved.RAM_GB ?? null,
        ram_mhz: saved.RAM_MHz ?? null,
        motherboard: saved.Motherboard ?? null,
        chassis: saved.Chassis ?? null,
        cooling_type: saved.CoolingType ?? null,
        fan_count: null,
        cpu_temp_c: null,
        refresh_hz: saved.RefreshHz ?? null,
        nic_vendor: saved.NicVendor ?? null,
        network_ssid: null,
        network_band: null,
        anticheats: saved.Anticheats ?? [],
        system_model: saved.SystemModel ?? null,
        os_name: saved.OsName ?? null,
        os_build: saved.OsBuild ?? null,
        cpu_cores: saved.Cores ?? null,
        cpu_threads: saved.Threads ?? null,
        is_laptop: saved.IsLaptop ?? null,
      };
      hardwareSource = "last saved hardware scan";
    }
  }
  const generatedAt = new Date().toISOString();
  const applied = items.filter(item => item.status === "applied");
  const failed = items.filter(item => item.status === "failed");
  const stopped = items.filter(item => item.status === "stopped");
  const pending = items.filter(item => item.status === "queued" || item.status === "running");
  const lines = [
    "Opti Gods V5 — Tweak Run Diagnostic Log",
    "========================================",
    `Generated: ${generatedAt}`,
    `App version: ${APP_VERSION}`,
    `Page: ${window.location.href}`,
    `Native Windows app: ${isNative() ? "yes" : "no"}`,
    `User agent: ${navigator.userAgent}`,
    `Platform: ${navigator.platform || "unknown"}`,
        "",
        "Exact hardware snapshot",
        "------------------------",
        `Hardware source: ${hardwareSource}`,
        `CPU: ${hardware?.cpu || "unknown"}`,
        `CPU cores / threads: ${hardware?.cpu_cores ?? "unknown"} / ${hardware?.cpu_threads ?? "unknown"}`,
        `GPU(s): ${hardware?.gpu || "unknown"}`,
        `VRAM: ${hardware?.vram_mb != null ? `${hardware.vram_mb} MB` : "unknown"}`,
        `RAM: ${hardware?.ram_gb != null ? `${hardware.ram_gb} GB` : "unknown"}${hardware?.ram_mhz ? ` @ ${hardware.ram_mhz} MHz` : ""}`,
        `Motherboard: ${hardware?.motherboard || "unknown"}`,
        `System model: ${hardware?.system_model || "unknown"}`,
        `Chassis / laptop: ${hardware?.chassis || "unknown"} / ${hardware?.is_laptop == null ? "unknown" : hardware.is_laptop ? "yes" : "no"}`,
        `Cooling: ${hardware?.cooling_type || "unknown"}; fans: ${hardware?.fan_count ?? "unknown"}`,
        `OS: ${hardware?.os_name || "unknown"}${hardware?.os_build ? ` (build ${hardware.os_build})` : ""}`,
        `Display refresh: ${hardware?.refresh_hz != null ? `${hardware.refresh_hz} Hz` : "unknown"}`,
        `Network adapter vendor: ${hardware?.nic_vendor || "unknown"}`,
        `Anti-cheat services: ${hardware?.anticheats?.length ? hardware.anticheats.join(", ") : "none detected"}`,
    "",
    "Run context",
    "-----------",
    `Run ID: ${runState?.runId || "not persisted"}`,
    `Run status: ${runState?.status || "unknown"}`,
    `Started: ${runState?.startedAt ? new Date(runState.startedAt).toISOString() : "unknown"}`,
    `Finished: ${runState?.finishedAt ? new Date(runState.finishedAt).toISOString() : "not finished"}`,
    `Stop requested: ${runState?.stopRequested ? "yes" : "no"}`,
    `Total selected: ${items.length}`,
    `Applied: ${applied.length}`,
    `Failed: ${failed.length}`,
    `Stopped: ${stopped.length}`,
    `Still queued/running: ${pending.length}`,
    `Native-confirmed IDs currently detected: ${Object.keys(nativeState).filter(id => nativeState[id]).length}`,
    "",
    "Complete tweak results",
    "----------------------",
    ...items.map(item => {
      const meta = getTweakMeta(item.id);
      const compatibility = getRunCompatibility(item);
      const compatibilityLine = compatibility.ok
        ? "compatible according to the saved hardware scan"
        : `INCOMPATIBLE / hardware-specific: ${compatibility.reason || item.message || "Windows rejected this hardware configuration"}`;
      return [
        `[${item.status.toUpperCase()}] ${item.id}`,
        `  Title: ${meta?.title ? getHardwareAwareTweakTitle(item.id, meta.title) : "Unknown tweak"}`,
        `  Category: ${meta?.category || "unknown"}`,
        `  Hardware compatibility: ${compatibilityLine}`,
        `  Position: ${item.index + 1}/${item.total}`,
        `  Message: ${item.message || "(no message returned)"}`,
      ].join("\n");
    }),
    "",
    "Troubleshooting note",
    "--------------------",
    "Attach this complete file when reporting a Windows tweak result. It does not include session tokens or API credentials.",
    "",
    "Machine/app context JSON",
    "------------------------",
    JSON.stringify({
      appVersion: APP_VERSION,
      native: isNative(),
      hardwareSource,
      hardware,
      runState,
      items,
      nativeConfirmedIds: Object.keys(nativeState).filter(id => nativeState[id]),
    }, null, 2),
    "",
  ];
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const filename = `OptiGods-V5-Tweak-Run-Error-Log-${stamp}.txt`;
  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  if (isNative()) await openDownloadsFolder();
  return filename;
}

type UndoOutcome = "native" | "script" | "restore-script" | "unavailable" | "failed";

export default function AppliedTweaksPage() {
  const { tweaks, appliedAt, setTweak, clearApplied } = useOptimizationStore();
  const { toast } = useToast();
  const [nativeState, setNativeState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ledgerView, setLedgerView] = useState<LedgerView>(initialLedgerView);
  const [batchUndoing, setBatchUndoing] = useState(false);
  const [runItems, setRunItems] = useState<TweakRunProgress[]>([]);
  const [running, setRunning] = useState(false);
  const [runFinished, setRunFinished] = useState(false);
  const [runHadFailures, setRunHadFailures] = useState(false);
  const [runTab, setRunTab] = useState<"all" | "failed">("all");
  const [runState, setRunState] = useState<NativeTweakRunState | null>(() => readNativeTweakRun());
  const [reapplying, setReapplying] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<{ pro: boolean; used: number; remaining: number | null; limit: number | null } | null>(null);
  const startedRef = useRef(false);
  const runResultsRef = useRef<HTMLDivElement>(null);
  const notifiedRunRef = useRef<string | null>(
    typeof window !== "undefined" ? (() => {
      try { return sessionStorage.getItem("optigods-native-run-notified"); } catch { return null; }
    })() : null,
  );
  useEffect(() => { detectAppliedTweaks().then(setNativeState).finally(() => setLoading(false)); }, []);
  useEffect(() => {
     const syncRun = (state: NativeTweakRunState | null) => {
      // Keep every native result visible, including stale or ineligible IDs.
      // Filtering failures here made an OG-HTTP-400 result disappear instead
      // of showing the exact tweak and server error in the run ledger.
      const safeState = state;
       setRunState(safeState);
      if (!state) return;
       setRunItems(safeState?.items ?? []);
      setRunning(state.status === "running" || state.status === "stopping");
      setRunFinished(state.status === "completed" || state.status === "stopped" || state.status === "failed");
       setRunHadFailures((safeState?.items ?? []).some(item => item.status === "failed"));
       const terminal = state.status === "completed" || state.status === "stopped" || state.status === "failed";
       if (terminal && state.items.length > 0 && notifiedRunRef.current !== state.runId) {
         notifiedRunRef.current = state.runId;
         try { sessionStorage.setItem("optigods-native-run-notified", state.runId); } catch {}
         const appliedCount = state.items.filter(item => item.status === "applied").length;
         const failedCount = state.items.filter(item => item.status === "failed").length;
         toast({
           title: failedCount > 0 ? `${appliedCount} tweaks applied · ${failedCount} need attention` : `${appliedCount} tweaks applied`,
           description: failedCount > 0
             ? "The Windows run finished. Open the Failed tab to review or retry only those items."
             : "Windows confirmed every selected tweak. Restart your PC before testing the game.",
           variant: failedCount > 0 ? "destructive" : "success",
         });
       }
    };
    syncRun(readNativeTweakRun());
    return subscribeNativeTweakRun(syncRun);
  }, []);
  const refreshAllowance = () => {
    if (!isNative()) return;
    void fetch(apiUrl("/api/performance-allowance"), { cache: "no-store", headers: getNativeAuthHeaders() })
      .then(async response => response.ok ? setAllowance(await response.json()) : undefined)
      .catch(() => {});
  };
  useEffect(() => {
    refreshAllowance();
    const handler = () => refreshAllowance();
    window.addEventListener("optigods:allowance-changed", handler);
    return () => window.removeEventListener("optigods:allowance-changed", handler);
  }, []);
  useEffect(() => {
    if (startedRef.current || !isNative()) return;
    const persisted = readNativeTweakRun();
    const queued = readQueuedTweakBatch();
    const queuedOptions = readQueuedTweakBatchOptions();
    const recoverable = queued.length
      ? queued
      : persisted && (persisted.status === "running" || persisted.status === "stopping")
        ? persisted.items
          .filter(item => item.status === "queued" || item.status === "running")
          .map(item => item.id)
        : [];
    if (!recoverable.length) return;
    startedRef.current = true;
    const startRun = async () => {
      // Recommendation buttons on individual tabs can queue script-only IDs.
      // Free users must never send those IDs to the instant-apply ticket API.
      // Fail closed if entitlement lookup is unavailable. A stale local queue
      // must never turn a free run into an oversized native execution.
      let executable = recoverable.filter(id => getTweakCompatibility(id).ok).slice(0, FREE_NATIVE_TWEAK_LIMIT);
      try {
        const response = await fetch(apiUrl("/api/performance-allowance"), { headers: getNativeAuthHeaders() });
        if (response.ok && (await response.json() as { pro?: boolean }).pro === false) {
           executable = executable.filter(id => NATIVE_TWEAK_ID_SET.has(id)).slice(0, FREE_NATIVE_TWEAK_LIMIT);
        } else if (response.ok) {
           executable = recoverable.filter(id => getTweakCompatibility(id).ok);
        }
      } catch {
        // Keep the queue if status is temporarily unavailable; the server
        // remains the final authority and reports any rejected item.
      }
      if (!executable.length) {
        localStorage.removeItem("optigods-native-run-queue");
        return;
      }
      setRunning(true);
      setRunItems(executable.map((id, index) => ({ id, index, total: executable.length, status: "queued" })));
       return applyTweakBatch(executable, progress => {
        setRunItems(items => items.map(item => item.id === progress.id ? progress : item));
       }, {
         forceReapplyIds: executable.filter(id => queuedOptions.forceReapplyIds?.includes(id)),
       });
    };
    void startRun().then(result => {
      if (!result) return;
      setRunFinished(true);
      setRunHadFailures(result.failures.length > 0);
       const failureCount = result.failures.length;
    }).catch(error => {
       const message = error instanceof Error ? error.message : "Windows could not start this tweak run.";
       setRunItems(items => items.map(item =>
         item.status === "applied" || item.status === "failed"
           ? item
           : { ...item, status: "failed", message },
       ));
      setRunFinished(true);
    }).finally(() => {
      setRunning(false);
       clearQueuedTweakBatch();
      detectAppliedTweaks().then(setNativeState);
      refreshAllowance();
    });
  }, [toast]);
   const runActive = (running || runState?.status === "stopping") && hasNativeTweakRunInFlight();
  const queuedIds = Array.from(new Set(
     runItems
      .filter(item => item.status === "queued" || item.status === "stopped")
       .map(item => item.id)
       .filter(id => getTweakCompatibility(id).ok),
   ));
  const failedIds = Array.from(new Set(
    runItems
      .filter(item => item.status === "failed")
      .map(item => item.id)
  ));
  const selectLedgerView = (view: LedgerView) => {
    setLedgerView(view);
    setRunTab(view === "failed" ? "failed" : "all");
    if (view === "failed") {
      window.setTimeout(() => runResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    }
  };
  const retryableFailedIds = Array.from(new Set(
    failedIds.filter(id => {
      const item = runItems.find(candidate => candidate.id === id);
      return item ? getRunCompatibility(item).ok : false;
    }),
  ));
  const stopRun = () => {
    if (stopNativeTweakRun()) {
      toast({
        title: "Stopping tweak run",
        description: "The current Windows action will finish safely. Applied tweaks will remain in place until you choose Undo.",
      });
    }
  };
  const rerunIds = async (idsToRun: string[], title: string, forceReapply = false) => {
    if (runActive || !idsToRun.length) return;
    setRunTab("all");
    setRunFinished(false);
    setRunHadFailures(false);
    setRunning(true);
    setRunItems(idsToRun.map((id, index) => ({ id, index, total: idsToRun.length, status: "queued" })));
    try {
       const result = await applyTweakBatch(idsToRun, progress => {
        setRunItems(items => items.map(item => item.id === progress.id ? progress : item));
       }, { forceReapplyIds: forceReapply ? idsToRun : [] });
      setRunFinished(true);
      setRunHadFailures(result.failures.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Windows could not restart these tweaks.";
      setRunItems(items => items.map(item =>
        item.status === "applied" || item.status === "failed" ? item : { ...item, status: "failed", message },
      ));
      setRunFinished(true);
      setRunHadFailures(true);
    } finally {
      setRunning(false);
      detectAppliedTweaks().then(setNativeState);
      refreshAllowance();
    }
  };
  const rerunQueued = () => rerunIds(queuedIds, "Queued tweaks reapplied");
  const rerunFailed = () => rerunIds(retryableFailedIds, "Failed tweaks reapplied", true);
  const reapply = async (id: string) => {
    if (runActive || reapplying || !isNative()) return;
    setReapplying(id);
    setRunTab("all");
    setRunFinished(false);
    setRunHadFailures(false);
    setRunItems([{ id, index: 0, total: 1, status: "queued", message: "Ready to reapply." }]);
    try {
      const result = await applyTweakBatch(
        [id],
        progress => setRunItems(items => items.map(item => item.id === progress.id ? progress : item)),
        { forceReapplyIds: [id] },
      );
      setRunFinished(true);
      setRunHadFailures(result.failures.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Windows could not reapply this tweak.";
      setRunItems(items => items.map(item => ({ ...item, status: "failed", message })));
      setRunFinished(true);
      setRunHadFailures(true);
    } finally {
      setReapplying(null);
      setRunning(false);
      detectAppliedTweaks().then(setNativeState);
    }
  };
  const orderedRunItems = [...runItems].sort((a, b) => {
    const rank = (item: TweakRunProgress) => item.status === "applied" ? 0 : 1;
    return rank(a) - rank(b) || a.index - b.index;
  });
  // Keep provenance separate: a local timestamp is a session record, not proof
  // that Windows currently has the value. Native detection is the only source
  // that can produce a "confirmed" label.
  const nativeIds = Object.keys(nativeState).filter(id => nativeState[id]);
  const sessionIds = Object.keys(appliedAt).filter(id => !nativeState[id]);
  const ids = Array.from(new Set([...nativeIds, ...sessionIds]));
  const selectedTweakIds = Object.entries(tweaks)
    .filter(([id, enabled]) => enabled && Boolean(getTweakMeta(id)) && !ids.includes(id))
    .map(([id]) => id)
    .sort((a, b) => (getTweakMeta(a)?.title || a).localeCompare(getTweakMeta(b)?.title || b));
  const undo = async (id: string, quiet = false): Promise<UndoOutcome> => {
    setUndoing(id);
    try {
      if (!isNative()) {
        if (!quiet) toast({ title: "Native undo unavailable", description: "Open the Windows app to undo applied system changes." });
        return "unavailable";
      }
      const nativeToken = tokenFor(id);
      if (nativeToken) {
        const result = await undoTweak(id, nativeToken);
        if (result.ok) {
          const releaseResponse = await fetch(apiUrl("/api/performance-allowance/release"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
            body: JSON.stringify({ tweakId: id }),
          }).catch(() => null);
          const allowanceSynced = Boolean(releaseResponse?.ok);
          setTweak(id, false); clearApplied(id);
          if (!quiet) toast({
            title: "Tweak undone",
            description: allowanceSynced
              ? result.message
              : `${result.message} The Windows change is undone; allowance refresh is pending.`,
            variant: "success",
          });
          setNativeState(s => ({ ...s, [id]: false }));
          window.dispatchEvent(new Event("optigods:allowance-changed"));
          setSelected(s => { const next = new Set(s); next.delete(id); return next; });
          return "native";
        }
      }
      const granular = await downloadUndoScript(id);
      if (!quiet) {
        toast({
          title: "Undo script downloaded",
          description: granular
            ? "Run it as Administrator to reverse this tweak. It remains listed until Windows confirms the reversal."
            : "Run it as Administrator. This script will guide you to Restore Last Working State.",
          variant: "success",
        });
      }
      return granular ? "script" : "restore-script";
    } catch (error) {
      if (!quiet) toast({ title: "Undo failed", description: error instanceof Error ? error.message : "The safe native action could not complete.", variant: "destructive" });
      return "failed";
    }
    finally { setUndoing(null); }
  };
  const undoSelected = async (requestedIds = Array.from(selected)) => {
    if (!requestedIds.length || batchUndoing) return;
    setBatchUndoing(true);
    let nativeUndone = 0;
    let scripts = 0;
    let restoreScripts = 0;
    for (const id of requestedIds) {
      const outcome = await undo(id, true);
      if (outcome === "native") nativeUndone++;
      if (outcome === "script") scripts++;
      if (outcome === "restore-script") restoreScripts++;
    }
    setBatchUndoing(false);
    const requested = requestedIds.length;
    const failed = requested - nativeUndone - scripts - restoreScripts;
    toast({
      title: nativeUndone ? `${nativeUndone} tweak${nativeUndone === 1 ? "" : "s"} undone in Windows` : "No selected tweaks were undone directly",
      description: [
        scripts ? `${scripts} undo script${scripts === 1 ? "" : "s"} downloaded; run ${scripts === 1 ? "it" : "them"} as Administrator.` : "",
        restoreScripts ? `${restoreScripts} restore script${restoreScripts === 1 ? "" : "s"} downloaded; confirm Restore Last Working State.` : "",
        failed ? `${failed} could not be processed.` : "",
      ].filter(Boolean).join(" "),
      variant: nativeUndone || scripts || restoreScripts ? "success" : "destructive",
    });
  };
  const undoAll = async () => {
    if (!ids.length || batchUndoing) return;
    if (!window.confirm(
      `Undo all ${ids.length} applied tweak${ids.length === 1 ? "" : "s"}?\n\n` +
      "Reverses supported Opti Gods changes with their native undo records. Other supported changes download individual restore scripts instead. " +
      "Downloaded scripts must be run as Administrator; Windows will not change until you run them.\n\n" +
      "This does not undo ReviOS, WinUtil, O&O ShutUp10, Process Lasso, MSI Utility, or NVIDIA Control Panel changes made outside Opti Gods.",
    )) return;
    await undoSelected(ids);
  };
  return <AppLayout><div className="og-page-enter space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-red-400">Tweak status ledger</p><h1 className="text-3xl font-display font-bold text-white">Applied Tweaks</h1><p className="mt-1 text-sm text-zinc-500">Selected shows enabled tweaks not yet recorded as applied; Applied shows recorded Windows changes; Failed shows errors from the latest run.</p><p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-600">Undo all reverses supported Opti Gods changes only. It does not roll back ReviOS, WinUtil, O&amp;O ShutUp10, Process Lasso, MSI Utility, or NVIDIA Control Panel settings.</p></div>
      <div className="flex items-center gap-2">
         {runItems.length > 0 && <button onClick={() => void downloadRunDiagnosticLog(runState, runItems, nativeState).then(name => toast({ title: "Error log saved", description: `${name} was saved to Downloads.`, variant: "success" })).catch(error => toast({ title: "Could not save error log", description: error instanceof Error ? error.message : "The diagnostic log could not be saved.", variant: "destructive" }))} className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[.06] px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/15"><Download className="h-3.5 w-3.5" />Download error log</button>}
        {ids.length > 0 && <button disabled={batchUndoing} onClick={() => void undoAll()} className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-600/[.10] px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-600/20 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />{batchUndoing ? "Undoing…" : "Undo all"}</button>}
        {ids.length > 0 && <button disabled={!selected.size || batchUndoing} onClick={() => void undoSelected()} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[.07] px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/15 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />{batchUndoing ? "Undoing…" : `Undo selected (${selected.size})`}</button>}
        <button onClick={() => { setLoading(true); detectAppliedTweaks().then(setNativeState).finally(() => setLoading(false)); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-red-500/40 hover:text-white"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh state</button>
      </div>
    </header>
     <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
       <button type="button" data-testid="button-ledger-selected" aria-pressed={ledgerView === "selected"} onClick={() => selectLedgerView("selected")} className={cn("rounded-xl border bg-black/20 p-4 text-left transition-colors hover:border-red-500/40", ledgerView === "selected" ? "border-red-500/40" : "border-white/10")}><p className="text-[10px] uppercase tracking-widest text-zinc-500">Selected</p><p className="mt-1 text-2xl font-mono font-bold text-white">{selectedTweakIds.length}</p><p className="mt-1 text-[10px] text-zinc-600">Enabled, not yet applied · open list</p></button>
       <button type="button" data-testid="button-ledger-applied" aria-pressed={ledgerView === "applied"} onClick={() => selectLedgerView("applied")} className={cn("rounded-xl border bg-emerald-500/[.04] p-4 text-left transition-colors hover:border-emerald-500/40", ledgerView === "applied" ? "border-emerald-500/40" : "border-emerald-500/20")}><p className="text-[10px] uppercase tracking-widest text-emerald-300">Applied</p><p className="mt-1 text-2xl font-mono font-bold text-white">{ids.length}</p><p className="mt-1 text-[10px] text-zinc-600">Recorded Windows state · open list</p></button>
       <button type="button" data-testid="button-ledger-failed" aria-pressed={ledgerView === "failed"} onClick={() => selectLedgerView("failed")} className={cn("rounded-xl border bg-red-500/[.04] p-4 text-left transition-colors hover:border-red-500/40", ledgerView === "failed" ? "border-red-500/40" : "border-red-500/20")}><p className="text-[10px] uppercase tracking-widest text-red-300">Failed</p><p className="mt-1 text-2xl font-mono font-bold text-white">{failedIds.length}</p><p className="mt-1 text-[10px] text-zinc-600">Latest run errors · open list</p></button>
       <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Safety</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-400"><ShieldCheck className="h-4 w-4" /> Direct undo only</p></div>
    </div>
     {allowance && !allowance.pro && <div className={cn("rounded-xl border px-4 py-3 text-xs", allowance.remaining === 0 ? "border-amber-500/25 bg-amber-500/[.06] text-amber-200" : "border-emerald-500/20 bg-emerald-500/[.04] text-emerald-200")}>
       <span className="font-bold">Free native allowance: {allowance.used} / {allowance.limit} active.</span>{" "}
       {allowance.remaining === 0 ? "The server is blocking additional instant tweaks. Undo one confirmed tweak to free a slot." : `${allowance.remaining} slot${allowance.remaining === 1 ? "" : "s"} remaining.`}
     </div>}
      {runFinished && !running && runItems.length > 0 && <div role="status" className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", runHadFailures ? "border-amber-500/30 bg-amber-500/[.07] text-amber-100" : "border-emerald-500/25 bg-emerald-500/[.06] text-emerald-100")}>
        {runHadFailures ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
        <div>
          <p className="font-bold">{runHadFailures ? "Run finished with items needing attention" : "Run finished successfully"}</p>
          <p className="mt-0.5 text-xs opacity-80">
            {runItems.filter(item => item.status === "applied").length} of {runItems.length} tweaks confirmed by Windows.
            {runHadFailures ? " Open the Failed tab below for the exact Windows error and retry only those items." : ""}
          </p>
        </div>
      </div>}
     {runItems.length > 0 && <section className="overflow-hidden rounded-2xl border border-red-500/25 bg-black/30">
       <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
         <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">Windows results</p><h2 className="mt-1 text-base font-bold text-white">{runState?.status === "stopping" ? "Stopping after the current tweak…" : running ? "Applying selected tweaks…" : runFinished ? (runState?.status === "stopped" ? "Tweak run stopped" : "Tweak run complete") : "Ready to apply"}</h2></div>
         <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
             {(running || runState?.status === "stopping") && <button onClick={stopRun} disabled={!runActive || runState?.status === "stopping"} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"><Square className="h-3 w-3 fill-current" />{runState?.status === "stopping" ? "Stopping…" : "Stop tweaks"}</button>}
             {(ids.length > 0 || runItems.length > 0) && <button onClick={() => void undoAll()} disabled={runActive || batchUndoing} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-200 hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"><Undo2 className="h-3 w-3" />{batchUndoing ? "Undoing…" : "Undo all tweaks"}</button>}
            {queuedIds.length > 0 && <button onClick={() => void rerunQueued()} disabled={runActive} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-3 w-3" />Rerun queued</button>}
            {retryableFailedIds.length > 0 && <button onClick={() => void rerunFailed()} disabled={runActive} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-200 hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-3 w-3" />Rerun compatible failed ({retryableFailedIds.length}){retryableFailedIds.length !== failedIds.length ? ` · ${failedIds.length - retryableFailedIds.length} skipped` : ""}</button>}
           {running && <Loader2 className="h-4 w-4 animate-spin text-red-400" />} {runItems.filter(item => item.status === "applied").length} / {runItems.length} confirmed
         </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900"><div className="h-full bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-300" style={{ width: `${Math.round((runItems.filter(item => item.status === "applied" || item.status === "failed").length / runItems.length) * 100)}%` }} /></div>
      </div>
       <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
         <button onClick={() => setRunTab("all")} className={cn("rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", runTab === "all" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200")}>All ({runItems.length})</button>
          <button onClick={() => setRunTab("failed")} className={cn("rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", runTab === "failed" ? "bg-red-500/15 text-red-300" : "text-zinc-500 hover:text-zinc-200")}>Failed ({runItems.filter(item => item.status === "failed").length})</button>
       </div>
         <div ref={runResultsRef} className="max-h-80 space-y-1 overflow-y-auto p-3">
           {orderedRunItems.filter(item => runTab === "all" || item.status === "failed").map(item => { const meta = getTweakMeta(item.id); const title = meta?.title ? getHardwareAwareTweakTitle(item.id, meta.title) : item.id; const compatibility = getRunCompatibility(item); return <div key={item.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[.02] px-3 py-2">
           {item.status === "running" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-red-400" /> : item.status === "applied" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : item.status === "failed" ? <AlertCircle className="h-4 w-4 shrink-0 text-red-400" /> : item.status === "stopped" ? <Square className="h-4 w-4 shrink-0 text-amber-400" /> : <Play className="h-4 w-4 shrink-0 text-zinc-600" />}
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-200">{title}</p>{item.message && <p className={cn("mt-0.5 break-words text-[10px]", item.status === "failed" ? "text-red-300" : item.status === "stopped" ? "text-amber-300" : "text-zinc-500")}>{item.message}</p>}{item.status === "failed" && <p className={cn("mt-1 text-[9px] font-black uppercase tracking-wider", compatibility.ok ? "text-amber-300" : "text-orange-300")}>{compatibility.ok ? "Hardware: compatible according to scan" : `Hardware: INCOMPATIBLE — ${compatibility.reason || "Windows rejected this configuration"}`}</p>}</div>
           <span className={cn("text-[9px] font-black uppercase tracking-wider", item.status === "applied" ? "text-emerald-400" : item.status === "failed" ? "text-red-400" : item.status === "stopped" ? "text-amber-300" : item.status === "running" ? "text-red-300" : "text-zinc-600")}>{item.status === "applied" && item.message?.startsWith("Already confirmed") ? "already applied" : item.status}</span>
        </div>; })}
      </div>
    </section>}
     {ledgerView === "selected" ? (
       selectedTweakIds.length === 0
         ? <div className="og-scanline rounded-2xl border border-dashed border-white/10 bg-black/20 p-14 text-center"><Radio className="mx-auto h-8 w-8 text-zinc-700" /><p className="mt-3 text-sm font-bold text-zinc-300">No pending tweaks are selected</p><p className="mt-1 text-xs text-zinc-600">Select tweaks on a category page or use Smart Recommendations. Applied changes stay in the Applied ledger; Unselect All clears saved toggles without removing that history.</p></div>
         : <div className="space-y-2">{selectedTweakIds.map(id => { const meta = getTweakMeta(id); const title = meta?.title ? getHardwareAwareTweakTitle(id, meta.title) : id; const applied = ids.includes(id); return <div key={id} data-testid={`selected-tweak-${id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-black/30 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-100">{title}</p><p className="text-[11px] text-zinc-600">{meta?.category || "System tweak"} · {meta?.plainEnglish || "Selected for optimization."}</p></div>{applied && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Applied</span>}<button onClick={() => setTweak(id, false)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:border-red-500/35 hover:text-red-300">Unselect</button></div>; })}</div>
     ) : ledgerView === "failed" ? (
       failedIds.length === 0
         ? <div className="og-scanline rounded-2xl border border-dashed border-white/10 bg-black/20 p-14 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" /><p className="mt-3 text-sm font-bold text-zinc-300">No failed tweaks in the latest run</p><p className="mt-1 text-xs text-zinc-600">When a Windows action fails, its exact error and retry option appear in the run results above.</p></div>
         : <div className="rounded-xl border border-red-500/20 bg-red-500/[.04] px-4 py-3 text-xs text-red-200">Showing {failedIds.length} failed item{failedIds.length === 1 ? "" : "s"} in the Windows results above. Review the error details there before retrying.</div>
     ) : ids.length === 0 ? <div className="og-scanline rounded-2xl border border-dashed border-white/10 bg-black/20 p-14 text-center"><Radio className="mx-auto h-8 w-8 text-zinc-700" /><p className="mt-3 text-sm font-bold text-zinc-300">No applied changes detected</p><p className="mt-1 text-xs text-zinc-600">Enable a supported tweak or run a native state scan.</p></div> :
      <div className="space-y-2"><div className="flex justify-end"><button onClick={() => setSelected(selected.size === ids.length ? new Set() : new Set(ids))} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white">{selected.size === ids.length ? "Clear selection" : "Select all applied"}</button></div>{ids.map(id => { const meta = getTweakMeta(id); const title = meta?.title ? getHardwareAwareTweakTitle(id, meta.title) : id; const confirmed = Boolean(nativeState[id]); const timestamp = appliedAt[id]; const provenance = confirmed ? "native confirmed" : (isNative() ? "session-recorded · pending verification" : "session-recorded · browser mode"); return <div key={id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-black/30 px-4 py-3 transition-colors hover:border-red-500/30", selected.has(id) ? "border-red-500/40" : "border-white/8")}><input type="checkbox" checked={selected.has(id)} onChange={() => setSelected(s => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; })} aria-label={`Select ${title}`} className="h-4 w-4 accent-red-600" /><div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", confirmed ? "border-emerald-500/25 bg-emerald-500/10" : "border-amber-500/25 bg-amber-500/10")}><CheckCircle2 className={cn("h-4 w-4", confirmed ? "text-emerald-400" : "text-amber-400")} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-100">{title}</p><p className="text-[11px] text-zinc-600">{meta?.category || "System tweak"} · {provenance}</p>{timestamp && <p className="mt-0.5 text-[10px] text-emerald-300/75">Applied {new Date(timestamp).toLocaleString()}</p>}</div><span className={cn("text-[10px] font-mono", confirmed ? "text-emerald-400" : "text-amber-300")}>{confirmed ? "ALREADY APPLIED" : "RECORDED"}</span>{confirmed && <button disabled={runActive || reapplying === id || batchUndoing} onClick={() => void reapply(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[.06] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> {reapplying === id ? "Reapplying" : "Reapply tweak"}</button>}<button disabled={undoing === id || batchUndoing || reapplying === id} onClick={() => void undo(id)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[.06] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"><Undo2 className="h-3.5 w-3.5" /> {undoing === id ? "Undoing" : "Undo"}</button></div>; })}</div>}
  </div></AppLayout>;
}