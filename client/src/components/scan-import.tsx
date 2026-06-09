import { useState, useRef } from "react";
import { Download, ScanLine, CheckCircle2, AlertCircle, Upload, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";

export function ScanImport() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [imported, setImported] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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
    setManualCode("");
    toast({
      title: "PC state loaded",
      description: `${count} optimizations detected as already applied on your system.`,
    });
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) { setStatus("error"); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseAndApply(e.target?.result as string);
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
            Double-click the file → click <strong className="text-zinc-300">Yes</strong> on the UAC popup.
            It saves <span className="font-mono text-zinc-400">OptiGods-Scan-Result.json</span> to your Desktop.
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

      {/* Step 2 — drag-and-drop zone */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
        <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[11px] font-bold text-red-400 shrink-0 mt-0.5">2</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white mb-2">Drop the Result File Here</p>

          {status === "success" ? (
            <div className="flex items-center gap-2 text-xs text-green-400 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {imported} tweaks imported successfully
            </div>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                data-testid="input-scan-file"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {/* Drop zone */}
              <div
                data-testid="dropzone-scan-import"
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 cursor-pointer transition-all select-none",
                  dragging
                    ? "border-red-500/60 bg-red-500/5 scale-[1.01]"
                    : "border-zinc-700 hover:border-red-500/40 hover:bg-red-500/[0.02]"
                )}
              >
                <Upload className={cn("w-5 h-5 transition-colors", dragging ? "text-red-400" : "text-zinc-600")} />
                <div className="text-center">
                  <p className={cn("text-xs font-semibold transition-colors", dragging ? "text-red-300" : "text-zinc-400")}>
                    {dragging ? "Release to import" : "Drop OptiGods-Scan-Result.json here"}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">or click to browse</p>
                </div>
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Couldn't read the file. Make sure you're dropping <span className="font-mono ml-1">OptiGods-Scan-Result.json</span>.
                </div>
              )}

              {/* Manual paste fallback (collapsed by default) */}
              <button
                data-testid="button-show-manual-import"
                onClick={() => setShowManual(v => !v)}
                className="mt-3 flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", showManual && "rotate-180")} />
                Enter code manually
              </button>

              {showManual && (
                <div className="mt-2 flex gap-2">
                  <input
                    data-testid="input-scan-paste"
                    type="text"
                    value={manualCode}
                    onChange={e => { setManualCode(e.target.value); setStatus("idle"); }}
                    placeholder="OPTIGODS_STATE:..."
                    className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono transition-colors"
                  />
                  <Button
                    data-testid="button-import-state"
                    size="sm"
                    onClick={() => parseAndApply(manualCode)}
                    disabled={!manualCode.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 h-7 text-xs shrink-0"
                  >
                    Import
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
