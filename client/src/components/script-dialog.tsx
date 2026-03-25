import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Download, CheckCircle2, Loader2,
  FolderOpen, MousePointerClick, ShieldCheck, RotateCcw,
  Zap, ChevronDown, ChevronUp, ArrowRight,
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

interface ScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string | null;
}

const HOW_TO_STEPS = [
  {
    icon: FolderOpen,
    label: 'Open your Downloads folder',
    detail: 'Press Win + E, then click "Downloads" on the left',
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: MousePointerClick,
    label: 'Double-click "OptiGods-by-leaq.bat"',
    detail: 'A small black window flashes briefly — that\'s normal. The UAC prompt appears right after.',
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: ShieldCheck,
    label: 'Click "Yes" on the blue permission popup',
    detail: "Windows asks for admin access to apply the tweaks — always required",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: CheckCircle2,
    label: 'Wait for it to finish — watch the output',
    detail: 'You\'ll see each tweak applied in real time. Takes 10–30 seconds.',
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: RotateCcw,
    label: 'Press Enter when it says "Press Enter to close", then restart',
    detail: "Restart your PC for all changes to take full effect",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
];

export function ScriptDialog({ open, onOpenChange, command }: ScriptDialogProps) {
  const [stage, setStage] = useState<"ready" | "downloaded">("ready");
  const [downloading, setDownloading] = useState(false);
  const [downloadingPs1, setDownloadingPs1] = useState(false);
  const [showWhat, setShowWhat] = useState(false);
  const { tweaks, nvidiaPreset } = useOptimizationStore();
  const { toast } = useToast();

  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  const handleDownloadBat = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/script/download-bat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks, nvidiaPreset }),
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
      const res = await fetch("/api/script/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks, nvidiaPreset }),
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
      toast({ title: "PS1 downloaded", description: "Right-click → Properties → Unblock before running if Windows blocks it." });
    } catch (e) {
      toast({ title: "Download failed", description: String(e), variant: "destructive" });
    } finally {
      setDownloadingPs1(false);
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
                  You have <span className="text-white font-semibold">{enabledCount} tweak{enabledCount !== 1 ? "s" : ""}</span> selected. Download and double-click — it handles everything automatically.
                </p>
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
                        <p>Nothing is deleted. No programs are removed. All changes can be undone from the Fixes & Restore tab.</p>
                        <p className="text-zinc-600">A restart is usually needed for all changes to take effect.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary BAT download */}
                <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">OptiGods-by-leaq.bat</p>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-600 text-white tracking-wider">RECOMMENDED</span>
                      </div>
                      <p className="text-xs text-zinc-500">{enabledCount} tweaks · Double-click to run · Auto-elevates</p>
                    </div>
                    <div className="ml-auto">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white tracking-wider">STEP 1</span>
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

                {/* PS1 advanced option */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-zinc-600">Advanced:</span>
                  <button
                    data-testid="button-download-ps1"
                    onClick={handleDownloadPs1}
                    disabled={downloadingPs1 || enabledCount === 0}
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-40"
                  >
                    {downloadingPs1 ? "Downloading..." : "Download .ps1 instead"}
                  </button>
                  <span className="text-[10px] text-zinc-700">(requires right-click → Properties → Unblock first)</span>
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
                <p className="text-sm text-zinc-500 mt-1">Follow these steps — takes about 30 seconds total</p>
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
