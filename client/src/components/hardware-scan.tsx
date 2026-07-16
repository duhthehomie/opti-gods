import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/api-base";
import { Cpu, CheckCircle2, X, Copy, Check, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveScannedInfo, clearScannedInfo, type ScannedSysInfo } from "@/hooks/use-hardware-info";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/lib/pro-status";
import { isNative, scanHardware } from "@/lib/tauri-bridge";

function detectGpuVendor(gpuName: string): "nvidia" | "amd" | "intel" {
  const n = (gpuName || "").toLowerCase();
  if (n.includes("nvidia") || n.includes("geforce") || n.includes("rtx") || n.includes("gtx") || n.includes("quadro")) return "nvidia";
  if (n.includes("amd") || n.includes("radeon") || n.includes("rx ") || n.includes("vega") || n.includes("rdna")) return "amd";
  return "intel";
}

function uploadHardwareToServer(parsed: ScannedSysInfo) {
  // Always upload — Pro users get linked to their code, others stored by IP.
  const token = getStoredToken();
  const gpuVendor = detectGpuVendor(parsed.GPU || "");
  // Only derive from scan when OsBuild is present (PS1 scan).
  // Native scan (Tauri WMI path) doesn't populate OsBuild yet — keep
  // the pre-existing "win11" fallback so native users aren't regressed.
  const osVersion = parsed.OsBuild
    ? (parsed.OsBuild >= 22000 ? "win11" : "win10")
    : "win11";
  fetch(apiUrl("/api/session/hardware"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: token || undefined,
      gpuVendor,
      gpuName: parsed.GPU || "",
      cpuModel: parsed.CPU || "",
      cpuCores: parsed.Cores || undefined,
      cpuThreads: parsed.Threads || undefined,
      ramGb: parsed.RAM_GB || 16,
      osVersion,
      isLaptop: false,
    }),
  }).catch(() => {});
}

export const PS1_CMD = `$gpu=(Get-WmiObject Win32_VideoController|Where-Object{$_.AdapterRAM -gt 0}|Sort-Object AdapterRAM -Desc|Select-Object -First 1).Name; if(!$gpu){$gpu=(Get-WmiObject Win32_VideoController|Select-Object -First 1).Name}; $cpu=Get-WmiObject Win32_Processor|Select-Object -First 1; $cs=Get-WmiObject Win32_ComputerSystem; $ram=[Math]::Round($cs.TotalPhysicalMemory/1GB,0); $mfr=$cs.Manufacturer.Trim();$mdl=$cs.Model.Trim();$sysModel=if($mdl -like "$mfr *" -or $mdl -eq $mfr){$mdl}else{"$mfr $mdl".Trim()}; $ramMhz=[int](((Get-WmiObject Win32_PhysicalMemory -EA SilentlyContinue) | ForEach-Object { [Math]::Max([int]$_.ConfiguredClockSpeed,[int]$_.Speed) }) | Measure-Object -Maximum).Maximum; $os=Get-WmiObject Win32_OperatingSystem; $osBuild=[int]$os.BuildNumber; $osName=$os.Caption.Trim(); $dir=if(Test-Path "$env:USERPROFILE\\Desktop"){"$env:USERPROFILE\\Desktop"}else{"$env:TEMP"}; $base=$dir+"\\OptiGods-HW-Scan"; $path=$base+".json"; $n=2; while(Test-Path $path){$path=$base+"_"+$n+".json";$n++}; @{GPU=$gpu;CPU=$cpu.Name;Cores=$cpu.NumberOfCores;Threads=$cpu.NumberOfLogicalProcessors;RAM_GB=$ram;RAM_MHz=$ramMhz;OsName=$osName;OsBuild=$osBuild;SystemModel=$sysModel}|ConvertTo-Json|Out-File $path -Encoding utf8; Write-Host "Done! File saved to: $path" -ForegroundColor Green`;

interface HardwareScanZoneProps {
  onScanned: (info: ScannedSysInfo) => void;
  onCleared: () => void;
  isScanned: boolean;
  defaultExpanded?: boolean;
}

