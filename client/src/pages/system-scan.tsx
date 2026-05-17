import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { HardwareDetectionBanner } from "@/components/hardware-detection-banner";
import { Cpu, MonitorPlay, MemoryStick, HardDrive, Activity, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div data-testid={`stat-${label.toLowerCase()}`} className="p-4 rounded-xl border border-white/5 bg-zinc-950/40">
      <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-2">
        <Icon className="w-3.5 h-3.5 text-red-400" />
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Activity className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">System Scan</h1>
          </div>
          <p className="text-sm text-zinc-500">Live detection of your hardware and OS. Used to drive your Recommended Preset on the Home tab.</p>
        </header>

        <HardwareDetectionBanner />

        {hw.loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Scanning hardware…
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Stat icon={MonitorPlay} label="GPU" value={hw.gpuName || "Unknown"} sub={[hw.isNvidia && "NVIDIA", hw.isAMD && "AMD", hw.isIntel && "Intel"].filter(Boolean).join(" · ") || undefined} />
            <Stat icon={Cpu} label="CPU" value={hw.cpuLabel || "Unknown"} sub={hw.cpuCores ? `${hw.cpuCores} threads` : undefined} />
            <Stat icon={MemoryStick} label="RAM" value={hw.ramGB ? `${hw.ramGB} GB` : "Browser-limited"} />
            <Stat icon={HardDrive} label="OS" value={os.os || "Detecting…"} sub={os.build ? `Build ${os.build}` : undefined} />
            <Stat icon={Sparkles} label="Form Factor" value={hw.isLaptop ? "Laptop" : "Desktop"} />
          </div>
        )}

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
          <p className="font-bold mb-1">Heads up</p>
          <p className="leading-relaxed">The web build can only see what the browser exposes. The desktop app (coming in V2) reads real WMI data — full vendor strings, exact RAM size, drive type, monitor refresh rate, and more.</p>
        </div>
      </div>
    </AppLayout>
  );
}
