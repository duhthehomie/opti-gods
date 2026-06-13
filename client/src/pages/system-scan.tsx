import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { scanHardware, isNative, onFileDrop, readTauriTextFile } from "@/lib/tauri-bridge";
import type { NativeHardwareScan } from "@/lib/tauri-bridge";
import {
  Cpu, MonitorPlay, MemoryStick, HardDrive, Activity, Sparkles,
  Loader2, Wifi, Thermometer, Monitor, Wind, RefreshCw,
  AlertTriangle, CheckCircle2, Zap, ScanLine, ChevronRight,
  Download, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
// ── HW Monitor import data shape ─────────────────────────────────────────────
interface HwMonitorData {
  gpu_temp_c?: number | null;
  gpu_load_pct?: number | null;
  gpu_fan_pct?: number | null;
  gpu_name?: string;
  gpu_vram_used_mb?: number;
  gpu_vram_total_mb?: number;
  cpu_temp_c?: number | null;
  cpu_load_pct?: number | null;
  cpu_name?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  cpu_mhz?: number;
  ram_total_gb?: number;
  ram_free_gb?: number;
  ram_used_pct?: number;
  disks?: Array<{ drive: string; free_gb: number; size_gb: number; used_pct: number }>;
  fans?: Array<{ name: string; speed_pct?: number | null; speed_rpm?: number | null }>;
  fan_count?: number;
  timestamp?: string;
  cpu_temp_note?: string;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function Stat({
  icon: Icon, label, value, sub, highlight, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string;
  highlight?: boolean; accent?: "red" | "amber" | "green" | "blue";
}) {
  const colors = {
    red:   "border-red-500/20 bg-red-500/[0.03] text-red-400",
    amber: "border-amber-500/20 bg-amber-500/[0.03] text-amber-400",
    green: "border-green-500/20 bg-green-500/[0.03] text-green-400",
    blue:  "border-blue-500/20 bg-blue-500/[0.03] text-blue-400",
  };
  const chosen = accent ? colors[accent] : (highlight ? colors.red : "border-white/5");
  return (
    <div
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={cn("p-4 rounded-xl border bg-zinc-950/40", chosen)}
    >
      <div className={cn("flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider mb-2",
        accent ? colors[accent].split(" ")[2] : (highlight ? "text-red-400" : "text-zinc-500")
      )}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-white font-mono text-sm font-semibold truncate">{value}</p>
      {sub && <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ── Missing-data row ─────────────────────────────────────────────────────────
function MissingRow({ label, gain }: { label: string; gain: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-zinc-300 font-medium">{label}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{gain}</p>
      </div>
    </div>
  );
}

// ── Fan display helper ────────────────────────────────────────────────────────
function fanLabel(scan: NativeHardwareScan): { label: string; sub?: string } {
  if (scan.fan_count && scan.fan_count > 0) {
    const chassis = (scan.chassis || "").toLowerCase();
    const isLaptop = chassis === "laptop" || chassis === "notebook";
    return {
      label: `${scan.fan_count} Fan${scan.fan_count === 1 ? "" : "s"}`,
      sub: isLaptop ? "Laptop cooling" : "Air cooled",
    };
  }
  const chassis = (scan.chassis || "").toLowerCase();
  if (chassis === "laptop" || chassis === "notebook") {
    return { label: "Stock (Laptop)", sub: "Integrated heat-pipe" };
  }
  return { label: "Air Cooled", sub: "Fan count not exposed via WMI" };
}

// ── Temp badge ───────────────────────────────────────────────────────────────
function tempAccent(c: number): "green" | "amber" | "red" {
  if (c < 60) return "green";
  if (c < 80) return "amber";
  return "red";
}

// ── Not-detected CTA (web / no scan) ─────────────────────────────────────────
function NotDetectedPanel({ onScan, scanning }: { onScan: () => void; scanning: boolean }) {
  const hw = useHardwareInfo();
  const os = useOsDetection();

  const gpuKnown = hw.gpuName && hw.gpuName !== "Unknown GPU" && hw.gpuName !== "Detecting...";
  const cpuKnown = hw.cpuCores > 0;
  const ramKnown = hw.ramGB > 0;

  const missing: { label: string; gain: string }[] = [];
  if (!gpuKnown)
    missing.push({ label: "GPU not detected", gain: "Exact model, VRAM, and vendor — needed to select NVIDIA/AMD-specific tweaks" });
  if (!cpuKnown)
    missing.push({ label: "CPU not detected", gain: "Core/thread count and brand for scheduler + priority tweaks" });
  if (!ramKnown)
    missing.push({ label: "RAM amount unknown", gain: "Exact GB and MHz — used to set pagefile size and memory compression" });
  missing.push({ label: "Motherboard unknown", gain: "Needed for chipset-specific network and PCIe tweaks" });
  missing.push({ label: "Fan count / cooling unknown", gain: "Shows real fan count and live CPU temperature" });
  missing.push({ label: "Anti-cheat scan not run", gain: "Detects Vanguard / EAC / BattlEye — hides incompatible tweaks automatically" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* CTA hero */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
            <ScanLine className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white mb-1">
              System not fully detected
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Opti Gods detected your hardware partially via browser APIs. Run the
              native deep scan to get exact specs, live CPU temperature, fan count,
              anti-cheat detection and personalised tweak matching.
            </p>
            <Button
              data-testid="button-instant-scan"
              onClick={onScan}
              disabled={scanning}
              className="bg-red-600 hover:bg-red-500 text-white font-bold gap-2 h-10"
            >
              {scanning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
              ) : (
                <><Zap className="w-4 h-4" /> Instant Scan</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* What we do know */}
      {(gpuKnown || cpuKnown || ramKnown) && (
        <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
            Partially detected
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {gpuKnown && (
              <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName} highlight />
            )}
            {cpuKnown && (
              <Stat icon={Cpu} label="CPU" value={hw.cpuLabel}
                sub={`${hw.cpuCores} threads detected`} highlight />
            )}
            {ramKnown && (
              <Stat icon={MemoryStick} label="RAM"
                value={hw.ramLabel}
                sub="Approx — browser-limited" />
            )}
            <Stat icon={HardDrive} label="OS"
              value={os.os || "Detecting…"}
              sub={os.build ? `Build ${os.build}` : undefined} />
          </div>
        </div>
      )}

      {/* What's missing */}
      <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
          What a full scan unlocks
        </p>
        <p className="text-[11px] text-zinc-600 mb-3">
          Data that requires native OS access — not available in browser mode
        </p>
        {missing.map((m, i) => (
          <MissingRow key={i} label={m.label} gain={m.gain} />
        ))}
      </div>

      {/* Opti Gods benefit pill row */}
      <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-3">
          What Opti Gods gives you after scan
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "Exact GPU tweak set", "CPU scheduler tuning", "RAM speed tweaks",
            "Live CPU temp", "Fan count", "Anti-cheat safe mode",
            "Motherboard NIC tweaks", "Chassis-aware preset",
          ].map(b => (
            <span key={b} className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-500/8 border border-red-500/15 text-red-300">
              <CheckCircle2 className="w-2.5 h-2.5 text-red-400" />
              {b}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Full native scan results ──────────────────────────────────────────────────
function NativeScanResults({ scan, onRescan, rescanning }: {
  scan: NativeHardwareScan;
  onRescan: () => void;
  rescanning: boolean;
}) {
  const os = useOsDetection();
  const fan = fanLabel(scan);
  const isLaptop = (scan.chassis || "").toLowerCase() === "laptop";

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        <Stat icon={MonitorPlay} label="GPU" value={scan.gpu || "Unknown"}
          sub={scan.vram_mb ? `${Math.round(scan.vram_mb / 1024)} GB VRAM` : undefined} highlight />
        <Stat icon={Cpu} label="CPU" value={scan.cpu || "Unknown"} highlight />
        <Stat icon={MemoryStick} label="RAM"
          value={scan.ram_gb ? `${scan.ram_gb} GB` : "Unknown"}
          sub={scan.ram_mhz ? `${scan.ram_mhz} MHz` : undefined} highlight />
        <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"}
          sub={os.build ? `Build ${os.build}` : undefined} />
        <Stat icon={Sparkles} label="Form Factor"
          value={isLaptop ? "Laptop" : "Desktop"}
          sub={scan.chassis || undefined} />

        {/* Cooling — real fan count when WMI exposes it */}
        <Stat icon={Wind} label="Cooling" value={fan.label} sub={fan.sub} />

        {/* CPU Temperature — live from MSAcpi_ThermalZoneTemperature */}
        {scan.cpu_temp_c != null && (
          <Stat
            icon={Thermometer}
            label="CPU Temp"
            value={`${Math.round(scan.cpu_temp_c)}°C`}
            sub={
              scan.cpu_temp_c < 60 ? "Cool — normal idle"
              : scan.cpu_temp_c < 80 ? "Warm — under load"
              : "Hot — check cooling"
            }
            accent={tempAccent(scan.cpu_temp_c)}
          />
        )}

        {scan.motherboard && (
          <Stat icon={Monitor} label="Motherboard" value={scan.motherboard} />
        )}
        {scan.refresh_hz && (
          <Stat icon={Monitor} label="Refresh Rate" value={`${scan.refresh_hz} Hz`} />
        )}
        {scan.nic_vendor && (
          <Stat icon={Wifi} label="Network" value={scan.nic_vendor} />
        )}
      </div>

      {/* Anti-cheat */}
      {scan.anticheats && scan.anticheats.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 mb-2">
            Anti-Cheat Detected
          </div>
          <div className="flex flex-wrap gap-2">
            {scan.anticheats.map(ac => (
              <span key={ac}
                className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 font-mono">
                {ac}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* What temp data covers */}
      {scan.cpu_temp_c == null && (
        <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-4 py-3 flex items-center gap-3">
          <Thermometer className="w-4 h-4 text-zinc-600 shrink-0" />
          <p className="text-[11px] text-zinc-500">
            CPU temperature not available — MSAcpi_ThermalZoneTemperature not exposed by this system's ACPI firmware.
            Use HWiNFO64 or HWMONITOR for sensor-level temps.
          </p>
        </div>
      )}

      {/* Re-scan button */}
      <div className="flex justify-end">
        <button
          data-testid="button-rescan"
          onClick={onRescan}
          disabled={rescanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/60 border border-white/8 hover:bg-zinc-700/60 hover:border-white/15 transition-colors text-zinc-300 text-[11px] font-semibold disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", rescanning && "animate-spin")} />
          {rescanning ? "Scanning…" : "Re-scan hardware"}
        </button>
      </div>
    </div>
  );
}

// ── HW Monitor Panel ─────────────────────────────────────────────────────────
function HwMonitorPanel() {
  const [hw, setHw] = useState<HwMonitorData | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseJson = (text: string) => {
    setParseError(null);
    try {
      const data = JSON.parse(text) as HwMonitorData;
      if (!data.timestamp && !data.cpu_name && !data.gpu_name) throw new Error("Not a valid HW Monitor file");
      setHw(data);
    } catch {
      setParseError("Invalid file — drop the OptiGods-HW-Monitor.json produced by the BAT script.");
    }
  };

  const parseFile = (file: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => parseJson(e.target?.result as string);
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    // In Tauri v2 the OS file-drop is intercepted before DOM events fire.
    // The useEffect below handles native drops; this branch covers web mode.
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) parseFile(file);
    else setParseError("Drop a .json file (OptiGods-HW-Monitor.json).");
  };

  // In Tauri v2, OS-level drag-drop doesn't fire DOM events — Tauri delivers
  // a `tauri://drag-drop` event with the file path(s) instead.
  useEffect(() => {
    if (!isNative()) return;
    let unlisten: (() => Promise<void>) | null = null;
    onFileDrop(async (paths) => {
      setDragging(false);
      const jsonPath = paths.find(p => p.toLowerCase().endsWith(".json"));
      if (!jsonPath) {
        setParseError("Drop a .json file (OptiGods-HW-Monitor.json).");
        return;
      }
      try {
        const text = await readTauriTextFile(jsonPath);
        parseJson(text);
      } catch (e: unknown) {
        setParseError(`Could not read file: ${e instanceof Error ? e.message : String(e)}`);
      }
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generated entirely client-side — no server fetch, works in the .exe
  // (apiUrl resolves to optigods.com in Tauri which would return HTML).
  const downloadBat = () => {
    // PS1 embedded in the BAT via self-extraction. No admin rights needed.
    // NOTE: avoid ${...} in the PS1 string — JS template literal would eat it.
    // PS1 uses ($var + '...') concatenation wherever ${} would normally appear.
    const ps1Lines = [
      `$ErrorActionPreference = 'SilentlyContinue'`,
      ``,
      `Write-Host ""`,
      `Write-Host "  ================================================" -ForegroundColor Red`,
      `Write-Host "    OPTI GODS by leaq  --  Hardware Monitor" -ForegroundColor White`,
      `Write-Host "  ================================================" -ForegroundColor Red`,
      `Write-Host ""`,
      `Write-Host "  Collecting sensor data..." -ForegroundColor DarkGray`,
      `Write-Host ""`,
      ``,
      `$result = [ordered]@{}`,
      ``,
      `# GPU via nvidia-smi`,
      `$smiExe = $null`,
      `$smiCmd = Get-Command "nvidia-smi.exe" -EA SilentlyContinue`,
      `if ($smiCmd) { $smiExe = $smiCmd.Source }`,
      `else {`,
      `    @("$env:SystemRoot\\System32\\nvidia-smi.exe",`,
      `      "C:\\Windows\\System32\\nvidia-smi.exe",`,
      `      "$env:ProgramFiles\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe") | ForEach-Object {`,
      `        if (!$smiExe -and (Test-Path $_)) { $smiExe = $_ }`,
      `    }`,
      `}`,
      `if ($smiExe) {`,
      `    $raw = (& $smiExe --query-gpu=temperature.gpu --format=csv,noheader 2>$null).Trim()`,
      `    if ($raw -match '^\\d+$') { $result.gpu_temp_c = [int]$raw }`,
      `    $raw = (& $smiExe --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null).Trim()`,
      `    if ($raw -match '^\\d+$') { $result.gpu_load_pct = [int]$raw }`,
      `    $raw = (& $smiExe --query-gpu=name --format=csv,noheader 2>$null).Trim()`,
      `    if ($raw) { $result.gpu_name = $raw }`,
      `    $mu = (& $smiExe --query-gpu=memory.used  --format=csv,noheader,nounits 2>$null).Trim()`,
      `    $mt = (& $smiExe --query-gpu=memory.total --format=csv,noheader,nounits 2>$null).Trim()`,
      `    if ($mu -match '^\\d+$' -and $mt -match '^\\d+$') {`,
      `        $result.gpu_vram_used_mb  = [int]$mu`,
      `        $result.gpu_vram_total_mb = [int]$mt`,
      `    }`,
      `    $raw = (& $smiExe --query-gpu=fan.speed --format=csv,noheader,nounits 2>$null).Trim()`,
      `    if ($raw -match '^\\d+$') { $result.gpu_fan_pct = [int]$raw }`,
      `} else {`,
      `    $result.gpu_name = "NVIDIA GPU (nvidia-smi.exe not found)"`,
      `}`,
      ``,
      `# CPU Temperature (3 fallbacks)`,
      `$cpuTemp = $null`,
      `try {`,
      `    $zones = Get-WmiObject -Namespace "root\\wmi" -Class MSAcpi_ThermalZoneTemperature -EA SilentlyContinue`,
      `    if ($zones) {`,
      `        $temps = $zones | ForEach-Object { [math]::Round($_.CurrentTemperature/10.0-273.15,1) } | Where-Object { $_ -gt 5 -and $_ -lt 120 }`,
      `        if ($temps) { $cpuTemp = ($temps | Measure-Object -Maximum).Maximum }`,
      `    }`,
      `} catch {}`,
      `if (-not $cpuTemp) {`,
      `    try {`,
      `        $s = (Get-Counter '\\Thermal Zone Information(*)\\High Precision Temperature' -SampleInterval 1 -MaxSamples 1 -EA SilentlyContinue).CounterSamples | Where-Object { $_.CookedValue -gt 2731 }`,
      `        if ($s) { $k=($s|Measure-Object -Property CookedValue -Maximum).Maximum; $c=[math]::Round($k/10.0-273.15,1); if($c-gt 5 -and $c-lt 120){$cpuTemp=$c} }`,
      `    } catch {}`,
      `}`,
      `if (-not $cpuTemp) {`,
      `    try {`,
      `        $ohm = Get-WmiObject -Namespace "root\\OpenHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -match "CPU Package|CPU Core|Tdie|CPU CCD" }`,
      `        if ($ohm) { $v=($ohm|Measure-Object -Property Value -Maximum).Maximum; if($v-gt 5 -and $v-lt 120){$cpuTemp=[math]::Round($v,1)} }`,
      `    } catch {}`,
      `}`,
      `$result.cpu_temp_c = $cpuTemp`,
      `$result.cpu_temp_note = if ($cpuTemp) { "OK" } else { "AMD Ryzen desktop — use HWiNFO64 for accurate readings." }`,
      ``,
      `# CPU Info & Load`,
      `try {`,
      `    $cpu = Get-CimInstance Win32_Processor -EA SilentlyContinue | Select-Object -First 1`,
      `    if ($cpu) { $result.cpu_name=$cpu.Name.Trim(); $result.cpu_cores=$cpu.NumberOfCores; $result.cpu_threads=$cpu.NumberOfLogicalProcessors; $result.cpu_mhz=$cpu.MaxClockSpeed }`,
      `} catch {}`,
      `try {`,
      `    $ld = (Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1 -EA SilentlyContinue).CounterSamples[0].CookedValue`,
      `    if ($null -ne $ld) { $result.cpu_load_pct = [math]::Round($ld,1) }`,
      `} catch {}`,
      ``,
      `# RAM`,
      `try {`,
      `    $os2 = Get-CimInstance Win32_OperatingSystem -EA SilentlyContinue`,
      `    if ($os2) {`,
      `        $result.ram_total_gb = [math]::Round($os2.TotalVisibleMemorySize/1MB,1)`,
      `        $result.ram_free_gb  = [math]::Round($os2.FreePhysicalMemory/1MB,1)`,
      `        $result.ram_used_pct = [math]::Round(100*(1-$os2.FreePhysicalMemory/$os2.TotalVisibleMemorySize),1)`,
      `    }`,
      `} catch {}`,
      ``,
      `# Disks`,
      `try {`,
      `    $result.disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -EA SilentlyContinue | Select-Object -First 4 | ForEach-Object {`,
      `        [ordered]@{ drive=$_.DeviceID; free_gb=[math]::Round($_.FreeSpace/1GB,1); size_gb=[math]::Round($_.Size/1GB,1); used_pct=[math]::Round(100*(1-$_.FreeSpace/$_.Size),1) }`,
      `    })`,
      `} catch {}`,
      ``,
      `# Fans`,
      `$fanList = [System.Collections.Generic.List[object]]::new()`,
      `if ($null -ne $result.gpu_fan_pct) { $fanList.Add([ordered]@{ name="GPU Fan"; speed_pct=$result.gpu_fan_pct; speed_rpm=$null }) }`,
      `$ohmDone = $false`,
      `try {`,
      `    $ohmF = Get-WmiObject -Namespace "root\\OpenHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Fan" }`,
      `    if ($ohmF) { foreach($s in @($ohmF)){$fanList.Add([ordered]@{name=$s.Name;speed_pct=$null;speed_rpm=[math]::Round($s.Value)})}; $ohmDone=$true }`,
      `} catch {}`,
      `if (-not $ohmDone) {`,
      `    try {`,
      `        $wf=@(Get-WmiObject Win32_Fan -EA SilentlyContinue); $pf=@(Get-WmiObject Win32_PnPEntity -Filter "PNPClass='Fan'" -EA SilentlyContinue)`,
      `        $seen=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)`,
      `        foreach($f in ($wf+$pf)){$n=if($f.Name){$f.Name}else{"Fan"}; if($seen.Add($n)){$rpm=if($f.PSObject.Properties['DesiredSpeed']-and $f.DesiredSpeed-gt 0){[int]$f.DesiredSpeed}else{$null}; $fanList.Add([ordered]@{name=$n;speed_pct=$null;speed_rpm=$rpm})}}`,
      `    } catch {}`,
      `}`,
      `if ($fanList.Count -gt 0) { $result.fans = $fanList.ToArray() }`,
      `$result.fan_count = $fanList.Count`,
      `$result.timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"`,
      ``,
      `# Desktop path — robust chain (works with OneDrive redirect, works non-elevated)`,
      `$desktop = $null`,
      `try {`,
      `    $rv = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -EA SilentlyContinue).Desktop`,
      `    if ($rv) { $desktop = [Environment]::ExpandEnvironmentVariables($rv) }`,
      `} catch {}`,
      `if (-not $desktop -or -not (Test-Path $desktop -PathType Container)) {`,
      `    try { $desktop = [Environment]::GetFolderPath('Desktop') } catch {}`,
      `}`,
      `if (-not $desktop -or -not (Test-Path $desktop -PathType Container)) {`,
      `    $desktop = Join-Path $env:USERPROFILE 'Desktop'`,
      `}`,
      ``,
      `# Collision-safe filename`,
      `$baseName = 'OptiGods-HW-Monitor'`,
      `$outPath  = Join-Path $desktop ($baseName + '.json')`,
      `$n = 2`,
      `while (Test-Path $outPath) { $outPath = Join-Path $desktop ($baseName + '_' + $n + '.json'); $n++ }`,
      ``,
      `# Write JSON`,
      `$json = $result | ConvertTo-Json -Depth 5`,
      `[IO.File]::WriteAllText($outPath, $json, [Text.Encoding]::UTF8)`,
      `$fname = Split-Path $outPath -Leaf`,
      ``,
      `# Results`,
      `Write-Host "  GPU       : $(if ($result.gpu_name) { $result.gpu_name } else { 'N/A' })" -ForegroundColor White`,
      `Write-Host "  GPU Temp  : $(if ($null -ne $result.gpu_temp_c) { [string]$result.gpu_temp_c + ' C' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  GPU Fan   : $(if ($null -ne $result.gpu_fan_pct) { [string]$result.gpu_fan_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  CPU Temp  : $(if ($cpuTemp) { [string]$cpuTemp + ' C' } else { 'N/A  (AMD Ryzen desktop)' })" -ForegroundColor Cyan`,
      `Write-Host "  CPU Load  : $(if ($null -ne $result.cpu_load_pct) { [string]$result.cpu_load_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  RAM Used  : $(if ($null -ne $result.ram_used_pct) { [string]$result.ram_used_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host "  Fans      : $(if ($result.fan_count -gt 0) { [string]$result.fan_count + ' detected' } else { 'N/A' })" -ForegroundColor Cyan`,
      `Write-Host ""`,
      `Write-Host "  ================================================" -ForegroundColor DarkGray`,
      `Write-Host "  $fname has been placed on your Desktop." -ForegroundColor Green`,
      `Write-Host "  Drag it onto the Opti Gods System Scan tab to import." -ForegroundColor Yellow`,
      `Write-Host "  ================================================" -ForegroundColor DarkGray`,
      `Write-Host ""`,
      `Read-Host "  Press Enter to close"`,
    ];

    const ps1 = ps1Lines.join('\r\n');
    const marker = '##HW_MONITOR_PS1_START##';
    // Marker is split in the PS command so the BAT doesn't match itself during extraction
    const markerSearchPs = `'##HW_MONITOR_P'+'S1_START##'`;

    const batLines = [
      `@echo off`,
      `setlocal`,
      `set "SELF=%~f0"`,
      `set "TMPPS1=%TEMP%\\OptiGods-HW-Monitor.ps1"`,
      ``,
      `title Opti Gods by leaq  --  Hardware Monitor`,
      ``,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m=${markerSearchPs};$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"`,
      ``,
      `if not exist "%TMPPS1%" (`,
      `  echo  [ERROR] Extraction failed. Re-download the BAT from the app.`,
      `  pause`,
      `  exit /b 1`,
      `)`,
      ``,
      `PowerShell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%"`,
      `del "%TMPPS1%" 2>nul`,
      `exit /b 0`,
      marker,
      ps1,
    ];

    const content = batLines.join('\r\n');
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OptiGods-HW-Monitor.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const tempColor = (c: number) => c < 60 ? "text-emerald-400" : c < 80 ? "text-amber-400" : "text-red-400";
  const usedColor = (pct: number) => pct < 60 ? "text-emerald-400" : pct < 80 ? "text-amber-400" : "text-red-400";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-white">Live Sensor Monitor</span>
          <span className="text-[10px] text-zinc-600">CPU + GPU temps via BAT script</span>
        </div>
        <div className="flex items-center gap-2">
          {hw && (
            <button onClick={() => setHw(null)} className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            data-testid="button-download-hw-monitor"
            onClick={downloadBat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 border border-red-500/60 text-white text-[10px] font-bold uppercase tracking-wider transition-colors">
            <Download className="w-3 h-3" /> Download BAT
          </button>
        </div>
      </div>

      {!hw ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "m-3 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-all",
            dragging ? "border-red-500/60 bg-red-500/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          )}>
          <input ref={fileRef} type="file" accept=".json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          <Upload className="w-5 h-5 text-zinc-600" />
          <p className="text-[11px] text-zinc-500 text-center px-6">
            Drag <span className="font-mono text-zinc-400">OptiGods-HW-Monitor.json</span> here (saved to Desktop)
          </p>
          {parseError && <p className="text-[10px] text-red-400">{parseError}</p>}
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {hw.timestamp && (
            <p className="text-[10px] text-zinc-600">Snapshot: {hw.timestamp}</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {hw.gpu_name && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><MonitorPlay className="w-3 h-3" /> GPU</p>
                <p className="text-white font-mono text-xs font-semibold truncate">{hw.gpu_name}</p>
                {hw.gpu_vram_total_mb && <p className="text-zinc-500 text-[10px]">{Math.round(hw.gpu_vram_total_mb / 1024)} GB VRAM</p>}
              </div>
            )}
            {hw.gpu_temp_c != null && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Thermometer className="w-3 h-3" /> GPU Temp</p>
                <p className={cn("font-mono text-lg font-black", tempColor(hw.gpu_temp_c))}>{hw.gpu_temp_c}°C</p>
                {hw.gpu_load_pct != null && <p className="text-zinc-500 text-[10px]">{hw.gpu_load_pct}% load</p>}
              </div>
            )}
            {hw.gpu_fan_pct != null && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Wind className="w-3 h-3" /> GPU Fan</p>
                <p className="font-mono text-lg font-black text-white">{hw.gpu_fan_pct}%</p>
              </div>
            )}
            {hw.cpu_temp_c != null ? (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Temp</p>
                <p className={cn("font-mono text-lg font-black", tempColor(hw.cpu_temp_c))}>{hw.cpu_temp_c}°C</p>
                {hw.cpu_load_pct != null && <p className="text-zinc-500 text-[10px]">{hw.cpu_load_pct}% load</p>}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-amber-500/10 bg-amber-500/[0.03]">
                <p className="text-[10px] uppercase tracking-wider text-amber-500/70 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Temp</p>
                <p className="text-amber-400 font-mono text-xs font-bold">N/A</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">AMD Ryzen desktop — ACPI not exposed. Use HWiNFO64.</p>
              </div>
            )}
            {hw.ram_used_pct != null && (
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> RAM</p>
                <p className={cn("font-mono text-lg font-black", usedColor(hw.ram_used_pct))}>{hw.ram_used_pct}%</p>
                {hw.ram_total_gb && hw.ram_free_gb != null && (
                  <p className="text-zinc-500 text-[10px]">{hw.ram_free_gb} GB free / {hw.ram_total_gb} GB</p>
                )}
              </div>
            )}
          </div>
          {hw.fans && hw.fans.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {hw.fans.map((f, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                    <Wind className="w-3 h-3" /> Fan {i + 1}
                  </p>
                  <p className="text-white font-mono text-xs font-semibold truncate">{f.name}</p>
                  {f.speed_rpm != null && f.speed_rpm > 0
                    ? <p className="text-zinc-500 text-[10px]">{f.speed_rpm} RPM</p>
                    : f.speed_pct != null
                      ? <p className="text-zinc-500 text-[10px]">{f.speed_pct}%</p>
                      : null}
                </div>
              ))}
            </div>
          )}
          {hw.disks && hw.disks.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {hw.disks.map(d => (
                <div key={d.drive} className="p-3 rounded-lg border border-white/5 bg-zinc-950/40">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><HardDrive className="w-3 h-3" /> {d.drive}</p>
                  <p className={cn("font-mono text-base font-black", usedColor(d.used_pct))}>{d.used_pct}%</p>
                  <p className="text-zinc-500 text-[10px]">{d.free_gb} GB free / {d.size_gb} GB</p>
                </div>
              ))}
            </div>
          )}
          {hw.cpu_temp_note && hw.cpu_temp_c == null && (
            <p className="text-[10px] text-zinc-600 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500/60 shrink-0 mt-0.5" />
              {hw.cpu_temp_note}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SystemScanPage() {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const [nativeScan, setNativeScan] = useState<NativeHardwareScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const native = isNative();

  const runScan = useCallback(() => {
    setScanning(true);
    setScanError(null);
    scanHardware()
      .then(data => { setNativeScan(data); setScanError(null); })
      .catch(err => { setScanError(String(err)); })
      .finally(() => setScanning(false));
  }, []);

  useEffect(() => {
    if (native) runScan();
  }, [native, runScan]);

  const loading = native ? (scanning && !nativeScan) : hw.loading;

  // Is the system "not detected"? True when web mode with no scanned localStorage data
  const notDetected = !native && !hw.scanned && !hw.gpuName.includes(" ");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Activity className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">System Scan</h1>
            {native && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                Native — Deep Scan
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {native
              ? "Direct WMI hardware scan — exact specs, fan count, live CPU temperature, and anti-cheat detection."
              : "Browser-level hardware detection. Run a native scan for full accuracy including temps and fan count."}
          </p>
        </header>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {native ? "Running deep hardware scan…" : "Scanning hardware…"}
          </div>
        )}

        {/* Native success */}
        {!loading && native && nativeScan && (
          <NativeScanResults
            scan={nativeScan}
            onRescan={runScan}
            rescanning={scanning}
          />
        )}

        {/* Native error */}
        {!loading && native && scanError && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-400 flex items-center justify-between gap-4">
              <span>Scan failed: {scanError}</span>
              <button
                onClick={runScan}
                disabled={scanning}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
                Retry
              </button>
            </div>
            {/* Fallback browser stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"} />
              <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"} />
              <Stat icon={MemoryStick} label="RAM" value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"} />
              <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"} sub={os.build ? `Build ${os.build}` : undefined} />
              <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
            </div>
          </div>
        )}

        {/* Web — not detected, show CTA */}
        {!loading && !native && notDetected && (
          <NotDetectedPanel onScan={() => {}} scanning={false} />
        )}

        {/* Web — partial/full browser detection */}
        {!loading && !native && !notDetected && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"}
                sub={[hw.isNvidia && "NVIDIA", hw.isAmd && "AMD", hw.isIntel && "Intel"].filter(Boolean).join(" · ") || undefined} />
              <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"}
                sub={hw.cpuCores ? `${hw.cpuCores} threads` : undefined} />
              <Stat icon={MemoryStick} label="RAM" value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"} />
              <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"}
                sub={os.build ? `Build ${os.build}` : undefined} />
              <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
            </div>

            {/* Unlock deeper scan hint */}
            <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wind className="w-4 h-4 text-zinc-600 shrink-0" />
                <p className="text-[11px] text-zinc-500">
                  Fan count and CPU temperature require the native Opti Gods app (deep WMI scan).
                </p>
              </div>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
              >
                Get the app <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* HW Monitor — always visible, lets any user import sensor data */}
        {!loading && <HwMonitorPanel />}
      </div>
    </AppLayout>
  );
}
