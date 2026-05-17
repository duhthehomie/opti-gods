import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Download, CheckCircle2, Loader2,
  FolderOpen, MousePointerClick, ShieldCheck, RotateCcw,
  Zap, ChevronDown, ChevronUp, ArrowRight, Copy, Clock, List,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getStoredToken } from "@/lib/pro-status";

interface ScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string | null;
}

const HOW_TO_STEPS = [
  {
    icon: Download,
    label: 'Download the .bat file',
    detail: 'Click the download button below — OptiGods-by-leaq.bat will save to your Downloads folder or Desktop (depending on your browser settings).',
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: MousePointerClick,
    label: 'Double-click "OptiGods-by-leaq.bat"',
    detail: 'A brief black window appears for 1 second — completely normal. The UAC popup follows immediately.',
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: ShieldCheck,
    label: 'Click "Yes" on the UAC popup',
    detail: "It says \"Windows Command Processor\" — that's normal. It runs cmd.exe (a trusted Windows system file) to apply your tweaks safely.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: CheckCircle2,
    label: 'Watch the tweaks apply in real time',
    detail: "You'll see each tweak confirmed in green as it applies. Takes 10–60 seconds depending on how many you selected.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: RotateCcw,
    label: 'Press Enter to close, then restart your PC',
    detail: "A full restart activates registry changes, service tweaks, and power plan changes. Don't skip it.",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
];

// Categorize tweak keys by prefix
function categorizeTweaks(tweaks: Record<string, boolean>) {
  const enabled = Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k);
  const cats: Record<string, number> = {};
  const rules: [string, RegExp | ((k: string) => boolean)][] = [
    ["FiveM",    k => k.startsWith("FiveM")],
    ["Fortnite", k => k.startsWith("Fortnite")],
    ["NVIDIA",   k => k.startsWith("Nvidia") || k.startsWith("gpu") || k.startsWith("Gpu")],
    ["Games",    k => k.startsWith("game_")],
    ["Process",  k => k.startsWith("ProcessLasso") || k.startsWith("ProcessAuto") || k.startsWith("ProcessTrim")],
    ["Discord",  k => k.startsWith("Discord")],
    ["Memory",   k => k.startsWith("Mem") || k.startsWith("mem")],
    ["Services", k => k.startsWith("Service")],
    ["Privacy",  k => k.startsWith("Privacy")],
    ["Startup",  k => k.startsWith("su_") || k.startsWith("startup")],
    ["Debloat",  k => k.startsWith("Debloat") || k.startsWith("Remove")],
    ["Registry", () => true], // catch-all
  ];
  for (const key of enabled) {
    for (const [cat, match] of rules) {
      const fn = typeof match === "function" ? match : (k: string) => match.test(k);
      if (fn(key)) { cats[cat] = (cats[cat] || 0) + 1; break; }
    }
  }
  return Object.entries(cats).sort((a, b) => b[1] - a[1]);
}

