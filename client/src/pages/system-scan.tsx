import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { scanHardware, isNative } from "@/lib/tauri-bridge";
import type { NativeHardwareScan } from "@/lib/tauri-bridge";
import {
  Cpu, MonitorPlay, MemoryStick, HardDrive, Activity, Sparkles,
  Loader2, Wifi, Thermometer, Monitor, Wind, RefreshCw,
  AlertTriangle, CheckCircle2, Zap, ScanLine, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
      </div>
    </AppLayout>
  );
}
