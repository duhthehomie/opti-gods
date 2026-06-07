import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { HardwareDetectionBanner } from "@/components/hardware-detection-banner";
import { scanHardware, isNative } from "@/lib/tauri-bridge";
import { Cpu, MonitorPlay, MemoryStick, HardDrive, Activity, Sparkles, Loader2, Wifi, Thermometer, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

function Stat({ icon: Icon, label, value, sub, highlight }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={cn("p-4 rounded-xl border bg-zinc-950/40", highlight ? "border-red-500/20 bg-red-500/[0.03]" : "border-white/5")}>
      <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-2">
        <Icon className={cn("w-3.5 h-3.5", highlight ? "text-red-400" : "text-zinc-500")} />
        {label}
      </div>
      <p className="text-white font-mono text-sm font-semibold truncate">{value}</p>
      {sub && <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export default function SystemScanPage() {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const [nativeScan, setNativeScan] = useState<Awaited<ReturnType<typeof scanHardware>> | null>(null);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const native = isNative();

  useEffect(() => {
    if (!native) return;
    setNativeLoading(true);
    scanHardware()
      .then(data => { setNativeScan(data); setNativeError(null); })
      .catch(err => { setNativeError(String(err)); })
      .finally(() => setNativeLoading(false));
  }, [native]);

  const loading = native ? nativeLoading : hw.loading;

  return (
    <AppLayout>
      <div className="space-y-6">
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
              ? "Direct WMI hardware scan from the Opti Gods native shell — exact specs, no browser limits."
              : "Live detection of your hardware and OS. Used to drive your Recommended Preset on the Home tab."}
          </p>
        </header>

        {!native && <HardwareDetectionBanner />}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {native ? "Running deep hardware scan…" : "Scanning hardware…"}
          </div>
        ) : native && nativeScan ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <Stat icon={MonitorPlay} label="GPU" value={nativeScan.gpu || "Unknown"}
                sub={nativeScan.vram_mb ? `${Math.round(nativeScan.vram_mb / 1024)} GB VRAM` : undefined} highlight />
              <Stat icon={Cpu} label="CPU" value={nativeScan.cpu || "Unknown"} highlight />
              <Stat icon={MemoryStick} label="RAM"
                value={nativeScan.ram_gb ? `${nativeScan.ram_gb} GB` : "Unknown"}
                sub={nativeScan.ram_mhz ? `${nativeScan.ram_mhz} MHz` : undefined} highlight />
              <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"}
                sub={os.build ? `Build ${os.build}` : undefined} />
              <Stat icon={Sparkles} label="Form Factor"
                value={nativeScan.chassis === "Notebook" || nativeScan.chassis === "Laptop" ? "Laptop" : "Desktop"}
                sub={nativeScan.chassis || undefined} />
              {nativeScan.motherboard && (
                <Stat icon={Monitor} label="Motherboard" value={nativeScan.motherboard} />
              )}
              {nativeScan.refresh_hz && (
                <Stat icon={Monitor} label="Refresh Rate" value={`${nativeScan.refresh_hz} Hz`} />
              )}
              {nativeScan.nic_vendor && (
                <Stat icon={Wifi} label="Network" value={nativeScan.nic_vendor} />
              )}
              {nativeScan.cooling_type && (
                <Stat icon={Thermometer} label="Cooling" value={nativeScan.cooling_type} />
              )}
            </div>
            {nativeScan.anticheats && nativeScan.anticheats.length > 0 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 mb-2">Anti-Cheat Detected</div>
                <div className="flex flex-wrap gap-2">
                  {nativeScan.anticheats.map(ac => (
                    <span key={ac} className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 font-mono">{ac}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : native && nativeError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-400">
            Native scan failed: {nativeError}. Falling back to browser detection.
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 mt-4">
              <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"} />
              <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"} />
              <Stat icon={MemoryStick} label="RAM" value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"} />
              <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"} sub={os.build ? `Build ${os.build}` : undefined} />
              <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"}
              sub={[hw.isNvidia && "NVIDIA", hw.isAMD && "AMD", hw.isIntel && "Intel"].filter(Boolean).join(" · ") || undefined} />
            <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"}
              sub={hw.cpuCores ? `${hw.cpuCores} threads` : undefined} />
            <Stat icon={MemoryStick} label="RAM" value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"} />
            <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"}
              sub={os.build ? `Build ${os.build}` : undefined} />
            <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
