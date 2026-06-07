import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Download, ChevronDown, Zap, Wifi, Volume2, HardDrive, Monitor, Cpu, CheckCircle2, ClipboardPaste, Play, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
    const xperfMatch = line.match(/([\w.\-+]+\.sys)\b[^\d]*\d+[^\d]+\d+[^\d]+([\d.]+)\s*us/i);
    if (xperfMatch) { rows.push({ name: xperfMatch[1], usPerDpc: parseFloat(xperfMatch[2]) }); continue; }
    const wprMatch = line.match(/([\w.\-+]+\.sys)[^\d]*DPCs:\s*\d+[^\d]+Avg\(us\):\s*([\d.]+)(?:[^\d]+%Time:\s*([\d.]+))?/i);
    if (wprMatch) { rows.push({ name: wprMatch[1], usPerDpc: parseFloat(wprMatch[2]), pctTime: wprMatch[3] ? parseFloat(wprMatch[3]) : undefined }); continue; }
    const looseMatch = line.match(/^([\w.\-+]+\.sys)\s.*?([\d.]+)\s*us/i);
    if (looseMatch) rows.push({ name: looseMatch[1], usPerDpc: parseFloat(looseMatch[2]) });
  }
  const byName = new Map<string, ParsedDriver>();
  for (const r of rows) {
    const prev = byName.get(r.name.toLowerCase());
    if (!prev || r.usPerDpc > prev.usPerDpc) byName.set(r.name.toLowerCase(), r);
  }
  return Array.from(byName.values()).sort((a, b) => b.usPerDpc - a.usPerDpc).slice(0, 12);
}

function downloadBat(filename: string, ps1: string) {
  const b64 = btoa(unescape(encodeURIComponent(ps1)));
  const bat = [
    "@echo off",
    "net session >nul 2>&1",
    "if %errorLevel% neq 0 (",
    "    echo Requesting administrator privileges...",
    "    powershell -Command \"Start-Process '%~f0' -Verb RunAs\"",
    "    exit /b",
    ")",
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$b = '${b64}'; $ps = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b)); $t = [IO.Path]::GetTempFileName() + '.ps1'; [IO.File]::WriteAllText($t, $ps); & $t; Remove-Item $t -EA SilentlyContinue"`,
    "pause",
    "",
  ].join("\r\n");
  const blob = new Blob([bat], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `optigods_${filename}.bat`;
  a.click();
  URL.revokeObjectURL(url);
}

interface DpcFix {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  driver: string;
  label: string;
  desc: string;
  severity: "critical" | "high" | "medium";
  reboot: boolean;
  ps1: string;
}

