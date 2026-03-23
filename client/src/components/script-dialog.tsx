import { useState } from "react";
import { Copy, Terminal, CheckCircle2, Download, Shield, ChevronRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";

interface ScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string | null;
}

export function ScriptDialog({ open, onOpenChange, command }: ScriptDialogProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { tweaks, nvidiaPreset } = useOptimizationStore();
  const { toast } = useToast();

  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  const handleCopy = async () => {
    if (command) {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
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
      toast({ title: `Downloaded OptiGods-by-leaq.ps1 (${enabledCount} tweaks)`, description: "Right-click → Run with PowerShell as Administrator." });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Download failed", description: String(e), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-red-500/20 bg-[#080808] backdrop-blur-xl p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display text-white">
              <Terminal className="w-5 h-5 text-red-500" />
              Script Ready
              <span className="ml-auto text-xs font-mono text-zinc-500 font-normal">
                {enabledCount} TWEAKS
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* RECOMMENDED: Download Path */}
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white tracking-wider">RECOMMENDED</span>
              <span className="text-sm font-medium text-white">Download & Run</span>
            </div>
            <ol className="space-y-2 mb-4">
              {[
                "Click Download below to save the .ps1 file",
                "Open the Downloads folder and find OptiGods-by-leaq.ps1",
                "Right-click the file → Run with PowerShell",
                "Click Yes on the Admin prompt — restart when done",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Button
              data-testid="button-download-from-dialog"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-red-600 hover:bg-red-500 text-white border border-red-400/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] font-display tracking-wide"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              DOWNLOAD OptiGods-by-leaq.ps1
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-zinc-600 uppercase tracking-widest">or use PowerShell directly</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Advanced: irm | iex */}
          <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400 font-medium">One-liner — requires Admin PowerShell</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-zinc-950 rounded-lg px-3 py-2.5 border border-zinc-800 min-w-0">
                <code className="text-xs text-zinc-300 font-mono break-all leading-relaxed">
                  {command || "Generating..."}
                </code>
              </div>
              <Button
                data-testid="button-copy-command"
                size="icon"
                variant="ghost"
                onClick={handleCopy}
                disabled={!command}
                className="shrink-0 h-10 w-10 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800"
              >
                {copied
                  ? <CheckCircle2 className="w-4 h-4 text-red-400" />
                  : <Copy className="w-4 h-4" />
                }
              </Button>
            </div>
            <p className="text-[11px] text-zinc-600 mt-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              Open Start → search "PowerShell" → right-click → Run as Administrator → paste
            </p>
          </div>

          {/* Warning */}
          <p className="text-[11px] text-zinc-600 text-center">
            Scripts apply registry edits, service changes, and system tweaks. A restart may be required.
          </p>
        </div>

        <div className="px-6 pb-5 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-500 hover:text-zinc-300 hover:bg-white/5 text-sm"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
