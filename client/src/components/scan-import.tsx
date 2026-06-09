import { useState } from "react";
import { Download, ScanLine, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";

export function ScanImport() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [imported, setImported] = useState(0);
  const [fallbackPaste, setFallbackPaste] = useState("");
  const { setAllTweaks, tweaks } = useOptimizationStore();
  const { toast } = useToast();

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = apiUrl("/api/script/detect");
    a.download = "OptiGods-Detect.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const parseAndApply = (text: string) => {
    let detected: Record<string, boolean> | null = null;
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed && typeof parsed === "object") detected = parsed as Record<string, boolean>;
    } catch {}
    if (!detected) {
      try {
        const match = text.match(/OPTIGODS_STATE:([A-Za-z0-9+/=]+)/);
        const b64 = match ? match[1] : text.trim();
        detected = JSON.parse(atob(b64));
      } catch {}
    }
    if (!detected) { setStatus("error"); return; }
    const next = { ...tweaks };
    let count = 0;
    for (const [key, val] of Object.entries(detected)) {
      if (key in next && typeof val === "boolean") {
        next[key] = val;
        if (val) count++;
      }
    }
    setAllTweaks(next);
    setImported(count);
    setStatus("success");
    setFallbackPaste("");
    toast({
      title: "PC state loaded",
      description: `${count} optimizations detected as already applied on your system.`,
    });
  };

  return (
    <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <ScanLine className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Detect Already-Applied Optimizations</h2>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        Already had your PC optimized? Run the scan to auto-detect what's already done — so nothing gets applied twice. Read-only, changes nothing.
      </p>

      {/* Step 1 */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
        <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">1</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white mb-1">Download & Run the Scan</p>
          <p className="text-[11px] text-zinc-500 mb-2">
            Double-click the file → click <strong className="text-zinc-300">Yes</strong> on the UAC popup. It outputs a code at the end — copy it.
          </p>
          <Button
            data-testid="button-download-detect"
            size="sm"
            onClick={handleDownload}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-red-500/40 text-zinc-100 text-xs gap-1.5 h-7"
          >
            <Download className="w-3.5 h-3.5" />
            Download Scan (.bat)
          </Button>
        </div>
      </div>

      {/* Step 2 — paste the output code */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
        <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">2</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white mb-1">Paste the Result Code</p>
          <p className="text-[11px] text-zinc-500 mb-2">
            Paste the <span className="font-mono text-zinc-400">OPTIGODS_STATE:...</span> line from the scan output:
          </p>
          {status === "success" ? (
            <div className="flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {imported} tweaks imported successfully
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                data-testid="input-scan-paste"
                type="text"
                value={fallbackPaste}
                onChange={(e) => { setFallbackPaste(e.target.value); setStatus("idle"); }}
                placeholder="OPTIGODS_STATE:..."
                className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono transition-colors"
              />
              <Button
                data-testid="button-import-state"
                size="sm"
                onClick={() => parseAndApply(fallbackPaste)}
                disabled={!fallbackPaste.trim()}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 h-7 text-xs shrink-0"
              >
                Import
              </Button>
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Couldn't read the code. Make sure you copied the full <span className="font-mono ml-1">OPTIGODS_STATE:…</span> line.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
