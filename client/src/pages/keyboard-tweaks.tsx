import { Keyboard, Zap, Info } from "lucide-react";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";

const KEYBOARD_TWEAKS = [
  {
    id: "KeyboardDisableFilterKeys",
    title: "Disable Filter Keys (Remove Artificial Delay)",
    desc: "Filter Keys adds deliberate keystroke delays to prevent accidental presses — even when you didn't enable it yourself. Disabling it removes all artificial input lag from the keyboard stack.",
    badge: "DO THIS FIRST",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "KeyboardDisableStickyKeys",
    title: "Disable Sticky Keys Shortcut",
    desc: "Disables the Sticky Keys popup triggered by pressing Shift 5 times. In any game that uses Shift for sprint, crouch, or slide this popup can pause or alt-tab your game mid-fight.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
    recommended: true,
  },
  {
    id: "KeyboardRepeatRateMax",
    title: "Maximum Keyboard Repeat Rate",
    desc: "Sets KeyboardSpeed=31 — key repeat fires at ~30 chars/sec instead of the default ~10/sec. Held keys respond instantly in every application.",
    badge: "RECOMMENDED",
    impact: "MED" as const,
    recommended: true,
  },
  {
    id: "KeyboardRepeatDelayMin",
    title: "Minimum Keyboard Repeat Delay",
    desc: "Sets KeyboardDelay=0 — key repeat kicks in after 250ms (default 500ms). Hold any key and repeat starts twice as fast.",
    badge: "RECOMMENDED",
    impact: "MED" as const,
    recommended: true,
  },
  {
    id: "KeyboardDataQueueSize",
    title: "Reduce Keyboard Input Buffer (kbdclass)",
    desc: "Shrinks the keyboard driver's event queue from 100 to 20 entries — keystrokes are processed with less queuing overhead, lower key-to-action latency.",
    impact: "MED" as const,
  },
  {
    id: "KeyboardHIDPowerSave",
    title: "Disable Keyboard HID Power Management",
    desc: "Stops the USB controller from suspending your keyboard port — eliminates first-keypress wake latency after idle periods.",
    impact: "MED" as const,
  },
  {
    id: "DisableUSBSuspend",
    title: "Disable USB Selective Suspend",
    desc: "Prevents Windows from sleeping USB ports system-wide — eliminates keyboard and mouse dropouts during gaming.",
    badge: "USB FIX",
    impact: "MED" as const,
    recommended: true,
  },
];

export default function KeyboardTweaksPage() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <div className="space-y-6 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <Keyboard className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Keyboard Tweaks</h2>
          <p className="text-[11px] text-zinc-500">Universal registry and driver tweaks — works with every wired or wireless keyboard</p>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
        <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-red-300">Target: lowest possible keystroke latency</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Windows adds artificial delays at multiple points in the keyboard stack — Filter Keys, Sticky Keys shortcuts, and HID power management all contribute.
            These tweaks strip every unnecessary delay out, leaving you with the raw hardware polling speed of your keyboard.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-700/40 bg-zinc-900/40">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          These tweaks are <span className="text-white font-semibold">universal</span> — they work with every USB, wireless, and Bluetooth keyboard regardless of brand.
          Changes take effect immediately after applying the script (no reboot needed for most).
        </p>
      </div>

      <div className="space-y-1">
        {KEYBOARD_TWEAKS.map((t) => (
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