export function ScriptDialog({ open, onOpenChange, command }: ScriptDialogProps) {
  const [stage, setStage] = useState<"ready" | "downloaded">("ready");
  const [downloading, setDownloading] = useState(false);
  const [downloadingPs1, setDownloadingPs1] = useState(false);
  const [copyingPs1, setCopyingPs1] = useState(false);
  const [showWhat, setShowWhat] = useState(false);
  const { tweaks, nvidiaPreset, markApplied } = useOptimizationStore();
  const { toast } = useToast();

  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const categories = categorizeTweaks(tweaks);
  const estimatedSeconds = Math.max(10, Math.round(enabledCount * 0.35));
  const estLabel = estimatedSeconds < 60
    ? `~${estimatedSeconds}s`
    : `~${Math.round(estimatedSeconds / 60)}m ${estimatedSeconds % 60}s`;

  const handleDownloadBat = async () => {
    setDownloading(true);
    try {
      const sessionToken = getStoredToken();
      const res = await fetch("/api/script/download-bat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks, nvidiaPreset, sessionToken }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const text = await res.text();
      const blob = new Blob([text], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OptiGods-by-leaq.bat";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Task #39 — mark every selected tweak as "applied" so the TweakRow
      // shows an inline Undo button. Persisted client-side via zustand.
      markApplied(Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k));
      setStage("downloaded");
    } catch (e) {
      toast({ title: "Download failed", description: String(e), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPs1 = async () => {
    setDownloadingPs1(true);
    try {
      const sessionToken = getStoredToken();
      const res = await fetch("/api/script/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks, nvidiaPreset, sessionToken }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OptiGods-by-leaq.ps1";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      markApplied(Object.entries(tweaks).filter(([, v]) => v).map(([k]) => k));
      toast({ title: "PS1 downloaded", description: "Double-click to run. If Windows blocks it: right-click → Properties → Unblock → OK." });
    } catch (e) {
      toast({ title: "Download failed", description: String(e), variant: "destructive" });
    } finally {
      setDownloadingPs1(false);
    }
  };

  const handleCopyPs1 = async () => {
    setCopyingPs1(true);
    try {
      const sessionToken = getStoredToken();
      const res = await fetch("/api/script/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks, nvidiaPreset, sessionToken }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!", description: "Paste into PowerShell ISE or VS Code to review before running." });
    } catch (e) {
      toast({ title: "Copy failed", description: String(e), variant: "destructive" });
    } finally {
      setCopyingPs1(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setStage("ready"), 400);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-red-500/20 bg-[#080808] backdrop-blur-xl p-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500" />

        <AnimatePresence mode="wait">

          {stage === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pt-5 pb-4 border-b border-white/5">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-xl font-display text-white">
                    <Terminal className="w-5 h-5 text-red-500 shrink-0" />
                    Your Script Is Ready
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-zinc-400 mt-1.5">
                  <span className="text-white font-semibold">{enabledCount} tweak{enabledCount !== 1 ? "s" : ""}</span> selected. Download and double-click — runs automatically.
                </p>

                {/* Category breakdown */}
                {categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {categories.map(([cat, count]) => (
                      <span key={cat} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {cat}: <span className="text-white">{count}</span>
                      </span>
                    ))}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-900/60 text-zinc-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {estLabel}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-6 py-5 space-y-4">
                <button
                  onClick={() => setShowWhat(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-300">What will this do to my PC?</span>
                  </div>
                  {showWhat ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                </button>
                <AnimatePresence>
                  {showWhat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden -mt-1"
                    >
                      <div className="px-4 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 leading-relaxed space-y-2">
                        <p>The script makes <strong className="text-zinc-200">Windows registry changes</strong> that tell your PC to prioritize games and reduce background activity.</p>
                        <p>Nothing is deleted. No programs are removed. All changes can be undone from the <span className="text-cyan-400">Fixes &amp; Restore</span> tab.</p>
                        <p className="text-zinc-600">A restart is usually needed for all changes to take effect.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary BAT download */}
                <div className="relative rounded-xl border border-red-500/25 bg-red-500/5 p-5 space-y-4">
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-black text-white leading-none">1</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">OptiGods-by-leaq.bat</p>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-600 text-white tracking-wider whitespace-nowrap">RECOMMENDED</span>
                      </div>
                      <p className="text-xs text-zinc-500">{enabledCount} tweaks · Double-click to run · Auto-elevates to admin</p>
                    </div>
                  </div>

                  <Button
                    data-testid="button-download-bat"
                    onClick={handleDownloadBat}
                    disabled={downloading || enabledCount === 0}
                    className="w-full bg-red-600 hover:bg-red-500 text-white border border-red-400/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] font-bold text-sm h-11"
                  >
                    {downloading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating script...</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" /> Download .BAT ({enabledCount} tweaks)</>
                    )}
                  </Button>

                  {enabledCount === 0 && (
                    <p className="text-xs text-center text-amber-400">No tweaks selected — go back and enable some first!</p>
                  )}
                </div>

                {/* Advanced row */}
                <div className="flex flex-wrap items-center gap-3 px-1">
                  <span className="text-xs text-zinc-600 shrink-0">Advanced:</span>
                  <button
                    data-testid="button-download-ps1"
                    onClick={handleDownloadPs1}
                    disabled={downloadingPs1 || enabledCount === 0}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-40"
                  >
                    <List className="w-3 h-3" />
                    {downloadingPs1 ? "Downloading..." : "Download .ps1"}
                  </button>
                  <span className="text-zinc-800">·</span>
                  <button
                    data-testid="button-copy-ps1"
                    onClick={handleCopyPs1}
                    disabled={copyingPs1 || enabledCount === 0}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-40"
                  >
                    <Copy className="w-3 h-3" />
                    {copyingPs1 ? "Copying..." : "Copy PS1"}
                  </button>
                </div>

                <p className="text-center text-xs text-zinc-600">
                  After downloading, we'll show you exactly how to run it →
                </p>
              </div>
            </motion.div>
          )}

          {stage === "downloaded" && (
            <motion.div
              key="downloaded"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pt-5 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Downloaded!</span>
                </div>
                <h2 className="text-xl font-display font-bold text-white">Now run it in 5 steps</h2>
                <p className="text-sm text-zinc-500 mt-1">Estimated time: <span className="text-zinc-300">{estLabel}</span> — then restart</p>
              </div>

              <div className="px-6 py-5 space-y-2.5">
                {HOW_TO_STEPS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={cn("flex items-start gap-3 p-3.5 rounded-xl border", step.bg)}
                  >
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-black/30 flex items-center justify-center">
                      <step.icon className={cn("w-4 h-4", step.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{step.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{step.detail}</p>
                    </div>
                    <div className="shrink-0 w-6 h-6 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                      {i + 1}
                    </div>
                  </motion.div>
                ))}

                <div className="flex items-start gap-2 px-1 pt-1">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider shrink-0 mt-0.5">Tip:</span>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    If Windows SmartScreen says "Windows protected your PC" — click <span className="text-zinc-400">"More info"</span> then <span className="text-zinc-400">"Run anyway."</span> This is normal for unsigned batch files.
                  </p>
                </div>
              </div>

              <div className="px-6 pb-5 flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStage("ready")}
                  className="text-zinc-500 hover:text-zinc-300 hover:bg-white/5 text-sm flex-1"
                >
                  ← Download again
                </Button>
                <Button
                  data-testid="button-done-script"
                  onClick={handleClose}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex-1"
                >
                  Done <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
