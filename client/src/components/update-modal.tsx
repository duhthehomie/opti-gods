import { useEffect, useRef, useState } from "react";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { APP_VERSION } from "@/generated/version";
import { isNative } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { BRAND, prefersReducedMotion } from "@/components/branding/assets";
import { CheckCircle2 } from "lucide-react";

type Phase = "detecting" | "downloading" | "done";

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
    // Only show inside the .exe — never on the website
    if (!isNative()) return;
    const { latestVersion } = data;
    if (!latestVersion) return;
    const installedVersion = APP_VERSION || data.currentVersion;
    if (!installedVersion) return;
    if (compareVersions(latestVersion, installedVersion) <= 0) return;

    // Update found — show splash, auto-start download after 1.8 s
    setPhase("detecting");
    const t = window.setTimeout(() => {
      if (!downloadStarted.current) {
        downloadStarted.current = true;
        triggerDownload();
      }
    }, 1800);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dismissed]);

  // Animate fake progress bar while downloading
  useEffect(() => {
    if (phase !== "downloading") return;
    setProgress(5);
    const tick = window.setInterval(() => {
      setProgress(p => {
        if (p >= 84) { window.clearInterval(tick); return 84; }
        return p + Math.random() * 3.5 + 0.5;
      });
    }, 160);
    return () => window.clearInterval(tick);
  }, [phase]);

  async function triggerDownload() {
    if (!data?.updaterCmdUrl) { dismiss(); return; }
    setPhase("downloading");
    try {
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
    } catch {
      window.open(data?.updaterCmdUrl, "_blank", "noopener,noreferrer");
    }
    setProgress(100);
    setPhase("done");
    // Auto-dismiss after showing "done" state
    window.setTimeout(dismiss, 3800);
  }

  function dismiss() {
    setFadeOut(true);
    window.setTimeout(() => setDismissed(true), 650);
  }

  if (!phase || dismissed) return null;

  const headingText =
    phase === "done" ? "Update Downloaded" : "Updating Opti Gods";

  const subText =
    phase === "detecting"   ? "Checking for updates..." :
    phase === "downloading" ? "Downloading update..." :
                              "Run the installer from your Downloads folder";

  const versionLine =
    phase === "detecting"
      ? `v${data?.latestVersion ?? ""} is available`
      : phase === "downloading"
      ? "This will only take a moment"
      : "Restart the app to apply the update";

  const barWidth =
    phase === "detecting"   ? 6 :
    phase === "done"        ? 100 :
                              progress;

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
      {/* Subtle red radial glow behind logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,38,38,0.13) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -62%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 mb-10 flex items-center justify-center">
        {reduced ? (
          <img
            src={BRAND.goldPng}
            alt="Opti Gods"
            className="w-40 h-40 object-contain"
            style={{ filter: "drop-shadow(0 0 32px rgba(220,38,38,0.55))" }}
          />
        ) : (
          <video
            ref={videoRef}
            src={BRAND.spinRed}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-56 h-56 object-contain"
          />
        )}
      </div>

      {/* Text block */}
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

      {/* Bottom progress bar — full width, pinned to very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-900/80">
        <div
          className="h-full bg-red-500 transition-all duration-300 ease-out"
          style={{
            width: `${barWidth}%`,
            boxShadow: barWidth > 0 ? "0 0 10px 1px rgba(239,68,68,0.75)" : "none",
          }}
        />
      </div>

      {/* Skip — only during detecting/downloading */}
      {phase !== "done" && (
        <button
          onClick={dismiss}
          data-testid="update-skip"
          className="absolute bottom-7 text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          Skip update
        </button>
      )}
    </div>
  );
}