// ── Browser Quick Scan (non-Tauri fallback) ──────────────────────────────────
// Detects GPU via WebGL renderer string, RAM via deviceMemory, CPU count via
// hardwareConcurrency, then posts to /api/session/hardware so the admin Preset
// Generator's "Detected Users" panel picks it up instantly.
function BrowserQuickScan({ onScanned, onClose }: { onScanned: (info: ScannedSysInfo) => void; onClose: () => void }) {
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const run = async () => {
    setScanning(true);
    try {
      let gpuName = "";
      try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
        if (gl) {
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          if (ext) {
            const raw = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || "";
            gpuName = raw.split("/")[0].trim(); // "GTX 1650 SUPER/PCIe/SSE2" → "GTX 1650 SUPER"
          }
        }
      } catch {}

      const gpuVendor = detectGpuVendor(gpuName);
      const cpuThreads = navigator.hardwareConcurrency || 4;
      const ramGb = Math.max(4, Math.round((navigator as any).deviceMemory ?? 8));
      const parsed: ScannedSysInfo = { GPU: gpuName || undefined, RAM_GB: ramGb, Threads: cpuThreads };

      saveScannedInfo(parsed);
      uploadHardwareToServer(parsed);
      onScanned(parsed);
      onClose();
      toast({
        title: "Browser scan sent to admin",
        description: `${gpuName || "GPU unknown"} · ${ramGb}GB RAM · ${cpuThreads}T — now visible in Detected Users`,
      });
    } catch (err: any) {
      toast({ title: "Scan failed", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={scanning}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-red-200 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
      >
        <Zap className="w-3.5 h-3.5" />
        {scanning ? "Detecting…" : "Quick Browser Scan"}
      </button>
      <p className="text-[10px] text-zinc-600 text-center">
        Detects GPU via WebGL · RAM · CPU threads · sends to admin instantly
      </p>
    </div>
  );
}

export function HardwareScanZone({ onScanned, onCleared, isScanned, defaultExpanded = false }: HardwareScanZoneProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { toast } = useToast();

  const copyCmd = () => {
    navigator.clipboard.writeText(PS1_CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Tauri desktop shell: skip the copy-and-paste dance entirely and call
  // the Rust WMI scan command directly. The render path still uses the
  // exact same ScannedSysInfo shape, so all downstream code is unchanged.
  const runNativeScan = useCallback(async () => {
    try {
      const native = await scanHardware();
      if (!native) throw new Error("Native scan returned no data");
      const parsed: ScannedSysInfo = {
        GPU: native.gpu,
        CPU: native.cpu,
        RAM_GB: native.ram_gb ?? undefined,
      };
      saveScannedInfo(parsed);
      uploadHardwareToServer(parsed);
      onScanned(parsed);
      setExpanded(false);
      toast({ title: "Native scan complete", description: `GPU: ${parsed.GPU || "?"} · RAM: ${parsed.RAM_GB ?? "?"}GB · CPU: ${parsed.CPU || "?"}` });
    } catch (err: any) {
      toast({ title: "Native scan failed", description: String(err?.message || err), variant: "destructive" });
    }
  }, [onScanned, toast]);

  const handleClear = () => {
    clearScannedInfo();
    onCleared();
    toast({ title: "Hardware scan cleared", description: "Detection will fall back to browser APIs." });
  };

  if (isScanned) {
    return (
      <button
        onClick={handleClear}
        data-testid="button-hardware-clear-scan"
        className="flex items-center gap-1.5 text-xs text-green-400 hover:text-red-400 transition-colors"
        title="Clear hardware scan data"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Scanned</span>
        <X className="w-3 h-3 opacity-60" />
      </button>
    );
  }

  return (
    <div className="w-full">
      {/* Collapsed trigger */}
      <button
        onClick={() => setExpanded(v => !v)}
        data-testid="button-hardware-scan-open"
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left",
          expanded
            ? "border-red-500/30 bg-red-500/5 text-red-400"
            : "border-dashed border-zinc-700 hover:border-red-500/40 hover:bg-red-500/4 text-zinc-500 hover:text-red-400"
        )}
      >
        <Cpu className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-medium flex-1">GPU / RAM not showing? Run hardware scan</span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">Hardware Scan</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {isNative() ? (
              <button
                onClick={runNativeScan}
                data-testid="button-hardware-scan-native"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-red-200 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Run instant native scan
              </button>
            ) : (
              <BrowserQuickScan onScanned={onScanned} onClose={() => setExpanded(false)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
