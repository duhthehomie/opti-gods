import { useMemo, useState } from "react";
import { Activity, Download, Info, AlertTriangle, ClipboardPaste, Play, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { V2TweakSection } from "@/components/v2-tweak-section";

/**
 * DPC Latency tab — Tools & Fixes shell.
 * V2 Task #38/#39: web build provides a "Run check" PowerShell that uses
 * xperf (preferred) or wpr (fallback) to capture a 30-second DPC/ISR sample,
 * then summarises top offenders to the console. The user pastes that summary
 * back in and we parse + highlight the worst drivers inline.
 */

interface ParsedDriver {
  name: string;
  usPerDpc: number;
  pctTime?: number;
}

function parseXperfSummary(raw: string): ParsedDriver[] {
  if (!raw.trim()) return [];
  const rows: ParsedDriver[] = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    // xperf -a dpcisr summary lines look like:
    //   nvlddmkm.sys     12345    9876   123.45us
    // wpr summary lines look like:
    //   Driver: ndis.sys    DPCs: 4321    Avg(us): 87.4    %Time: 1.2
    const xperfMatch = line.match(/([\w.\-+]+\.sys)\b[^\d]*\d+[^\d]+\d+[^\d]+([\d.]+)\s*us/i);
    if (xperfMatch) {
      rows.push({ name: xperfMatch[1], usPerDpc: parseFloat(xperfMatch[2]) });
      continue;
    }
    const wprMatch = line.match(/([\w.\-+]+\.sys)[^\d]*DPCs:\s*\d+[^\d]+Avg\(us\):\s*([\d.]+)(?:[^\d]+%Time:\s*([\d.]+))?/i);
    if (wprMatch) {
      rows.push({
        name: wprMatch[1],
        usPerDpc: parseFloat(wprMatch[2]),
        pctTime: wprMatch[3] ? parseFloat(wprMatch[3]) : undefined,
      });
      continue;
    }
    // Fallback: lines that begin with a .sys filename and contain any us value
    const looseMatch = line.match(/^([\w.\-+]+\.sys)\s.*?([\d.]+)\s*us/i);
    if (looseMatch) rows.push({ name: looseMatch[1], usPerDpc: parseFloat(looseMatch[2]) });
  }
  // Dedup by name (max usPerDpc), then sort desc
  const byName = new Map<string, ParsedDriver>();
  for (const r of rows) {
    const prev = byName.get(r.name.toLowerCase());
    if (!prev || r.usPerDpc > prev.usPerDpc) byName.set(r.name.toLowerCase(), r);
  }
  return Array.from(byName.values()).sort((a, b) => b.usPerDpc - a.usPerDpc).slice(0, 12);
}

const KNOWN_FIXES: Array<{ pattern: RegExp; fix: string }> = [
  { pattern: /nvlddmkm/i,           fix: "NVIDIA — enable Max-Perf Mode + MSI Mode (Registry / NVIDIA tabs)" },
  { pattern: /amdkmdag|atikmdag/i,  fix: "AMD — Optimize Latency + TDR Timeout tweaks (AMD tab)" },
  { pattern: /ndis|netio|tcpip/i,   fix: "Disable Large Send Offload + RSS tuning (Network tab)" },
  { pattern: /athrx|killer|wifi/i,  fix: "Network Throttling Index FFFFFFFF + USB Wi-Fi power-save off" },
  { pattern: /usbport|usbhub|usbxhci|hidusb/i, fix: "Disable USB Selective Suspend + USB Power-Save (Laptop tab)" },
  { pattern: /hdaudbus|portcls/i,   fix: "Disable HDMI Audio bus on NVIDIA/AMD; raise audio driver buffer" },
  { pattern: /storport|ntfs|stornvme/i, fix: "Update chipset/NVMe drivers; disable DIPM in power options" },
  { pattern: /dxgkrnl|dxgmms/i,     fix: "Toggle HAGS off then on; rebuild shader cache" },
  { pattern: /tcpip\.sys/i,         fix: "Reset Winsock + TCP autotuning to normal" },
];

function suggestFix(driverName: string): string {
  for (const { pattern, fix } of KNOWN_FIXES) {
    if (pattern.test(driverName)) return fix;
  }
  return "Update vendor driver from manufacturer's site (not Windows Update)";
}

