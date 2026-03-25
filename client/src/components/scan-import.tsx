import { useState, useRef, useCallback } from "react";
import { Download, ScanLine, CheckCircle2, AlertCircle, ChevronRight, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ScanImport() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [imported, setImported] = useState(0);
  const [fallbackPaste, setFallbackPaste] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setAllTweaks, tweaks } = useOptimizationStore();
  const { toast } = useToast();

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/api/script/detect";
    a.download = "OptiGods-Detect.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const parseAndApply = (text: string) => {
    const match = text.match(/OPTIGODS_STATE:([A-Za-z0-9+/=]+)/);
    const b64 = match ? match[1] : text.trim();
    try {
      const json = atob(b64);
      const detected: Record<string, boolean> = JSON.parse(json);
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
      setShowFallback(false);
      toast({
        title: "PC state loaded",
        description: `${count} optimizations detected as already applied on your system.`,
      });
    } catch {
      setStatus("error");
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseAndApply(text);
    };
    reader.onerror = () => setStatus("error");
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [tweaks]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
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

      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        {/* Step 1 */}
        <div className="flex-1 flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
          <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">1</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white mb-1">Download & Run the Scan</p>
            <p className="text-[11px] text-zinc-500 mb-2">
              Double-click the file → click <strong className="text-zinc-300">Yes</strong> on the UAC popup. It saves a result file to your Desktop automatically.
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

        <ChevronRight className="hidden sm:block w-4 h-4 text-zinc-700 self-center shrink-0" />

        {/* Step 2 — drag/drop zone */}
        <div className="flex-1 flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
          <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">2</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white mb-1">Drop the Result File Here</p>
            <p className="text-[11px] text-zinc-500 mb-2">
              Drag <span className="font-mono text-zinc-400">OptiGods-Scan-Result.txt</span> from your Desktop into the box below.
            </p>

            <div
              data-testid="dropzone-scan-result"
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-all duration-150 select-none min-h-[70px]",
                dragging
                  ? "border-red-500/70 bg-red-500/8 scale-[1.01]"
                  : status === "success"
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-white/3"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.log"
                onChange={onFileInputChange}
                className="hidden"
                data-testid="input-file-scan"
              />
              {status === "success" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-[11px] text-green-400 font-medium text-center">{imported} tweaks imported</span>
                </>
              ) : dragging ? (
                <>
                  <Upload className="w-5 h-5 text-red-400" />
                  <span className="text-[11px] text-red-400 font-medium">Drop to import</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 text-zinc-600" />
                  <span className="text-[11px] text-zinc-500 text-center leading-tight">
                    Drag <span className="font-mono">OptiGods-Scan-Result.txt</span> here<br />
                    <span className="text-zinc-700">or click to browse</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fallback paste toggle */}
      {!showFallback && status !== "success" && (
        <button
          onClick={() => setShowFallback(true)}
          className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors underline underline-offset-2"
          data-testid="button-show-fallback-paste"
        >
          Prefer to paste the code manually instead?
        </button>
      )}

      {showFallback && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">Paste the <span className="font-mono text-zinc-400">OPTIGODS_STATE:...</span> line from the PowerShell output:</p>
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
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Couldn't read the file. Make sure you're dropping <span className="font-mono ml-1">OptiGods-Scan-Result.txt</span>.
        </div>
      )}
    </div>
  );
}
