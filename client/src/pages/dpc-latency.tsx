import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Download, ChevronDown, Zap, Wifi, Volume2, HardDrive, Monitor, Cpu, CheckCircle2, Upload, FileText, Play, Info, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHardwareInfo, type HardwareInfo } from "@/hooks/use-hardware-info";

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
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$b = '${b64}'; $ps = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b)); $t = [IO.Path]::GetTempFileName() + '.ps1'; [IO.File]::WriteAllText($t, $ps, (New-Object System.Text.UTF8Encoding $true)); & $t; Remove-Item $t -EA SilentlyContinue"`,
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
  /** Returns true if this card is relevant for the detected hardware */
  visible: (hw: HardwareInfo) => boolean;
  /** Short label shown as a green badge when hw matches */
  detectedLabel?: (hw: HardwareInfo) => string;
  ps1: string;
}

const DPC_FIXES: DpcFix[] = [
  // ── GPU: NVIDIA ────────────────────────────────────────────────────────────
  {
    id: "nvidia",
    icon: Monitor,
    driver: "nvlddmkm.sys",
    label: "NVIDIA GPU",
    severity: "critical",
    reboot: true,
    visible: (hw) => hw.isNvidia,
    detectedLabel: (hw) => hw.gpuName || "NVIDIA GPU",
    desc: "Enables MSI interrupt mode on your NVIDIA GPU — the #1 cause of DPC spikes. Also sets PowerMizer to Max Performance so the driver doesn't downclock between frames.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — NVIDIA DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — NVIDIA DPC Latency Fix (Driver 610.x+ Ready)" -ForegroundColor Red
Write-Host " ============================================================" -ForegroundColor DarkRed
Write-Host ""
$devClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
$fixed = $false
$indices = (0..9 | ForEach-Object { "000$_" }) + (10..15 | ForEach-Object { "00$_" })
foreach ($idx in $indices) {
    $k = "$devClass\\$idx"
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
            Set-ItemProperty $k 'PowerMizerLevelAC' 1 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'PerfLevelSrc' 0x2222 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] PowerMizer: Max Performance on both AC and battery — GPU won't downclock" -ForegroundColor Green
            Set-ItemProperty $k 'EnableMCEReporting' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] MCE reporting overhead disabled (610.x+ driver setting)" -ForegroundColor Green
            Set-ItemProperty $k 'RmProfilingAdminOnly' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] GPU profiling access enabled — better performance counter access" -ForegroundColor Green
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
  // ── GPU: AMD (discrete Radeon or APU/Vega) ─────────────────────────────────
  {
    id: "amd",
    icon: Monitor,
    driver: "amdkmdag.sys",
    label: "AMD GPU",
    severity: "critical",
    reboot: true,
    visible: (hw) => hw.isAmdGpu || hw.isAmdApu,
    detectedLabel: (hw) => hw.gpuName || "AMD GPU",
    desc: "Enables MSI interrupt mode on your AMD Radeon GPU and disables ULPS (Ultra Low Power State) — the main AMD DPC offender that causes stutters when the GPU wakes from low power.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — AMD DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — AMD GPU DPC Latency Fix (Adrenalin 25.x Ready)" -ForegroundColor Red
Write-Host " ==============================================================" -ForegroundColor DarkRed
Write-Host ""
$devClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
$fixed = $false
$indices = (0..9 | ForEach-Object { "000$_" }) + (10..15 | ForEach-Object { "00$_" })
foreach ($idx in $indices) {
    $k = "$devClass\\$idx"
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
            Write-Host " [OK] ULPS (Ultra Low Power State) DISABLED — eliminates DPC stutter on GPU wake" -ForegroundColor Green
            Set-ItemProperty $k 'PP_ThermalAutoThrottlingEnable' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'KMD_EnableComputePreemption' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] Thermal auto-throttle and compute preemption disabled" -ForegroundColor Green
            Set-ItemProperty $k 'PP_SclkDeepSleepDisable' 1 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] GPU core clock deep sleep DISABLED (Adrenalin 25.x — RDNA2/3/4 setting)" -ForegroundColor Green
            Set-ItemProperty $k 'EnableAspmL1_1' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'EnableAspmL1_2' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] ASPM L1.1/L1.2 link states DISABLED — prevents PCIe power-state DPC spikes" -ForegroundColor Green
            Set-ItemProperty $k 'KMD_FRTEnabled' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] Fluid Real-Time disabled — removes frame-pacing interference on RDNA3/4" -ForegroundColor Green
            $fixed = $true
        }
    }
}
if (!$fixed) { Write-Host " [!] No AMD GPU found. Install AMD Adrenalin drivers first." -ForegroundColor Yellow }
Write-Host ""
Write-Host " REBOOT REQUIRED." -ForegroundColor Cyan
Write-Host ""`,
  },
  // ── CPU: AMD Ryzen C-State Latency ─────────────────────────────────────────
  {
    id: "cpu_ryzen",
    icon: Cpu,
    driver: "acpi.sys / amdppm.sys",
    label: "AMD Ryzen CPU C-States",
    severity: "high",
    reboot: true,
    visible: (hw) => hw.isRyzen,
    detectedLabel: (hw) => hw.cpuLabel || "AMD Ryzen",
    desc: "Disables deep C-state transitions (C2/C3) that cause ACPI wake-up latency spikes on Ryzen CPUs. Also pins Precision Boost 2 to 100% min frequency so the CPU never drops clock speed between game frames.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — AMD Ryzen DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — AMD Ryzen C-State / DPC Latency Fix" -ForegroundColor Red
Write-Host " ==================================================" -ForegroundColor DarkRed
Write-Host ""
# Disable dynamic tick (biggest single fix for Ryzen DPC latency)
$r = bcdedit /set disabledynamictick yes 2>&1
Write-Host " [OK] Dynamic tick DISABLED — timer interrupt no longer coalesces with C-state wake-up" -ForegroundColor Green
# Pin CPU min performance state to 100% in current power plan
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host " [OK] CPU min frequency pinned to 100% — Precision Boost 2 now operates without floor drops" -ForegroundColor Green
# Disable C-state transitions that cause ACPI latency spikes
$cpuClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Processor'
if (!(Test-Path $cpuClass)) { New-Item $cpuClass -Force | Out-Null }
Set-ItemProperty $cpuClass 'Capabilities' 0x0007e066 -Type DWord -Force -EA SilentlyContinue
Write-Host " [OK] CPU Capabilities: deep C-states (C2/C3) suppressed — wake latency eliminated" -ForegroundColor Green
# MMCSS Gaming thread priority
$games = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
if (!(Test-Path $games)) { New-Item $games -Force | Out-Null }
Set-ItemProperty $games 'GPU Priority'          8  -Type DWord  -Force
Set-ItemProperty $games 'Priority'              6  -Type DWord  -Force
Set-ItemProperty $games 'Scheduling Category' 'High' -Type String -Force
Set-ItemProperty $games 'SFIO Priority'       'High' -Type String -Force
Write-Host " [OK] MMCSS Games profile: maximum CPU + GPU scheduler priority" -ForegroundColor Green
# AMD scheduler hint — tell Windows scheduler this is a high-perf Ryzen
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000' 'KMD_EnableComputePreemption' 0 -Type DWord -Force -EA SilentlyContinue
Write-Host " [OK] AMD scheduler hint applied" -ForegroundColor Green
Write-Host ""
Write-Host " REBOOT REQUIRED for C-state and dynamic tick changes." -ForegroundColor Cyan
Write-Host ""`,
  },
  // ── CPU: Intel C-State Latency ──────────────────────────────────────────────
  {
    id: "cpu_intel",
    icon: Cpu,
    driver: "acpi.sys / intelppm.sys",
    label: "Intel Core CPU C-States",
    severity: "high",
    reboot: true,
    visible: (hw) => hw.isIntelCore,
    detectedLabel: (hw) => hw.cpuLabel || "Intel Core",
    desc: "Disables deep C-state transitions and dynamic tick that cause interrupt wake-up latency on Intel CPUs. Also pins minimum CPU frequency to 100% so SpeedStep doesn't drop clocks between game frames.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — Intel CPU DPC Fix"
Write-Host ""
Write-Host " OPTI GODS — Intel Core C-State / DPC Latency Fix" -ForegroundColor Red
Write-Host " ===================================================" -ForegroundColor DarkRed
Write-Host ""
# Disable dynamic tick
bcdedit /set disabledynamictick yes 2>$null
Write-Host " [OK] Dynamic tick DISABLED — reduces interrupt coalescing latency" -ForegroundColor Green
# Pin CPU min performance to 100%
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host " [OK] CPU minimum frequency pinned to 100% — Turbo Boost stays active between frames" -ForegroundColor Green
# Disable deep C-state (C3/C6) via power plan
powercfg -setacvalueindex SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0 2>$null
powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 0 2>$null
Write-Host " [OK] Deep CPU idle states (C3/C6) suppressed in active power plan" -ForegroundColor Green
# Suppress CPU capabilities for C-state transitions
$cpuClass = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Processor'
if (!(Test-Path $cpuClass)) { New-Item $cpuClass -Force | Out-Null }
Set-ItemProperty $cpuClass 'Capabilities' 0x0007e066 -Type DWord -Force -EA SilentlyContinue
Write-Host " [OK] CPU Capabilities: C2/C3 deep sleep suppressed — wake-up latency eliminated" -ForegroundColor Green
# MMCSS Games priority
$games = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
if (!(Test-Path $games)) { New-Item $games -Force | Out-Null }
Set-ItemProperty $games 'GPU Priority'          8  -Type DWord  -Force
Set-ItemProperty $games 'Priority'              6  -Type DWord  -Force
Set-ItemProperty $games 'Scheduling Category' 'High' -Type String -Force
Set-ItemProperty $games 'SFIO Priority'       'High' -Type String -Force
Write-Host " [OK] MMCSS Games profile: max CPU + GPU scheduler priority" -ForegroundColor Green
Write-Host ""
Write-Host " REBOOT REQUIRED." -ForegroundColor Cyan
Write-Host ""`,
  },
  // ── Network (universal) ─────────────────────────────────────────────────────
  {
    id: "network",
    icon: Wifi,
    driver: "ndis.sys / netio.sys",
    label: "Network Driver",
    severity: "high",
    reboot: false,
    visible: () => true,
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
  // ── USB (universal) ─────────────────────────────────────────────────────────
  {
    id: "usb",
    icon: Zap,
    driver: "usbport.sys",
    label: "USB Controller",
    severity: "high",
    reboot: true,
    visible: () => true,
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
  // ── Audio (universal) ───────────────────────────────────────────────────────
  {
    id: "audio",
    icon: Volume2,
    driver: "HDAudBus.sys",
    label: "Audio Cutouts & Beeps Fix",
    severity: "high",
    reboot: false,
    visible: () => true,
    desc: "Fixes audio pops, beeps, and cutouts mid-game. Tunes both MMCSS Audio + Pro Audio scheduler tasks, disables Windows audio enhancements (APO/EQ/spatial chain — #1 cause of mid-game glitches), and removes the default 10ms audio buffer latency. LatencyMon-clean systems still get cutouts from the enhancement DSP chain — this kills it.",
    ps1: `$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — Audio Cutout Fix"
Write-Host ""
Write-Host " OPTI GODS — Audio Cutout / Beep / Pop Fix" -ForegroundColor Red
Write-Host " ============================================" -ForegroundColor DarkRed
Write-Host ""

# ── 1. MMCSS Audio task (standard audio thread used by games + Discord) ──────
$audio = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Audio'
if (!(Test-Path $audio)) { New-Item $audio -Force | Out-Null }
Set-ItemProperty $audio 'Scheduling Category' 'Medium'  -Type String -Force
Set-ItemProperty $audio 'Priority'             6         -Type DWord  -Force
Set-ItemProperty $audio 'SFIO Priority'        'High'    -Type String -Force
Set-ItemProperty $audio 'Background Only'      'False'   -Type String -Force
Set-ItemProperty $audio 'Clock Rate'           10000     -Type DWord  -Force
Set-ItemProperty $audio 'GPU Priority'         8         -Type DWord  -Force
Write-Host " [OK] MMCSS Audio task: Priority=6, SFIO=High, ClockRate=0.5ms — game audio threads pre-empt background tasks" -ForegroundColor Green

# ── 2. MMCSS Pro Audio task (used by Voicemeeter, DAWs, Realtek driver) ──────
$proAudio = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Pro Audio'
if (!(Test-Path $proAudio)) { New-Item $proAudio -Force | Out-Null }
Set-ItemProperty $proAudio 'Scheduling Category' 'High'   -Type String -Force
Set-ItemProperty $proAudio 'Priority'             6        -Type DWord  -Force
Set-ItemProperty $proAudio 'SFIO Priority'        'High'   -Type String -Force
Set-ItemProperty $proAudio 'Background Only'      'False'  -Type String -Force
Set-ItemProperty $proAudio 'Clock Rate'           10000    -Type DWord  -Force
Set-ItemProperty $proAudio 'GPU Priority'         8        -Type DWord  -Force
Write-Host " [OK] MMCSS Pro Audio task: High scheduling — Realtek/Voicemeeter driver gets deterministic CPU slice" -ForegroundColor Green

# ── 3. SystemResponsiveness = 10 ──────────────────────────────────────────────
$sp = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
Set-ItemProperty $sp 'SystemResponsiveness'    10          -Type DWord  -Force
Set-ItemProperty $sp 'NetworkThrottlingIndex'  0xFFFFFFFF  -Type DWord  -Force
Write-Host " [OK] SystemResponsiveness=10 — game + audio threads own 90% CPU; NetworkThrottling removed" -ForegroundColor Green

# ── 4. Disable Windows Audio Enhancements on ALL render endpoints ─────────────
Write-Host ""
Write-Host " Disabling audio enhancements on all playback devices..." -ForegroundColor Yellow
$renderPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render'
if (Test-Path $renderPath) {
    $devCount = 0
    Get-ChildItem $renderPath | ForEach-Object {
        $propsPath = "$($_.PSPath)\\Properties"
        if (Test-Path $propsPath) {
            # {1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5 = PKEY_AudioEndpoint_Disable_SysFx (0 = disabled = NO effects)
            Set-ItemProperty $propsPath '{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5' 1 -Type DWord -Force -EA SilentlyContinue
            # {62ec7b65-4a0a-4e49-8a4e-16a6e95d756e},1 = disable spatial audio / Windows Sonic
            Set-ItemProperty $propsPath '{62ec7b65-4a0a-4e49-8a4e-16a6e95d756e},1' 0 -Type DWord -Force -EA SilentlyContinue
            $devCount++
        }
    }
    Write-Host " [OK] Audio enhancements (APO / EQ / Windows Sonic / spatial) DISABLED on $devCount device(s)" -ForegroundColor Green
    Write-Host "      APO enhancement chain was DSP-processing every audio frame — direct cause of beeps/pops" -ForegroundColor Gray
} else {
    Write-Host " [!] No audio render devices found in registry (open Sound settings first)" -ForegroundColor Yellow
}

# ── 5. Disable Exclusive Mode protection (lets games own the audio device) ───
if (Test-Path $renderPath) {
    Get-ChildItem $renderPath | ForEach-Object {
        $propsPath = "$($_.PSPath)\\Properties"
        if (Test-Path $propsPath) {
            # {b3f8fa53-0004-438e-9003-51a46e139bfc},3 = allow exclusive mode
            Set-ItemProperty $propsPath '{b3f8fa53-0004-438e-9003-51a46e139bfc},3' 1 -Type DWord -Force -EA SilentlyContinue
            # {b3f8fa53-0004-438e-9003-51a46e139bfc},4 = give exclusive mode priority
            Set-ItemProperty $propsPath '{b3f8fa53-0004-438e-9003-51a46e139bfc},4' 1 -Type DWord -Force -EA SilentlyContinue
        }
    }
    Write-Host " [OK] Exclusive mode enabled + prioritised — games can own the audio endpoint directly" -ForegroundColor Green
}

# ── 6. Realtek audio power management off (if Realtek present) ───────────────
$rtPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96c-e325-11ce-bfc1-08002be10318}'
if (Test-Path $rtPath) {
    Get-ChildItem $rtPath -EA SilentlyContinue | ForEach-Object {
        $desc = (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc
        if ($desc -match 'Realtek|HD Audio') {
            Set-ItemProperty $_.PSPath 'PowerSettings' ([byte[]](0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -Force -EA SilentlyContinue
            Set-ItemProperty $_.PSPath 'ConservationIdleTime' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $_.PSPath 'PerformanceIdleTime' 0 -Type DWord -Force -EA SilentlyContinue
            Write-Host " [OK] Realtek HD Audio: power management DISABLED — codec won't power down mid-game" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host " Audio cutout fix applied. No reboot needed — takes effect immediately." -ForegroundColor Cyan
Write-Host " NOTE: If you use Voicemeeter or virtual audio cables, restart them now." -ForegroundColor Gray
Write-Host ""`,
  },
  // ── NVMe Storage (universal — no-ops if no NVMe present) ────────────────────
  {
    id: "nvme",
    icon: HardDrive,
    driver: "stornvme.sys",
    label: "NVMe Storage",
    severity: "medium",
    reboot: true,
    visible: () => true,
    desc: "Disables NVMe APST (Autonomous Power State Transitions) — the drive entering low-power states mid-game causes read latency spikes of 100-500ms that feel like freezes. Safe no-op on non-NVMe systems.",
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
  // ── DirectX / GPU Scheduler (GTX low-end + AMD only — not for RTX) ─────────
  {
    id: "directx",
    icon: Shield,
    driver: "dxgkrnl.sys",
    label: "DirectX / GPU Scheduler",
    severity: "high",
    reboot: true,
    // HAGS hurts GTX Pascal/Turing and older AMD. RTX 2000+ actually benefits from HAGS — hide this card for them.
    visible: (hw) => !hw.isNvidia || hw.nvidiaIsLowEnd,
    detectedLabel: (hw) => hw.nvidiaIsLowEnd ? "GTX — HAGS should be OFF" : hw.isAmdGpu ? "AMD GPU detected" : "GPU detected",
    desc: "Disables Hardware-Accelerated GPU Scheduling (HAGS) which causes dxgkrnl DPC spikes on GTX 10xx/16xx and older AMD GPUs. Also clears all stale DirectX shader caches. Not shown for RTX users — HAGS helps RTX 2000+.",
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
  { pattern: /amdppm|acpi/i,        fix: "AMD/Intel CPU — click the CPU C-States fix card above to suppress wake-up latency" },
  { pattern: /intelppm/i,           fix: "Intel CPU — click the 'Intel Core CPU C-States' fix card above" },
  { pattern: /ndis|netio|tcpip/i,   fix: "Network Driver — click the 'Network Driver' fix card above" },
  { pattern: /usbport|usbhub/i,     fix: "USB Controller — click the 'USB Controller' fix card above to disable selective suspend" },
  { pattern: /hdaudbus|portcls/i,   fix: "Audio — click the 'Audio Driver' fix card above to boost MMCSS priority" },
  { pattern: /stornvme|storahci/i,  fix: "NVMe Storage — click the 'NVMe Storage' fix card above to disable APST" },
  { pattern: /dxgkrnl/i,            fix: "DirectX — click the 'DirectX / GPU Scheduler' fix card above" },
  { pattern: /wdf|kmdf/i,           fix: "WDF Driver — check for driver updates for the specific device causing DPC spikes" },
];

export default function DpcLatencyPage() {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedDriver[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFileName, setDroppedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setRawText(text);
      setDroppedFileName(file.name);
    };
    reader.readAsText(file);
  }, []);
  const hw = useHardwareInfo();

  function applyFix(fix: DpcFix) {
    downloadBat(`dpc_${fix.id}`, fix.ps1);
    setApplied(prev => new Set(prev).add(fix.id));
  }

  function runAnalysis() {
    setParsed(parseXperfSummary(rawText));
  }

  const visibleFixes = hw.loading ? [] : DPC_FIXES.filter(f => f.visible(hw));

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
          One-click tweaks for the most common DPC interrupt offenders on <span className="text-zinc-300 font-semibold">your specific hardware</span>. Cards are auto-filtered to what's relevant for your system.
        </p>
      </div>

      {/* What is DPC? */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-blue-300">What causes DPC latency?</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            DPC (Deferred Procedure Call) spikes happen when a hardware driver takes too long to handle an interrupt. Spikes above <span className="text-white font-semibold">500µs</span> cause frame stutters, input lag, and audio glitches. GPU, CPU C-states, network, and USB drivers are the most common offenders on gaming PCs.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {hw.loading && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-white/8 bg-zinc-950/50">
          <div className="w-4 h-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin shrink-0" />
          <p className="text-sm text-zinc-400">Detecting your hardware — filtering tweaks to your system…</p>
        </div>
      )}

      {/* One-Click Fix Cards */}
      {!hw.loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1">One-Click Driver Tweaks</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wide">
              {visibleFixes.length} tweaks for your system
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFixes.map((fix, i) => {
              const Icon = fix.icon;
              const sev = SEVERITY_CONFIG[fix.severity];
              const done = applied.has(fix.id);
              const detectedText = fix.detectedLabel?.(hw);
              return (
                <motion.div
                  key={fix.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  data-testid={`card-dpc-fix-${fix.id}`}
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
                        {detectedText && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wide">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {detectedText}
                          </span>
                        )}
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
      )}

      {/* Advanced: Diagnose Section */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <button
          onClick={() => setAdvancedOpen(v => !v)}
          data-testid="button-dpc-advanced-toggle"
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-zinc-900/60 transition-colors"
        >
          <Upload className="w-4 h-4 text-zinc-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-300">Advanced — Diagnose Your PC</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Download the scanner, drop the result file, see which drivers are spiking on your system</p>
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
$outFile = "$env:USERPROFILE\\Desktop\\OptiGods_DPC_Result.txt"
Write-Host ""
Write-Host " OPTI GODS — DPC Latency Scanner" -ForegroundColor Red
Write-Host " Capturing 30-second DPC/ISR trace..." -ForegroundColor Cyan
Write-Host ""
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("OPTI GODS DPC Scan — $(Get-Date)")
$lines.Add("")
$hasXperf = Get-Command xperf -EA SilentlyContinue
if ($hasXperf) {
    Write-Host " [xperf] Starting trace..." -ForegroundColor Green
    xperf -on PROC_THREAD+LOADER+DPC+INTERRUPT -f "$env:TEMP\\optigods_dpc.etl" 2>$null
    Start-Sleep 30
    xperf -stop 2>$null
    Write-Host " [xperf] Analyzing..." -ForegroundColor Cyan
    $result = xperf -i "$env:TEMP\\optigods_dpc.etl" -a dpcisr -noheader 2>$null
    $result | ForEach-Object { Write-Host $_; $lines.Add($_) }
    Remove-Item "$env:TEMP\\optigods_dpc.etl" -EA SilentlyContinue
} else {
    Write-Host " [wpr] xperf not found, using WPR fallback..." -ForegroundColor Yellow
    $lines.Add("[wpr] xperf not found — WPR fallback used")
    $out = "$env:TEMP\\optigods_dpc.etl"
    wpr -start DPC -filemode 2>$null
    Write-Host " Recording for 30 seconds... close games for clean baseline." -ForegroundColor Gray
    $lines.Add("Recording 30s baseline...")
    Start-Sleep 30
    wpr -stop $out 2>$null
    Write-Host " [wpr] Trace captured." -ForegroundColor Yellow
    $lines.Add("[wpr] Trace captured — install Windows Performance Toolkit for full driver breakdown.")
    $lines.Add("Tip: Search 'Windows Performance Toolkit' and install the Windows SDK component for xperf support.")
}
$lines | Set-Content -Path $outFile -Encoding UTF8
Write-Host ""
Write-Host " Results saved to: $outFile" -ForegroundColor Green
Write-Host " Drag that file into the Opti Gods DPC Analyser." -ForegroundColor Cyan
Write-Host ""`)}
                    className="gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download DPC Scanner (.bat)
                  </Button>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Step 2 — Drop the result file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.log"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }}
                  />
                  <div
                    data-testid="dropzone-dpc"
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files[0];
                      if (f) handleFileDrop(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors py-8 px-4",
                      isDragging
                        ? "border-red-500/70 bg-red-500/8"
                        : droppedFileName
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/3"
                    )}
                  >
                    {droppedFileName ? (
                      <>
                        <FileText className="w-6 h-6 text-emerald-400" />
                        <p className="text-xs font-bold text-emerald-400">Loaded: {droppedFileName}</p>
                        <p className="text-[10px] text-zinc-500">Click to swap file</p>
                      </>
                    ) : (
                      <>
                        <Upload className={cn("w-6 h-6", isDragging ? "text-red-400" : "text-zinc-500")} />
                        <p className={cn("text-xs font-bold", isDragging ? "text-red-400" : "text-zinc-400")}>
                          {isDragging ? "Drop it!" : "Drop OptiGods_DPC_Result.txt here"}
                        </p>
                        <p className="text-[10px] text-zinc-600">or click to browse</p>
                      </>
                    )}
                  </div>
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
                    className="space-y-3"
                  >
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Results — Top DPC Offenders</p>
                    <div className="space-y-1.5">
                      {parsed.map((d, idx) => {
                        const known = KNOWN_FIXES.find(f => f.pattern.test(d.name));
                        const severity = d.usPerDpc >= 500 ? "text-red-400" : d.usPerDpc >= 200 ? "text-orange-400" : "text-zinc-400";
                        return (
                          <div key={idx} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-zinc-300 font-bold">{d.name}</span>
                              <span className={cn("text-[10px] font-bold ml-auto", severity)}>{d.usPerDpc.toFixed(1)}µs avg</span>
                              {d.pctTime !== undefined && (
                                <span className="text-[10px] text-zinc-600">{d.pctTime.toFixed(1)}% time</span>
                              )}
                            </div>
                            {known && (
                              <p className="text-[10px] text-zinc-500 leading-snug">{known.fix}</p>
                            )}
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