function severityFor(us: number): { label: string; tone: string } {
  if (us >= 500) return { label: "CRITICAL", tone: "text-red-400 bg-red-500/10 border-red-500/30" };
  if (us >= 250) return { label: "HIGH",     tone: "text-orange-400 bg-orange-500/10 border-orange-500/30" };
  if (us >= 100) return { label: "MED",      tone: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  return                  { label: "OK",     tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
}

export default function DPCLatencyPage() {
  const [pasted, setPasted] = useState("");
  const parsed = useMemo(() => parseXperfSummary(pasted), [pasted]);

  const downloadRunCheck = () => {
    const ps1 = `# ==============================================================
# Opti Gods — DPC Latency Run Check (xperf / WPR)
#
# Captures a 30-second DPC/ISR trace and prints a per-driver
# summary you paste back into the Opti Gods web UI.
#
# 1. Right-click  -> "Run with PowerShell as Administrator"
# 2. Wait 30 seconds while the trace runs.
# 3. The script will print a table of the worst offenders.
# 4. Copy everything from "===== PASTE THIS BLOCK =====" down to
#    "===== END PASTE =====" into the textarea on the website.
# ============================================================

$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods - DPC Latency Run Check"

function Test-Admin {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object System.Security.Principal.WindowsPrincipal($id)).IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not (Test-Admin)) {
    Write-Host ""
    Write-Host "  !! This script must run as Administrator !!" -ForegroundColor Red
    Read-Host "  Press Enter to close"; exit 1
}

Write-Host ""
Write-Host " OPTI GODS - DPC Latency Run Check" -ForegroundColor Red
Write-Host " ----------------------------------" -ForegroundColor DarkRed
Write-Host ""

# Detect xperf (Windows Performance Toolkit) — preferred, gives per-driver us.
$xperf = Get-Command xperf.exe -EA SilentlyContinue
$wpr   = Get-Command wpr.exe   -EA SilentlyContinue

if ($xperf) {
    $etl = "$env:TEMP\\optigods-dpc.etl"
    Write-Host " [1/3] Starting kernel DPC/ISR trace (xperf, 30s)..." -ForegroundColor Cyan
    xperf -on PROC_THREAD+LOADER+DPC+INTERRUPT -f $etl | Out-Null
    Start-Sleep -Seconds 30
    xperf -d $etl | Out-Null
    Write-Host " [2/3] Trace written: $etl" -ForegroundColor DarkGreen
    Write-Host " [3/3] Summarising per-driver DPC time..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "===== PASTE THIS BLOCK =====" -ForegroundColor Yellow
    # xperf -i ... -a dpcisr  produces lines like:
    #   <driver.sys>  <dpc_count>  <isr_count>  <us_per_dpc>us
    xperf -i $etl -a dpcisr 2>$null | Select-Object -First 60
    Write-Host "===== END PASTE =====" -ForegroundColor Yellow
} elseif ($wpr) {
    $etl = "$env:TEMP\\optigods-dpc.etl"
    Write-Host " [1/3] xperf not found — falling back to WPR (Windows Performance Recorder, 30s)..." -ForegroundColor Cyan
    wpr -start GeneralProfile -filemode 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { wpr -start GeneralProfile 2>$null | Out-Null }
    Start-Sleep -Seconds 30
    wpr -stop $etl 2>$null | Out-Null
    Write-Host " [2/3] Trace written: $etl" -ForegroundColor DarkGreen
    Write-Host " [3/3] Inline driver summary is not available without xperf." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "===== PASTE THIS BLOCK =====" -ForegroundColor Yellow
    Write-Host "WPR trace captured at $etl"
    Write-Host "Open it with Windows Performance Analyzer (wpa.exe) for a per-driver breakdown."
    Write-Host "Install xperf (Windows Performance Toolkit) and re-run this script for inline parsing."
    Write-Host "===== END PASTE =====" -ForegroundColor Yellow
} else {
    Write-Host " [!] Neither xperf nor wpr is installed on this PC." -ForegroundColor Red
    Write-Host "     Install the Windows ADK -> Windows Performance Toolkit, then re-run." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "===== PASTE THIS BLOCK =====" -ForegroundColor Yellow
    Write-Host "ERROR: Windows Performance Toolkit not installed."
    Write-Host "Download: https://learn.microsoft.com/windows-hardware/get-started/adk-install"
    Write-Host "===== END PASTE =====" -ForegroundColor Yellow
}

Write-Host ""
Write-Host " Done. Paste the marked block back into Opti Gods to see the top offenders." -ForegroundColor Green
Write-Host ""
Read-Host " Press Enter to close"
`;
    const blob = new Blob([ps1], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OptiGods-DPC-RunCheck.ps1";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
    } catch {
      /* clipboard denied — user can still paste manually */
    }
  };

  return (
    <div id="dpc-latency" className="space-y-6" data-testid="page-dpc-latency">
      <header className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <Activity className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-white">DPC Latency Check</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Measure kernel-mode driver latency spikes — the #1 cause of audio crackles + frame-time stutter.
          </p>
        </div>
      </header>

      <V2TweakSection
        heading="DPC Latency Tool"
        accent="red"
        testIdSuffix="dpc-tool"
        description="Enable to include the DPC probe entry in your generated PowerShell script."
        ids={["ToolDPCLatencyCheck"]}
      />

      {/* ── Step 1: Run check ── */}
      <section className="rounded-xl border border-red-500/25 bg-gradient-to-br from-red-500/5 to-black/40 p-5 space-y-4" data-testid="section-dpc-run-check">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0">
            <Play className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Step 1 — Run check</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Downloads a PowerShell script that uses <strong className="text-zinc-200">xperf</strong> (or
              <strong className="text-zinc-200"> wpr</strong> as a fallback) to record a 30-second DPC/ISR trace
              and print a per-driver summary into the console window.
            </p>
          </div>
        </div>
        <Button
          onClick={downloadRunCheck}
          data-testid="button-run-dpc-check"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Run Check (.ps1)
        </Button>
      </section>

      {/* ── Step 2: Paste back ── */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-4" data-testid="section-dpc-paste-back">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
            <ClipboardPaste className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Step 2 — Paste results</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Copy everything between <code className="font-mono text-xs px-1 py-0.5 rounded bg-black/40">PASTE THIS BLOCK</code>{" "}
              and <code className="font-mono text-xs px-1 py-0.5 rounded bg-black/40">END PASTE</code> from the PowerShell window,
              then paste it here. We will rank the worst offenders and suggest a fix for each.
            </p>
          </div>
        </div>
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste the &quot;PASTE THIS BLOCK&quot; output here..."
          data-testid="textarea-dpc-paste"
          className="font-mono text-xs min-h-[140px] bg-black/40 border-white/10"
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={pasteFromClipboard}
            variant="outline"
            size="sm"
            data-testid="button-paste-clipboard"
            className="border-white/10 text-zinc-300"
          >
            <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />
            Paste from clipboard
          </Button>
          {pasted && (
            <Button
              onClick={() => setPasted("")}
              variant="ghost"
              size="sm"
              data-testid="button-clear-paste"
              className="text-zinc-500"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Parsed offenders */}
        {parsed.length > 0 && (
          <div className="pt-2" data-testid="dpc-results">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Top {parsed.length} DPC offenders
            </h4>
            <ul className="space-y-1.5">
              {parsed.map((d) => {
                const sev = severityFor(d.usPerDpc);
                return (
                  <li
                    key={d.name}
                    data-testid={`dpc-row-${d.name.toLowerCase()}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/40 border border-white/5"
                  >
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${sev.tone}`}>
                      {sev.label}
                    </span>
                    <span className="font-mono text-xs text-zinc-200 w-44 truncate shrink-0">{d.name}</span>
                    <span className="text-xs text-zinc-400 shrink-0 tabular-nums w-24">{d.usPerDpc.toFixed(1)} us/DPC</span>
                    <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />
                    <span className="text-xs text-zinc-400 flex-1">{suggestFix(d.name)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {pasted && parsed.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Could not parse any driver rows from the paste. Make sure you copied the lines between the
            <code className="font-mono px-1">PASTE THIS BLOCK</code> markers.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
          Common DPC Offenders (and the fixes Opti Gods already ships)
        </h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          {[
            { drv: "nvlddmkm.sys", fix: "NVIDIA Max-Perf Mode + MSI Mode tweaks (Registry tab)" },
            { drv: "ndis.sys / Wi-Fi", fix: "Disable Large Send Offload + RSS Tuning (Network tab)" },
            { drv: "USB host controllers", fix: "Disable USB Selective Suspend + Power Save (Laptop tab)" },
            { drv: "athrx.sys / Killer NIC", fix: "Network Throttling Index FFFFFFFF" },
            { drv: "HDAudBus.sys", fix: "Disable HDMI Audio bus (NVIDIA/AMD tabs)" },
            { drv: "amdkmdag.sys", fix: "AMD Optimize Latency + TDR tweaks (AMD tab)" },
          ].map(({ drv, fix }) => (
            <li key={drv} className="flex items-start gap-2">
              <span className="font-mono text-xs text-red-400 shrink-0 w-44">{drv}</span>
              <span className="text-zinc-500">→</span>
              <span>{fix}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <a
          href="https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-analyzer"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/10 text-zinc-300 hover:bg-white/5 text-sm"
          data-testid="link-wpa-docs"
        >
          <Info className="w-4 h-4" />
          Windows Performance Analyzer Docs
        </a>
      </div>
    </div>
  );
}
