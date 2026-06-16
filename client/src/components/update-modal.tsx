import { useEffect, useRef, useState } from "react";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { APP_VERSION } from "@/generated/version";
import { isNative, performUpdate } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { BRAND, prefersReducedMotion } from "@/components/branding/assets";
import { CheckCircle2, Download, X } from "lucide-react";

type Phase = "prompt" | "downloading" | "installing" | "done";

export function UpdateModal() {
  const { data } = useVersionInfo();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();
  const downloadStarted = useRef(false);

  useEffect(() => {
    if (!data || dismissed) return;
    if (!isNative()) return;
    const { latestVersion } = data;
    if (!latestVersion) return;
    const installedVersion = APP_VERSION || data.currentVersion;
    if (!installedVersion) return;
    if (compareVersions(latestVersion, installedVersion) <= 0) return;

    // Update found — show the prompt, do NOT auto-start
    setPhase("prompt");
  }, [data, dismissed]);

  async function triggerUpdate() {
    if (downloadStarted.current) return;
    downloadStarted.current = true;
    setPhase("downloading");
    setProgress(5);

    try {
      await performUpdate((pct: number, installing: boolean) => {
        if (installing) {
          setPhase("installing");
          setProgress(100);
        } else {
          setProgress(Math.max(5, pct));
        }
      });
      setProgress(100);
      setPhase("done");
      window.setTimeout(dismiss, 3000);
    } catch (err) {
      console.warn("[update] native updater failed, using download fallback:", err);
      fallbackDownload();
    }
  }

  function fallbackDownload() {
    if (!data?.updaterCmdUrl) { dismiss(); return; }
    const targetUrl = apiUrl(data.updaterCmdUrl);
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = `OptiGods-Setup-${data.latestVersion ?? "latest"}.exe`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setProgress(100);
    setPhase("done");
    window.setTimeout(dismiss, 3000);
  }

  function dismiss() {
    setFadeOut(true);
    window.setTimeout(() => { setDismissed(true); downloadStarted.current = false; }, 650);
  }

  if (!phase || dismissed) return null;

  // ── Prompt (ask before doing anything) ──────────────────────────────────────
  if (phase === "prompt") {
    return (
      <div
        data-testid="update-prompt"
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(6px)",
          opacity: fadeOut ? 0 : 1,
          transition: "opacity 400ms ease-out",
        }}
      >
        <div
          className="relative w-[340px] rounded-2xl border border-white/8 bg-zinc-950 shadow-2xl p-6 flex flex-col items-center gap-4"
          style={{ boxShadow: "0 0 60px 0 rgba(220,38,38,0.12), 0 24px 48px rgba(0,0,0,0.7)" }}
        >
          {/* Close / Later */}
          <button
            data-testid="update-dismiss"
            onClick={dismiss}
            className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-400 transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Logo */}
          <img
            src={BRAND.goldPng}
            alt="Opti Gods"
            className="w-16 h-16 object-contain"
            style={{ filter: "drop-shadow(0 0 18px rgba(220,38,38,0.5))" }}
          />

          <div className="text-center space-y-1">
            <h2 className="text-base font-black text-white tracking-tight">Update Available</h2>
            <p className="text-sm text-zinc-400">
              v{data?.latestVersion} is ready to install
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Your current version: v{APP_VERSION || data?.currentVersion}
            </p>
          </div>

          <div className="flex gap-2 w-full mt-1">
            <button
              data-testid="update-later"
              onClick={dismiss}
              className="flex-1 h-9 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
            >
              Later
            </button>
            <button
              data-testid="update-now"
              onClick={triggerUpdate}
              className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 border border-red-500/30 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Update Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Progress / Done (full-screen, only after user consents) ─────────────────
  const headingText =
    phase === "done"       ? "Update Downloaded" :
    phase === "installing" ? "Installing Update…" :
                             "Updating Opti Gods";

  const subText =
    phase === "downloading" ? "Downloading update…" :
    phase === "installing"  ? "Installing — please wait…" :
                              "Restart the app to apply the update";

  const versionLine =
    phase === "downloading" ? "This will only take a moment" :
    phase === "installing"  ? "Almost done — do not close the app" :
                              "The app will restart automatically";

  const barWidth = phase === "done" ? 100 : progress;

  return (
    <div
      data-testid="update-splash"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none"
      style={{
        background: "#050505",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 650ms ease-out",
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          width: 520, height: 520, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,38,38,0.13) 0%, transparent 70%)",
          top: "50%", left: "50%", transform: "translate(-50%, -62%)",
        }}
      />

      <div className="relative z-10 mb-10 flex items-center justify-center">
        {reduced ? (
          <img src={BRAND.goldPng} alt="Opti Gods" className="w-40 h-40 object-contain"
            style={{ filter: "drop-shadow(0 0 32px rgba(220,38,38,0.55))" }} />
        ) : (
          <video ref={videoRef} src={BRAND.spinRed} autoPlay muted loop playsInline
            preload="metadata" className="w-56 h-56 object-contain" />
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 mb-12">
        <h1 className="text-[22px] font-black tracking-tight text-white">
          {phase === "done" ? (
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              {headingText}
            </span>
          ) : headingText}
        </h1>
        <p className="text-sm text-zinc-400 font-medium">{subText}</p>
        <p className="text-xs text-zinc-600">{versionLine}</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-900/80">
        <div
          className="h-full bg-red-500 transition-all duration-300 ease-out"
          style={{
            width: `${barWidth}%`,
            boxShadow: barWidth > 0 ? "0 0 10px 1px rgba(239,68,68,0.75)" : "none",
          }}
        />
      </div>
    </div>
  );
}
