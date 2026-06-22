import { Mouse, Zap, Info } from "lucide-react";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";

const MOUSE_TWEAKS = [
  {
    id: "DisablePointerPrecision",
    title: "Disable Enhance Pointer Precision (Mouse Accel)",
    desc: "Turns off Windows mouse acceleration entirely — 1:1 raw input between your hand and the crosshair. Essential for competitive aim.",
    badge: "AIM FIRST",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "MousePointerSpeed611",
    title: "Set Pointer Speed to 6/11 (Neutral Baseline)",
    desc: "Sets pointer speed to the neutral 6/11 notch — zero acceleration curve distortion. Pairs with disabling pointer precision for true raw input.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "RegistryDPCLatency",
    title: "Reduce DPC Latency (Interrupt Handling Core Fix)",
    desc: "Disables AHCI link power management, switches boot clock to TSC, disables dynamic tick — drives DPC interrupt spikes from 100–500µs down to under 50µs. The kernel-level re-engineering that delivers sub-0.02ms mouse response.",
    badge: "INTERRUPT FIX",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "ProcMMCSSGaming",
    title: "MMCSS Gaming Profile: Maximum Scheduler Priority",
    desc: "Sets MMCSS SchedulingCategory=High, Priority=8 — guarantees your game's input thread gets CPU time slices before every background Windows process. Mouse events are dispatched faster with no scheduling starvation.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "Win32PrioritySeparation",
    title: "CPU Scheduler: Short Quanta + Max Foreground Boost",
    desc: "Sets Win32PrioritySeparation=26 — short variable time quanta with max foreground boost. The kernel processes mouse move and click events with tighter timing between hardware interrupt and game thread response.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "DisableDynamicTick",
    title: "Disable Dynamic Tick (Constant Timer Interrupt)",
    desc: "Forces a constant hardware timer interrupt — eliminates scheduler jitter so mouse events are dispatched at a steady cadence with no variable wake delay.",
    impact: "MED" as const,
    recommended: true,
  },
  {
    id: "InputLagTCP",
    title: "TCP: No-Delay + ACK Frequency = 1 (Zero Buffering)",
    desc: "Sets TcpAckFrequency=1, TCPNoDelay=1 — mouse click network packets fire instantly with no ACK batching. Zero input buffering at the TCP layer for online games.",
    badge: "ZERO BUFFER",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "MouseDataQueueSize",
    title: "Reduce Mouse Input Buffer (mouclass)",
    desc: "Shrinks the mouse driver's event queue from 100 to 20 entries — Windows processes your clicks and moves with less buffering delay.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "MouseHIDPowerSave",
    title: "Disable Mouse HID Power Management",
    desc: "Stops the USB controller from sleeping your mouse port — eliminates the 5–50ms wake latency before your first click after idle.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "DisableUSBSuspend",
    title: "Disable USB Selective Suspend",
    desc: "Prevents Windows from sleeping USB ports system-wide — eliminates mouse and keyboard dropouts during gaming.",
    badge: "USB FIX",
    impact: "MED" as const,
    recommended: true,
  },
  {
    id: "InputUSBPollingCheck",
    title: "USB Polling Rate Check (1000Hz Baseline)",
    desc: "Scans every USB HID device and reports any running below 1000Hz polling. If your mouse polls at 125Hz or 500Hz, you're getting 8ms or 2ms of hardware lag before Windows even sees the input.",
    badge: "DIAGNOSTIC",
    impact: "LOW" as const,
  },
  {
    id: "InputMousePollHzVerify",
    title: "Mouse Polling Rate Verifier",
    desc: "Measures your mouse's actual polling rate over 5 seconds via DirectInput timestamps — confirms you're hitting your sensor's rated Hz rather than a degraded USB connection.",
    badge: "DIAGNOSTIC",
    impact: "LOW" as const,
  },
  {
    id: "MouseHoverTimeMin",
    title: "Minimize Mouse Hover Time (10ms)",
    desc: "Sets hover delay to 10ms (default 400ms) — tooltips and context menus respond instantly.",
    impact: "MED" as const,
  },
];

export default function MouseTweaksPage() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <div className="space-y-6 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <Mouse className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Mouse Tweaks</h2>
          <p className="text-[11px] text-zinc-500">Universal registry and driver tweaks — works with every wired or wireless mouse</p>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
        <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-red-300">We re-engineer your system's interrupt handling to eliminate input lag at the source.</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            This is not about FPS — it is about <span className="text-white font-semibold">"zero-ms" responsiveness</span>.
            Every layer of the Windows mouse stack is stripped: HID buffers, USB power, pointer acceleration, DPC interrupt spikes, and TCP buffering.
          </p>
          <div className="pt-1 space-y-0.5">
            <p className="text-[11px] text-zinc-300"><span className="text-red-400 font-bold">• Input Fidelity:</span> Achieve &lt;0.02ms mouse and click latency.</p>
            <p className="text-[11px] text-zinc-300"><span className="text-red-400 font-bold">• Movement Precision:</span> Clean, snappy strafe mechanics with zero input buffering.</p>
            <p className="text-[11px] text-zinc-300"><span className="text-red-400 font-bold">• Baseline:</span> Includes an Extremely Stripped Windows foundation.</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-700/40 bg-zinc-900/40">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          These tweaks are <span className="text-white font-semibold">universal</span> — they work with every USB, wireless, and Bluetooth mouse regardless of brand.
          A reboot or log-off/log-on applies the HID power changes immediately.
        </p>
      </div>

      <div className="space-y-1">
        {MOUSE_TWEAKS.map((t) => (
          <TweakRow
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.desc}
            badge={t.badge}
            impact={t.impact}
            checked={!!tweaks[t.id]}
            onCheckedChange={(v: boolean) => setTweak(t.id, v)}
          />
        ))}
      </div>
    </div>
  );
}
