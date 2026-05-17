import { useEffect, useState } from "react";
import { Download, ExternalLink, X, Sparkles } from "lucide-react";
import { useAuth, useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

const SESSION_DISMISS_KEY = "optigods_update_dismissed_for";

export function UpdateModal() {
  const { isAuthenticated } = useAuth();
  const { data } = useVersionInfo();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !data) return;
    const { currentVersion, latestVersion } = data;
    if (!latestVersion || !currentVersion) return;
    if (compareVersions(latestVersion, currentVersion) <= 0) return;
    // Dismissed for this specific latest version?
    const dismissed = sessionStorage.getItem(SESSION_DISMISS_KEY);
    if (dismissed === latestVersion) return;
    setOpen(true);
  }, [isAuthenticated, data]);

  if (!data) return null;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, data.latestVersion);
    setOpen(false);
  };

  const downloadUpdater = () => {
    if (!data.updaterCmdUrl) return;
    // Trigger a real download — browser will save the .cmd to the user's
    // downloads folder. They run it manually (browsers will not auto-execute
    // .cmd files for safety).
    const a = document.createElement("a");
    a.href = data.updaterCmdUrl;
    a.download = `OptiGods-Update-${data.latestVersion}.cmd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    dismiss();
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
                <span className="text-zinc-200 font-mono">v{data.currentVersion}</span>
                . A newer version is available — install it to get the latest tweaks and fixes.
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={downloadUpdater}
                  disabled={!data.updaterCmdUrl}
                  data-testid="button-update-download-cmd"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-red-600/30 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {data.updaterCmdUrl
                    ? "Download & run updater"
                    : "Updater not configured"}
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
                  Tip: your browser will save the <span className="font-mono text-zinc-500">.cmd</span> file
                  to your Downloads folder. Double-click it to run the updater.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
