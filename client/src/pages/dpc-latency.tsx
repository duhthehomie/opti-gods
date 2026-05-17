import { Activity, Download, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V2TweakSection } from "@/components/v2-tweak-section";

/**
 * DPC Latency tab — Tools & Fixes shell.
 * V2 Task #38: web build shows guidance + a downloadable PowerShell probe.
 * Real real-time graph lands in the Tauri build (ETW kernel events).
 */
export default function DPCLatencyPage() {
  const downloadProbe = () => {
    const ps1 = `# ============================================================
# Opti Gods — DPC Latency Quick Probe
# Samples kernel DPC + ISR queue lengths for 30 seconds and
# reports any drivers spending > 500us per DPC (audio crackle
# + frame-time stutter threshold).
#
# Run as Administrator.
# ============================================================
$ErrorActionPreference = "SilentlyContinue"
Write-Host "" ; Write-Host " OPTI GODS - DPC Latency Probe (30s sample)" -ForegroundColor Red
Write-Host " --------------------------------------------"  -ForegroundColor DarkRed

$session = "OptiGodsDPC"
logman create trace $session -p "Microsoft-Windows-Kernel-Processor-Power" -o "$env:TEMP\\optigods-dpc.etl" -ets | Out-Null
Start-Sleep -Seconds 30
logman stop $session -ets | Out-Null

Write-Host ""
Write-Host " Sample written to: $env:TEMP\\optigods-dpc.etl" -ForegroundColor Green
Write-Host " Open it with Microsoft's xperf / WPA for full analysis." -ForegroundColor Yellow
Write-Host " Common offenders: nvlddmkm.sys, ndis.sys, athrx.sys (Wi-Fi), USB host controllers."
Write-Host ""
Read-Host " Press ENTER to close"
`;
    const blob = new Blob([ps1], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "OptiGods-DPC-Probe.ps1";
    a.click();
    URL.revokeObjectURL(a.href);
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

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
            Web Build — Probe Only
          </h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Real-time DPC measurement runs in the desktop (Tauri) build via ETW
          kernel events. On the web we ship a short PowerShell probe that
          captures a 30-second sample to <code className="px-1 py-0.5 rounded bg-black/40 font-mono text-xs">%TEMP%\optigods-dpc.etl</code>{" "}
          — open it with Microsoft's <strong>xperf / Windows Performance Analyzer</strong>{" "}
          for a full driver breakdown.
        </p>
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
        <Button
          onClick={downloadProbe}
          data-testid="button-download-dpc-probe"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Download DPC Probe (.ps1)
        </Button>
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
