import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNative, runNativeFix, saveDiagnosticLog } from "@/lib/tauri-bridge";
import { APP_VERSION } from "@/generated/version";
import { boundedWindowsRead } from "@/lib/applied-tweak-state";
import { getNativeRestoreReadiness } from "@/lib/native-readiness";

type RepairOutcome = {
  ok: boolean;
  message: string;
  requires_reboot: boolean;
};

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function WindowsRepairCard() {
  const native = isNative();
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<RepairOutcome | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!pending) return;
    const updateElapsed = () => {
      if (startedAt.current !== null) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const runRepair = async () => {
    if (pending || !native) return;
    const confirmed = window.confirm(
      "Run Fix corrupted Windows completely?\n\n" +
        "This runs DISM /Online /Cleanup-Image /RestoreHealth, then SFC /scannow. " +
        "It may take 10–30 minutes and an internet connection is required. " +
        "Windows corruption cannot be guaranteed to be completely repaired.\n\n" +
        "This action does not reset WMI, delete restore points, or weaken Windows security.\n\n" +
        "Continue?",
    );
    if (!confirmed) return;

    setOutcome(null);
    setErrorMessage(null);
    setElapsed(0);
    startedAt.current = Date.now();
    setPending(true);
    setLogPath(null);
    setLogError(null);
    const filename = `OptiGods-Windows-Repair-Diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    const header = `Opti Gods Windows Repair Diagnostics\nApp version: ${APP_VERSION}\nStarted: ${new Date().toISOString()}\nLaunch checkpoint state: ${JSON.stringify(getNativeRestoreReadiness())}\nNo Opti Gods login tokens or API keys are included.\n\n`;
    const persist = async (content: string) => {
      try {
        const path = await boundedWindowsRead(saveDiagnosticLog(filename, header + content), "Diagnostic log save", 8000);
        setLogPath(path);
        setLogError(null);
      } catch (error) {
        setLogError(error instanceof Error ? error.message : "Diagnostic log could not be saved to Downloads.");
      }
    };
    await persist("Repair requested. If interrupted, the native transcript is also saved under C:\\ProgramData\\OptiGods\\RepairLogs.\n");
    try {
      const result = await runNativeFix("windows-corruption");
      await persist(`Finished: ${new Date().toISOString()}\nCommand sequence successful: ${result.ok}\nRestart recommended: ${result.requires_reboot}\n\n${result.message}`);
      setOutcome({
        ok: result.ok,
        message: result.message || (result.ok ? "The repair returned no details." : "Windows reported that repair failed."),
        requires_reboot: result.requires_reboot,
      });
    } catch (error) {
      await persist(`Repair failed or could not start: ${error instanceof Error ? error.message : String(error)}\nNative transcripts, if started, remain under C:\\ProgramData\\OptiGods\\RepairLogs.\n`);
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
      startedAt.current = null;
    }
  };

  return (
    <section
      aria-labelledby="windows-repair-heading"
      className="overflow-hidden rounded-xl border-2 border-red-600/50 bg-red-950/25 shadow-[0_0_24px_-12px_rgba(220,38,38,0.55)]"
      data-testid="windows-repair-card"
    >
      <div className="flex items-center gap-3 border-b border-red-600/30 bg-red-700/20 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10">
          <ShieldAlert className="h-5 w-5 text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="windows-repair-heading" className="text-sm font-black uppercase tracking-wide text-white">
            Windows system file corruption?
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-zinc-400">
            Run the Windows image and system file repair sequence.
          </p>
        </div>
        <span className="hidden shrink-0 font-mono text-[10px] text-red-300/70 sm:block">DISM → SFC</span>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {(logPath || logError) && <p className="text-xs text-zinc-400 break-all" data-testid="windows-repair-log-path">{logError || `Diagnostic log saved to Downloads: ${logPath}`}</p>}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs leading-relaxed text-zinc-300">
            DISM RestoreHealth runs first, followed by SFC /scannow. Allow 10–30 minutes and keep the PC
            connected to the internet. Repairs may not resolve every issue.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-red-400" />
              No WMI reset or restore-point deletion
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-red-400" />
              Windows security settings stay intact
            </span>
          </div>
        </div>

        {native ? (
          <Button
            type="button"
            data-testid="button-fix-corrupted-windows"
            onClick={() => void runRepair()}
            disabled={pending}
            className="h-auto shrink-0 border border-red-500/40 bg-red-700 px-4 py-2.5 text-xs font-black text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Repairing…
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Fix corrupted Windows completely
              </>
            )}
          </Button>
        ) : (
          <div
            className="flex max-w-sm shrink-0 items-start gap-2 rounded-lg border border-zinc-700/70 bg-black/35 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400"
            data-testid="windows-repair-desktop-only"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>This repair is available only in the Opti Gods Windows desktop app.</span>
          </div>
        )}
      </div>

      {pending && (
        <div
          aria-live="polite"
          className="flex items-center gap-2 border-t border-red-600/20 bg-black/25 px-4 py-2.5 text-xs text-red-200"
          data-testid="windows-repair-pending"
        >
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span>Windows repair is running. Keep this window open.</span>
          <span className="ml-auto shrink-0 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
        </div>
      )}

      {(outcome || errorMessage) && (
        <div
          aria-live="polite"
          className={`border-t px-4 py-3 ${outcome?.ok ? "border-emerald-500/20 bg-emerald-950/20" : "border-red-500/25 bg-black/30"}`}
          data-testid="windows-repair-result"
        >
          <div className="mb-2 flex items-center gap-2">
            {outcome?.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <p className={`text-xs font-bold ${outcome?.ok ? "text-emerald-200" : "text-red-200"}`}>
              {errorMessage ? "Repair could not be completed" : outcome?.ok ? "Repair finished" : "Repair failed"}
            </p>
            {outcome?.requires_reboot && (
              <span className="ml-auto text-[10px] font-semibold text-amber-300">Restart required</span>
            )}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
            {errorMessage ?? outcome?.message}
            {outcome?.requires_reboot ? "\n\nA Windows restart is required to finish applying the repair." : ""}
          </pre>
        </div>
      )}
    </section>
  );
}
