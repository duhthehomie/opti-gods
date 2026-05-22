import { useEffect, useState } from "react";
import { Download, ExternalLink, X, Sparkles, Loader2 } from "lucide-react";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { APP_VERSION } from "@/generated/version";
import { isNative } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";

export function UpdateModal() {
  const { data } = useVersionInfo();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Track dismiss in React state only — Tauri's WebView2 persists sessionStorage
  // across app launches (same as localStorage), which would permanently suppress
  // the prompt. React state resets cleanly every time the binary starts.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!data || dismissed) return;
    // Only show update prompt inside the .exe — never on the website
    if (!isNative()) return;
    const { latestVersion } = data;
    if (!latestVersion) return;
    // Compare against the version burned into THIS binary — auto-clears
    // when the user installs the new .exe. No admin panel bump needed.
    const installedVersion = APP_VERSION || data.currentVersion;
    if (!installedVersion) return;
    if (compareVersions(latestVersion, installedVersion) <= 0) return;
    setOpen(true);
  }, [data, dismissed]);

  if (!data) return null;

  const dismiss = () => {
    setDismissed(true);
    setOpen(false);
  };

  const downloadUpdater = async () => {
    if (!data.updaterCmdUrl) return;
    setDownloading(true);
    try {
      // Always fetch through the server so Tauri WebView2 gets a blob: URL
      // (direct <a href="https://…"> clicks open the system browser in WebView2
      // instead of triggering an in-app download).
      const targetUrl = apiUrl(data.updaterCmdUrl);
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `OptiGods-Setup-${data.latestVersion ?? "latest"}.exe`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      dismiss();
    } catch {
      // Fallback — open in system browser so user can still get the file
      window.open(data.updaterCmdUrl, "_blank", "noopener,noreferrer");
      dismiss();
    } finally {
      setDownloading(false);
    }
  };

  const openUpdatePage = () => {
    if (!data.updatePageUrl) return;
    window.open(data.updatePageUrl, "_blank", "noopener,noreferrer");
    dismiss();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          data-testid="modal-update-available"
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0a0a0a] shadow-2xl shadow-red-900/40 overflow-hidden"
          >
            {/* Ambient glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-600/20 rounded-full blur-[80px] pointer-events-none" />

            <button
              type="button"
              onClick={dismiss}
              data-testid="button-update-dismiss-x"
              aria-label="Dismiss"
              className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-bold">
                    Update available
                  </p>
                  <h2
                    data-testid="text-update-title"
                    className="text-xl font-display font-bold text-white"
                  >
                    Opti Gods v{data.latestVersion}
                  </h2>
                </div>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                You're currently on{" "}
                <span className="text-zinc-200 font-mono">v{APP_VERSION || data.currentVersion}</span>
                . A newer version is available — install it to get the latest tweaks and fixes.
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={downloadUpdater}
                  disabled={!data.updaterCmdUrl || downloading}
                  data-testid="button-update-download-cmd"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-red-600/30 transition-colors"
                >
                  {downloading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
                    : data.updaterCmdUrl
                      ? <><Download className="w-4 h-4" /> Download installer</>
                      : "Updater not configured"
                  }
                </button>
                <button
                  type="button"
                  onClick={openUpdatePage}
                  disabled={!data.updatePageUrl}
                  data-testid="button-update-open-page"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open update page
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  data-testid="button-update-later"
                  className="w-full py-2 text-[11px] text-zinc-500 hover:text-zinc-300 font-semibold transition-colors"
                >
                  Later
                </button>
              </div>

              {data.updaterCmdUrl && (
                <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
                  Tip: the installer will save to your Downloads folder. Run it — Windows may show a SmartScreen prompt; click <span className="font-mono text-zinc-500">More info → Run anyway</span>.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