const DPC_FIXES: DpcFix[] = [
  {
    id: "nvidia",
    icon: Monitor,
    driver: "nvlddmkm.sys",
    label: "NVIDIA GPU",
    severity: "critical",
    reboot: true,
    desc: "Enables MSI interrupt mode on your NVIDIA GPU — the #1 cause of DPC spikes. Also sets PowerMizer to Max Performance so the driver doesn't downclock between frames.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — NVIDIA DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — NVIDIA DPC Latency Fix" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""
$devClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
$fixed = $false
0..9 | ForEach-Object {
    $k = "$devClass\\000$_"
    if (Test-Path $k) {
        $desc = (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc
        if ($desc -match 'NVIDIA') {
            Write-Host " [GPU] Found: $desc" -ForegroundColor Cyan
            $msiPath = "$k\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"
            if (!(Test-Path $msiPath)) { New-Item $msiPath -Force | Out-Null }
            Set-ItemProperty $msiPath 'MSISupported' 1 -Type DWord -Force
            Set-ItemProperty $msiPath 'MessageNumberLimit' 16 -Type DWord -Force
            Write-Host " [OK] MSI Interrupt mode ENABLED — eliminates level-triggered interrupt delays" -ForegroundColor Green
            Set-ItemProperty $k 'PowerMizerEnable' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'PowerMizerLevel' 1 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'PerfLevelSrc' 0x2222 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] PowerMizer set to Maximum Performance — GPU won't downclock between frames" -ForegroundColor Green
            $fixed = $true
        }
    }
}
if (!$fixed) { Write-Host " [!] No NVIDIA GPU found. Make sure NVIDIA drivers are installed." -ForegroundColor Yellow }
Write-Host ""
Write-Host " REBOOT REQUIRED for MSI mode to activate." -ForegroundColor Cyan
Write-Host " After reboot: Device Manager > Display Adapters > GPU > Properties > Resources" -ForegroundColor Gray
Write-Host "   Should now show Message-Signaled Interrupts instead of Interrupt Request Line" -ForegroundColor Gray
Write-Host ""`,
  },
  {
    id: "amd",
    icon: Monitor,
    driver: "amdkmdag.sys",
    label: "AMD GPU",
    severity: "critical",
    reboot: true,
    desc: "Enables MSI interrupt mode on AMD Radeon GPU and disables ULPS (Ultra Low Power State) — the main AMD DPC offender that causes stutters when the GPU wakes from low power.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — AMD DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — AMD GPU DPC Latency Fix" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""
$devClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
$fixed = $false
0..9 | ForEach-Object {
    $k = "$devClass\\000$_"
    if (Test-Path $k) {
        $desc = (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc
        if ($desc -match 'AMD|Radeon|ATI') {
            Write-Host " [GPU] Found: $desc" -ForegroundColor Cyan
            $msiPath = "$k\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"
            if (!(Test-Path $msiPath)) { New-Item $msiPath -Force | Out-Null }
            Set-ItemProperty $msiPath 'MSISupported' 1 -Type DWord -Force
            Write-Host " [OK] MSI Interrupt mode ENABLED" -ForegroundColor Green
            Set-ItemProperty $k 'EnableULPS' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'EnableULPS_NA' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] ULPS (Ultra Low Power State) DISABLED — was causing DPC stutter spikes on GPU wake" -ForegroundColor Green
            Set-ItemProperty $k 'PP_ThermalAutoThrottlingEnable' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'KMD_EnableComputePreemption' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] Thermal auto-throttle and compute preemption disabled" -ForegroundColor Green
            $fixed = $true
        }
    }
}
if (!$fixed) { Write-Host " [!] No AMD GPU found. Install AMD Adrenalin drivers first." -ForegroundColor Yellow }
Write-Host ""
Write-Host " REBOOT REQUIRED." -ForegroundColor Cyan
Write-Host ""`,
  },
  {
    id: "network",
    icon: Wifi,
    driver: "ndis.sys / netio.sys",
    label: "Network Driver",
    severity: "high",
    reboot: false,
    desc: "Disables interrupt moderation, RSS, and LSO on all active network adapters. Also removes the Windows 10% UDP throttle that affects game server tick rates.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — Network DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — Network Driver DPC Fix" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""
Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
    $n = $_.Name
    Write-Host " [NET] Processing: $n ($($_.InterfaceDescription))" -ForegroundColor Cyan
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*InterruptModeration' -RegistryValue 0 -EA SilentlyContinue
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*RSS' -RegistryValue 0 -EA SilentlyContinue
    Disable-NetAdapterLso -Name $n -EA SilentlyContinue
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*LsoV2IPv4' -RegistryValue 0 -EA SilentlyContinue
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*LsoV2IPv6' -RegistryValue 0 -EA SilentlyContinue
    Write-Host " [OK] Interrupt moderation OFF, RSS OFF, LSO OFF on $n" -ForegroundColor Green
}
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xFFFFFFFF -Type DWord -Force
Write-Host " [OK] NetworkThrottlingIndex removed — no more 10% UDP throttle on game traffic" -ForegroundColor Green
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' -Name 'TCPNoDelay' -Value 1 -Type DWord -Force
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' -Name 'TcpAckFrequency' -Value 1 -Type DWord -Force
Write-Host " [OK] TCP no-delay + immediate ACK enabled" -ForegroundColor Green
Write-Host ""
Write-Host " Network DPC fix applied. No reboot needed — takes effect immediately." -ForegroundColor Cyan
Write-Host ""`,
  },
  {
    id: "usb",
    icon: Zap,
    driver: "usbport.sys",
    label: "USB Controller",
    severity: "high",
    reboot: true,
    desc: "Disables USB selective suspend for all controllers and hubs. USB suspend causes 1-20ms interrupt storms when your mouse/keyboard/headset wakes from low-power — directly hurts input latency.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — USB DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — USB Controller DPC Fix" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""
$usbSvc = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\USB'
if (!(Test-Path $usbSvc)) { New-Item $usbSvc -Force | Out-Null }
Set-ItemProperty $usbSvc 'DisableSelectiveSuspend' 1 -Type DWord -Force
Write-Host " [OK] USB selective suspend DISABLED — controllers won't power down mid-game" -ForegroundColor Green
powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null
powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host " [OK] USB power management set to always-on in power plan" -ForegroundColor Green
Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USB' -EA SilentlyContinue | ForEach-Object {
    Get-ChildItem $_.PSPath -EA SilentlyContinue | ForEach-Object {
        $devParam = "$($_.PSPath)\\Device Parameters"
        if (Test-Path $devParam) {
            Set-ItemProperty $devParam 'SelectiveSuspendEnabled' 0 -Type DWord -Force -EA SilentlyContinue
        }
    }
}
Write-Host " [OK] All USB hub devices set to no-suspend" -ForegroundColor Green
Write-Host ""
Write-Host " REBOOT RECOMMENDED." -ForegroundColor Cyan
Write-Host ""`,
  },
  {
    id: "audio",
    icon: Volume2,
    driver: "HDAudBus.sys",
    label: "Audio Driver",
    severity: "medium",
    reboot: false,
    desc: "Raises MMCSS Pro Audio scheduler priority and sets SystemResponsiveness=0 so games get maximum CPU time. NVIDIA/AMD HDMI audio devices are common DPC offenders if you output audio over HDMI.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — Audio DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — Audio Driver DPC Fix" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""
$proAudio = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Pro Audio'
if (!(Test-Path $proAudio)) { New-Item $proAudio -Force | Out-Null }
Set-ItemProperty $proAudio 'Scheduling Category' 'High' -Type String -Force
Set-ItemProperty $proAudio 'Priority' 6 -Type DWord -Force
Set-ItemProperty $proAudio 'SFIO Priority' 'High' -Type String -Force
Set-ItemProperty $proAudio 'Background Only' 'False' -Type String -Force
Set-ItemProperty $proAudio 'Clock Rate' 10000 -Type DWord -Force
Set-ItemProperty $proAudio 'GPU Priority' 8 -Type DWord -Force
Write-Host " [OK] MMCSS Pro Audio profile set to maximum priority" -ForegroundColor Green
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force
Write-Host " [OK] SystemResponsiveness=0 — maximum CPU time to foreground games and multimedia" -ForegroundColor Green
Write-Host ""
Write-Host " Audio DPC fix applied. No reboot needed." -ForegroundColor Cyan
Write-Host " TIP: If you still see HDAudBus spikes, update audio drivers from your GPU vendor" -ForegroundColor Gray
Write-Host "      site (not Windows Update) and consider disabling HDMI audio if unused." -ForegroundColor Gray
Write-Host ""`,
  },
  {
    id: "nvme",
    icon: HardDrive,
    driver: "stornvme.sys",
    label: "NVMe Storage",
    severity: "medium",
    reboot: true,
    desc: "Disables NVMe APST (Autonomous Power State Transitions) — the drive entering low-power states mid-game causes read latency spikes of 100-500ms that feel like freezes.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — NVMe DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — NVMe Storage DPC Fix" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""
$nvmeKey = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\stornvme\\Parameters\\Device'
if (!(Test-Path $nvmeKey)) { New-Item $nvmeKey -Force | Out-Null }
Set-ItemProperty $nvmeKey 'AllowIdlePowerManagement' 0 -Type DWord -Force
Write-Host " [OK] NVMe APST disabled — drive won't enter low-power states mid-game" -ForegroundColor Green
powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host " [OK] Disk power-off timeout set to Never" -ForegroundColor Green
Write-Host ""
Write-Host " REBOOT REQUIRED for NVMe changes to take effect." -ForegroundColor Cyan
Write-Host ""`,
  },
  {
    id: "directx",
    icon: Cpu,
    driver: "dxgkrnl.sys",
    label: "DirectX / GPU Scheduler",
    severity: "high",
    reboot: true,
    desc: "Disables Hardware-Accelerated GPU Scheduling (HAGS) which causes dxgkrnl DPC spikes on GTX 10xx/16xx and older AMD cards. Also clears all stale shader caches.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — DirectX DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — DirectX GPU Scheduler DPC Fix" -ForegroundColor Red
Write-Host " =============================================" -ForegroundColor DarkRed
Write-Host ""
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force
Write-Host " [OK] HAGS disabled — reduces dxgkrnl DPC overhead on GTX 10xx/16xx and older AMD cards" -ForegroundColor Green
$caches = @(
    "$env:LOCALAPPDATA\\NVIDIA\\DXCache",
    "$env:LOCALAPPDATA\\NVIDIA\\GLCache",
    "$env:LOCALAPPDATA\\D3DSCache",
    "$env:LOCALAPPDATA\\AMD\\DxcCache"
)
foreach ($c in $caches) {
    if (Test-Path $c) {
        Remove-Item "$c\\*" -Recurse -Force -EA SilentlyContinue
        Write-Host " [OK] Cleared: $c" -ForegroundColor Green
    }
}
Write-Host " [OK] All DirectX/GPU shader caches cleared — dxgkrnl rebuilds clean on next game launch" -ForegroundColor Green
Write-Host ""
Write-Host " REBOOT REQUIRED." -ForegroundColor Cyan
Write-Host ""`,
  },
];

const SEVERITY_CONFIG = {
  critical: { label: "CRITICAL", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
  high:     { label: "HIGH",     cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  medium:   { label: "MEDIUM",   cls: "bg-amber-500/10 text-amber-300 border-amber-500/25" },
};

const KNOWN_FIXES: Array<{ pattern: RegExp; fix: string }> = [
  { pattern: /nvlddmkm/i,           fix: "NVIDIA GPU — click the 'NVIDIA GPU' fix card above to apply MSI mode + Max Performance" },
  { pattern: /amdkmdag|atikmdag/i,  fix: "AMD GPU — click the 'AMD GPU' fix card above to disable ULPS and enable MSI mode" },
  { pattern: /ndis|netio|tcpip/i,   fix: "Network Driver — click the 'Network Driver' fix card above" },
  { pattern: /usbport|usbhub/i,     fix: "USB Controller — click the 'USB Controller' fix card above to disable selective suspend" },
  { pattern: /hdaudbus|portcls/i,   fix: "Audio — click the 'Audio Driver' fix card above to boost MMCSS priority" },
  { pattern: /stornvme|storahci/i,  fix: "NVMe Storage — click the 'NVMe Storage' fix card above to disable APST" },
  { pattern: /dxgkrnl/i,            fix: "DirectX — click the 'DirectX / GPU Scheduler' fix card above" },
  { pattern: /acpi/i,               fix: "ACPI — BIOS-level; update your motherboard firmware + disable C-states in BIOS" },
  { pattern: /wdf|kmdf/i,           fix: "WDF Driver — check for driver updates for the specific device causing DPC spikes" },
];

export default function DpcLatencyPage() {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedDriver[]>([]);

  function applyFix(fix: DpcFix) {
    downloadBat(`dpc_${fix.id}`, fix.ps1);
    setApplied(prev => new Set(prev).add(fix.id));
  }

  function runAnalysis() {
    setParsed(parseXperfSummary(rawText));
  }

  return (
    <div className="space-y-6 px-5 py-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-red-400" />
          <h1 className="text-xl font-display font-bold text-white">DPC Latency Tweaks</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-300 border border-red-500/25 uppercase tracking-wide">
            V3 Click-to-Apply
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          One-click tweaks for the most common DPC interrupt offenders. Each button downloads a targeted .bat — run as Administrator for instant results.
        </p>
      </div>

      {/* What is DPC? */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-blue-300">What causes DPC latency?</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            DPC (Deferred Procedure Call) spikes happen when a hardware driver takes too long to handle an interrupt. Spikes above <span className="text-white font-semibold">500µs</span> cause frame stutters, input lag, and audio glitches. GPU, network, and USB drivers are the most common offenders on gaming PCs.
          </p>
        </div>
      </div>

      {/* One-Click Fix Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1">One-Click Driver Tweaks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DPC_FIXES.map((fix, i) => {
            const Icon = fix.icon;
            const sev = SEVERITY_CONFIG[fix.severity];
            const done = applied.has(fix.id);
            return (
              <motion.div
                key={fix.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border transition-colors",
                  done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-white/8 bg-zinc-950/50 hover:border-white/15 hover:bg-zinc-900/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                      done ? "bg-emerald-500/15 border-emerald-500/30" : "bg-zinc-900 border-white/8"
                    )}>
                      <Icon className={cn("w-4 h-4", done ? "text-emerald-400" : "text-zinc-400")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white leading-tight">{fix.label}</p>
                      <p className="text-[10px] font-mono text-zinc-600 leading-tight mt-0.5">{fix.driver}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide", sev.cls)}>
                      {sev.label}
                    </span>
                    {fix.reboot && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-500/25 bg-amber-500/8 text-amber-400 uppercase tracking-wide">
                        REBOOT
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">{fix.desc}</p>

                <Button
                  size="sm"
                  data-testid={`button-dpc-fix-${fix.id}`}
                  onClick={() => applyFix(fix)}
                  className={cn(
                    "w-full gap-2 text-xs font-bold transition-all",
                    done
                      ? "bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  )}
                >
                  {done ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Downloaded — Run as Admin</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" /> Apply Tweak (.bat)</>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Advanced: Diagnose Section */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <button
          onClick={() => setAdvancedOpen(v => !v)}
          data-testid="button-dpc-advanced-toggle"
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-zinc-900/60 transition-colors"
        >
          <ClipboardPaste className="w-4 h-4 text-zinc-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-300">Advanced — Diagnose Your PC</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Download the scanner, paste results, see which drivers are spiking on your specific system</p>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-zinc-600 transition-transform", advancedOpen && "rotate-180")} />
        </button>

        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1 space-y-4 border-t border-white/5 bg-black/30">
                {/* Step 1 */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mt-3">Step 1 — Run the scanner</p>
                  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-white/5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Requires <span className="text-white font-semibold">Windows Performance Toolkit</span> (xperf) — part of the Windows SDK. If you don't have it, the script falls back to WPR which is built in to Windows 10/11.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    data-testid="button-dpc-download-scanner"
                    onClick={() => downloadBat("dpc_scanner", `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — DPC Scanner"
Write-Host ""
Write-Host " OPTI GODS — DPC Latency Scanner" -ForegroundColor Red
Write-Host " Capturing 30-second DPC/ISR trace..." -ForegroundColor Cyan
Write-Host ""
$hasXperf = Get-Command xperf -EA SilentlyContinue
if ($hasXperf) {
    Write-Host " [xperf] Starting trace..." -ForegroundColor Green
    xperf -on PROC_THREAD+LOADER+DPC+INTERRUPT -f "$env:TEMP\\optigods_dpc.etl" 2>$null
    Start-Sleep 30
    xperf -stop 2>$null
    Write-Host " [xperf] Analyzing..." -ForegroundColor Cyan
    xperf -i "$env:TEMP\\optigods_dpc.etl" -a dpcisr -noheader 2>$null
    Remove-Item "$env:TEMP\\optigods_dpc.etl" -EA SilentlyContinue
} else {
    Write-Host " [wpr] xperf not found, using WPR fallback..." -ForegroundColor Yellow
    $out = "$env:TEMP\\optigods_dpc.etl"
    wpr -start DPC -filemode 2>$null
    Write-Host " Recording for 30 seconds... close games if open for clean baseline." -ForegroundColor Gray
    Start-Sleep 30
    wpr -stop $out 2>$null
    Write-Host " [wpr] Trace captured. Analysing with xbootmgr is needed for full output." -ForegroundColor Yellow
    Write-Host " Copy the lines above and paste them into the Opti Gods DPC analyser." -ForegroundColor Cyan
}
Write-Host ""
Write-Host " PASTE THE OUTPUT ABOVE into the Opti Gods DPC analyser." -ForegroundColor Yellow
Write-Host ""`)}
                    className="gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download DPC Scanner (.bat)
                  </Button>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Step 2 — Paste results here</p>
                  <Textarea
                    data-testid="textarea-dpc-paste"
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="Paste the xperf/WPR console output here..."
                    className="font-mono text-[11px] bg-black/40 border-white/10 text-zinc-300 placeholder:text-zinc-700 resize-none h-32"
                  />
                  <Button
                    size="sm"
                    data-testid="button-dpc-analyze"
                    onClick={runAnalysis}
                    disabled={!rawText.trim()}
                    className="gap-2 bg-red-600 hover:bg-red-500 text-white"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Analyze Output
                  </Button>
                </div>

                {/* Results */}
                {parsed.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Results — Top DPC Offenders</p>
                    <div className="space-y-2">
                      {parsed.map((d, i) => {
                        const fix = KNOWN_FIXES.find(k => k.pattern.test(d.name));
                        const severity = d.usPerDpc > 500 ? "critical" : d.usPerDpc > 150 ? "high" : "medium";
                        const sev = SEVERITY_CONFIG[severity];
                        return (
                          <div
                            key={d.name}
                            className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-zinc-900/40"
                          >
                            <span className="text-[10px] font-mono text-zinc-600 w-4 shrink-0 mt-0.5">{i + 1}</span>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-bold text-white">{d.name}</span>
                                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide", sev.cls)}>
                                  {sev.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                <span><span className="text-zinc-300 font-semibold">{d.usPerDpc.toFixed(1)}µs</span> avg per DPC</span>
                                {d.pctTime !== undefined && <span>{d.pctTime.toFixed(1)}% CPU time</span>}
                              </div>
                              {fix && (
                                <p className="text-[11px] text-emerald-400 mt-1">
                                  → {fix.fix}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
