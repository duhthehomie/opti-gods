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
          <p className="text-xs font-bold text-red-300">How low can we go?</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            These tweaks target every layer of the Windows mouse input stack — from the HID driver buffer all the way up to the pointer precision curve.
            Together they push click-to-action latency as low as your hardware polling rate allows.
            <span className="text-white font-semibold"> Enable all recommended tweaks for maximum effect.</span>
          </p>
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
            recommended={t.recommended}
            enabled={!!tweaks[t.id]}
            onToggle={(v) => setTweak(t.id, v)}
          />
        ))}
      </div>
    </div>
  );
}
