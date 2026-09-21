import { useEffect, useRef, useState } from "react";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { APP_VERSION } from "@/generated/version";
import { checkForUpdate, isNative, performUpdate } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { BRAND, prefersReducedMotion } from "@/components/branding/assets";
import { CheckCircle2, Download } from "lucide-react";
import { simpleUpdateNotes } from "@/lib/update-notes";

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
  const updateCheckStarted = useRef(false);
  const [detectedVersion, setDetectedVersion] = useState<string | null>(null);
  const [detectedNotes, setDetectedNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!data || dismissed) return;
    if (isNative()) return;
    const { latestVersion } = data;
    if (!latestVersion) return;
    const installedVersion = APP_VERSION || data.currentVersion;
    if (!installedVersion) return;
    if (compareVersions(latestVersion, installedVersion) <= 0) return;

    setDetectedNotes(data.notes ?? null);
    setPhase("prompt");
  }, [data, dismissed]);

  useEffect(() => {
    if (!isNative() || dismissed || updateCheckStarted.current) return;
    updateCheckStarted.current = true;

    void checkForUpdate()
      .then((update) => {
        if (!update?.available) return;
        setDetectedVersion(update.latest_version);
        setDetectedNotes(update.notes);
        setPhase("prompt");
      })
      .catch((error) => {
        console.warn("[update] automatic update check failed:", error);
      });
  }, [dismissed]);

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
      window.setTimeout(() => setDismissed(true), 3000);
    } catch (err) {
      console.warn("[update] native updater failed, using download fallback:", err);
      fallbackDownload();
    }
  }

  function fallbackDownload() {
    const targetUrl = apiUrl(data?.updaterCmdUrl || "/api/download/latest");
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = `OptiGods-Setup-${detectedVersion ?? data?.latestVersion ?? "latest"}.exe`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setProgress(100);
    setPhase("done");
    window.setTimeout(() => setDismissed(true), 3000);
  }

  function openUpdateCenter() {
    setFadeOut(true);
    window.setTimeout(() => {
      setDismissed(true);
      window.history.pushState({}, "", "/updates");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, 250);
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
          {/* Logo */}
          <img
            src={BRAND.goldPng}
            alt="Opti Gods"
            className="w-16 h-16 object-contain"
            style={{ filter: "drop-shadow(0 0 18px rgba(220,38,38,0.5))" }}
          />

          <div className="text-center space-y-1">
            <h2 className="text-base font-black text-white tracking-tight">A new Opti Gods build is ready</h2>
            <p className="text-sm text-zinc-400">
              Required update · v{detectedVersion ?? data?.latestVersion ?? "latest"}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Update now to continue using Opti Gods.
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2">
            {[
              ["Protected", "Your settings stay intact"],
              ["Verified", "Delivered by Opti Gods"],
              ["Required", "Keeps every build current"],
            ].map(([label, copy]) => (
              <div key={label} className="rounded-lg border border-white/8 bg-white/[0.02] px-2 py-2 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-300">{label}</p>
                <p className="mt-1 text-[8px] leading-tight text-zinc-600">{copy}</p>
              </div>
            ))}
          </div>

          <div className="w-full rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2.5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-red-400">What changed</p>
            <ul className="space-y-1">
              {simpleUpdateNotes(detectedNotes ?? data?.notes).slice(0, 3).map(note => (
                <li key={note} className="flex gap-1.5 text-[10px] leading-snug text-zinc-400">
                  <span className="text-red-400">•</span>{note}
                </li>
              ))}
            </ul>
          </div>

          <button
            data-testid="open-update-center"
            onClick={openUpdateCenter}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-xs font-bold text-white transition-colors hover:bg-red-500"
          >
            <Download className="h-3.5 w-3.5" />
            Open Update Center
          </button>
          <p className="text-center text-[9px] text-zinc-600">
            Your saved settings and applied tweak history are protected.
          </p>
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
