import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Shield, Zap, Cpu, Search, ChevronRight, X, Terminal, CheckCircle2 } from "lucide-react";
import { getScannedInfo } from "@/hooks/use-hardware-info";

const ONBOARDING_KEY = "optigods_onboarded_v1";

const STEPS = [
  {
    icon: Search,
    title: "Step 1 — Detect Your Hardware",
    body: "Download the free scanner script and run it as Administrator. It detects your GPU, CPU, and RAM — takes under 5 seconds. This lets the app show you only the tweaks that actually apply to your PC.",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  {
    icon: Zap,
    title: "Step 2 — Enable Tweaks",
    body: "Go through the tabs (FiveM, NVIDIA, Memory, etc.) and flip on the tweaks you want. Each tab's RECOMMENDED button auto-enables the highest-impact tweaks for your system.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Terminal,
    title: "Step 3 — Download Your Script",
    body: "Click 'Download Script' from any tab to generate your personal PowerShell file. Run it as Administrator — it applies every enabled tweak in one shot. Done. No repeat scans needed.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const already = localStorage.getItem(ONBOARDING_KEY);
    const scanned = getScannedInfo();
    if (!already && !scanned) {
      // Small delay so page loads first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setOpen(false);
  }

  const currentStep = STEPS[step];
  const StepIcon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-[460px] border-0 bg-[#080808] p-0 overflow-hidden shadow-2xl shadow-black/80">
        <DialogTitle className="sr-only">Welcome to Opti Gods</DialogTitle>
        <DialogDescription className="sr-only">Setup guide for new users</DialogDescription>

        {/* Top bar */}
        <div className="bg-gradient-to-r from-red-600/20 via-red-500/10 to-transparent border-b border-red-500/20 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400">Welcome to Opti Gods</span>
          </div>
          <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 space-y-5">
          {/* Step progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1 rounded-full transition-all ${
                  i === step ? "bg-red-500 flex-1" : i < step ? "bg-red-500/40 w-8" : "bg-zinc-800 w-8"
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border ${currentStep.bg}`}>
                <StepIcon className={`w-4 h-4 ${currentStep.color}`} />
                <span className={`text-[11px] font-black uppercase tracking-wider ${currentStep.color}`}>
                  {currentStep.title}
                </span>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed">{currentStep.body}</p>

              {/* Step 0: show quick stats */}
              {step === 0 && (
                <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4 space-y-2.5">
                  {[
                    "Detects GPU (NVIDIA / AMD / Intel)",
                    "Detects CPU model + core count",
                    "Detects RAM amount",
                    "Auto-selects the right tweaks for your hardware",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="text-xs text-zinc-400">{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 2: reminder about one-scan */}
              {step === 2 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="text-[11px] text-emerald-300 font-semibold">
                    You only need to detect once — your hardware info is saved in your browser so it persists across sessions.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            {step < STEPS.length - 1 ? (
              <>
                <button
                  onClick={dismiss}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Skip
                </button>
                <Button
                  onClick={() => setStep(s => s + 1)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
                {step === 0 && (
                  <Link href="/game-detection">
                    <Button
                      onClick={dismiss}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider"
                    >
                      <Search className="w-3.5 h-3.5 mr-1.5" />
                      Detect Now
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/game-detection" className="flex-1">
                  <Button
                    onClick={dismiss}
                    className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider"
                  >
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Start Hardware Scan
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={dismiss}
                  className="text-xs text-zinc-600 hover:text-zinc-300"
                >
                  I'll do it later
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
