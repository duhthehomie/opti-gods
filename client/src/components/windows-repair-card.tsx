import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Copy, Download, LoaderCircle, ShieldAlert, XCircle } from "lucide-react";
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

const REPAIR_REPORT_KEY = "optigods-last-windows-repair-report";
type RepairReport = { filename: string; content: string };

function readLastReport(): RepairReport | null {
  try {
    const value = JSON.parse(localStorage.getItem(REPAIR_REPORT_KEY) || "null");
    return value && typeof value.filename === "string" && typeof value.content === "string"
      && /^OptiGods-Windows-Repair-Diagnostics-[\w-]+\.txt$/.test(value.filename) ? value : null;
  } catch { return null; }
}

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
  const [report, setReport] = useState<RepairReport | null>(readLastReport);
  const [savingLog, setSavingLog] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const startedAt = useRef<number | null>(null);

  const keepReport = (value: RepairReport) => {
    setReport(value);
    try { localStorage.setItem(REPAIR_REPORT_KEY, JSON.stringify(value)); }
    catch { setLogError("The log is available below, but could not be retained after closing the app. Download or copy it now."); }
  };

  const downloadReport = async (value = report) => {
    if (!value || savingLog) return;
    setSavingLog(true);
    try {
      const path = await boundedWindowsRead(saveDiagnosticLog(value.filename, value.content), "Diagnostic log save", 8000);
      setLogPath(path);
      setLogError(null);
    } catch (error) {
      setLogError(`Could not save the repair log: ${error instanceof Error ? error.message : String(error)}. Retry Download or use Copy log below.`);
    } finally { setSavingLog(false); }
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.content);
      setCopyMessage("Repair log copied. Paste it into a text file to send for support.");
    } catch { setCopyMessage("Copy was blocked. Select and copy the full diagnostic text below."); }
  };

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
    setCopyMessage("");
    const filename = `OptiGods-Windows-Repair-Diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    const header = `Opti Gods Windows Repair Diagnostics\nApp version: ${APP_VERSION}\nStarted: ${new Date().toISOString()}\nLaunch checkpoint state: ${JSON.stringify(getNativeRestoreReadiness())}\nNo Opti Gods login tokens or API keys are included.\n\n`;
    const persist = async (content: string) => {
      const value = { filename, content: header + content };
      keepReport(value);
      await downloadReport(value);
    };
    keepReport({ filename, content: header + "Repair requested; no completion result received yet. If the app closed during repair, inspect the native transcript under C:\\ProgramData\\OptiGods\\RepairLogs.\n" });
    try {
      const result = await runNativeFix("windows-corruption");
      setOutcome({
        ok: result.ok,
        message: result.message || (result.ok ? "The repair returned no details." : "Windows reported that repair failed."),
        requires_reboot: result.requires_reboot,
      });
      await persist(`Finished: ${new Date().toISOString()}\nDuration: ${Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)} seconds\nCommand sequence successful: ${result.ok}\nRestart recommended: ${result.requires_reboot}\n\n${result.message}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      await persist(`Repair failed or could not start: ${error instanceof Error ? error.message : String(error)}\nNative transcripts, if started, remain under C:\\ProgramData\\OptiGods\\RepairLogs.\n`);
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

      {native && report && (
        <div className="space-y-2 border-t border-red-600/20 px-4 py-3" data-testid="windows-repair-diagnostics">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending || savingLog} onClick={() => void downloadReport()} data-testid="download-windows-repair-log">
              <Download className="mr-2 h-3.5 w-3.5" />{savingLog ? "Saving log…" : "Download repair error log"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void copyReport()} data-testid="copy-windows-repair-log">
              <Copy className="mr-2 h-3.5 w-3.5" />Copy log
            </Button>
            <span className="text-xs text-zinc-400">Send this log for support if the repair fails.</span>
          </div>
          {(logPath || logError) && <p role="status" className="break-all text-xs text-zinc-400" data-testid="windows-repair-log-path">{logError || `Diagnostic log saved: ${logPath}`}</p>}
          {copyMessage && <p role="status" className="text-xs text-zinc-400">{copyMessage}</p>}
          <p className="text-[11px] text-zinc-500">Includes local file paths and Windows event details. Review before sharing.</p>
          <details>
            <summary className="cursor-pointer text-xs text-red-300">View full diagnostic log / last repair attempt</summary>
            <pre className="mt-2 max-h-64 select-text overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/40 p-3 text-[11px] text-zinc-300">{report.content}</pre>
          </details>
        </div>
      )}

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
