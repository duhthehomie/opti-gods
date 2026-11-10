import { useEffect, useState } from "react";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { BRAND } from "@/components/branding/assets";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { simpleUpdateNotes } from "@/lib/update-notes";
import { useInstalledVersion } from "@/hooks/use-installed-version";
import { checkForUpdate, downloadAndRunInstaller, isNative, performUpdate, type UpdateInfo } from "@/lib/tauri-bridge";
import { playOptimizationActionSound } from "@/lib/action-sound";

type Phase = "prompt" | "downloading" | "installing" | "done";

export function UpdateModal() {
  // A browser has no installed Windows version to update.
  return isNative() ? <NativeUpdateModal /> : null;
}

function NativeUpdateModal() {
  const { data } = useVersionInfo();
  const { version: installedVersion } = useInstalledVersion();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [nativeUpdate, setNativeUpdate] = useState<UpdateInfo | null>(null);
  const [installError, setInstallError] = useState("");
  const [videoFailed, setVideoFailed] = useState(false);
  const [detectedVersion, setDetectedVersion] = useState<string | null>(null);
  const [detectedNotes, setDetectedNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!data || dismissed) return;
    const { latestVersion } = data;
    if (!latestVersion) return;
    if (!installedVersion) return;
    if (compareVersions(latestVersion, installedVersion) <= 0) {
      setPhase(null);
      return;
    }

    setDetectedVersion(latestVersion);
    setDetectedNotes(data.notes ?? null);
    setPhase(current => current ?? "prompt");
  }, [data, dismissed, installedVersion]);

  // Ask the built-in updater whether this release can install itself (signed)
  // and use the release's own notes.
  useEffect(() => {
    if (phase !== "prompt" || nativeUpdate) return;
    let cancelled = false;
    void checkForUpdate().then(info => {
      if (cancelled || !info) return;
      setNativeUpdate(info);
      if (info.available && info.notes) setDetectedNotes(info.notes);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [phase, nativeUpdate]);

  const canAutoInstall = Boolean(nativeUpdate?.available && nativeUpdate.auto_install);

  async function installNow() {
    setInstallError("");
    setProgress(0);
    setPhase("downloading");
    try {
      // On success Windows closes Opti Gods, installs, and reopens the new version.
      await performUpdate((percent, installing) => {
        setProgress(percent);
        if (installing) setPhase("installing");
      });
      setPhase("done");
    } catch (error) {
      setInstallError(String(error).replace(/^Error:\s*/, ""));
      setPhase("prompt");
    }
  }

  // Releases that are not signed for automatic install: download the
  // checksum-verified installer and open it for the user.
  async function downloadAndInstall() {
    setInstallError("");
    setProgress(0);
    setPhase("downloading");
    try {
      await downloadAndRunInstaller(setProgress);
      playOptimizationActionSound();
      setPhase("done");
    } catch (error) {
      setInstallError(String(error).replace(/^Error:\s*/, ""));
      setPhase("prompt");
    }
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
            <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-red-400">What's included</p>
            <ul className="space-y-1">
              {simpleUpdateNotes(detectedNotes ?? data?.notes).slice(0, 6).map(note => (
                <li key={note} className="flex gap-1.5 text-[10px] leading-snug text-zinc-400">
                  <span className="text-red-400">•</span>{note}
                </li>
              ))}
            </ul>
          </div>

          {installError && (
            <p className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] leading-snug text-red-300" data-testid="text-update-error">
              Automatic update failed: {installError}
            </p>
          )}
          {!installError ? (
            <button
              data-testid="button-update-now"
              onClick={() => void (canAutoInstall ? installNow() : downloadAndInstall())}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-xs font-bold text-white transition-colors hover:bg-red-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {canAutoInstall ? "Update now" : "Download and install"}
            </button>
          ) : (
            <button
              data-testid="open-update-center"
              onClick={openUpdateCenter}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-xs font-bold text-white transition-colors hover:bg-red-500"
            >
              <Download className="h-3.5 w-3.5" />
              Open Update Center
            </button>
          )}
          {!installError && (
            <p className="-mt-2 text-center text-[9px] text-zinc-500">
              {canAutoInstall
                ? "Downloads, installs and reopens Opti Gods by itself. Windows will ask for permission once."
                : "Downloads the installer and opens it for you. Opti Gods closes so setup can finish."}
            </p>
          )}
          <p className="text-center text-[9px] text-zinc-600">
            Your saved settings and applied tweak history are protected.
          </p>
        </div>
      </div>
    );
  }

  // ── Progress / Done (full-screen, only after user consents) ─────────────────
  const headingText =
    phase === "done"       ? "Update downloaded" :
    phase === "installing" ? "Installing Update…" :
                             "Updating Opti Gods";

  const subText =
    phase === "downloading" ? "Downloading update…" :
    phase === "installing"  ? "Installing — please wait…" :
                              "The installer is open — click Install to finish";

  const versionLine =
    phase === "downloading" ? "This will only take a moment" :
    phase === "installing"  ? "Almost done — do not close the app" :
                              "Opti Gods closes in a few seconds so setup can replace it";

  const barWidth = phase === "done" ? 100 : progress;

  return (
    <div
      data-testid="update-splash"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden select-none"
      style={{
        background: "#000",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 650ms ease-out",
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      {/* Same full-screen red/white spinning splash as app launch. It plays even when
          Windows animations are off, matching the launch splash. */}
      {videoFailed ? (
        <div className="flex flex-col items-center gap-[18px]">
          <div
            style={{
              width: 200, height: 200, borderRadius: "50%",
              border: "6px solid rgba(255,30,30,0.18)", borderTopColor: "#ff1e1e",
              animation: "og-update-spin 1.05s linear infinite",
              boxShadow: "0 0 60px rgba(255,30,30,0.45), inset 0 0 20px rgba(255,30,30,0.25)",
            }}
          />
          <style>{`@keyframes og-update-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <video
          src={BRAND.spinRed}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-1.5 pb-[7vh] pt-16"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))" }}
      >
        <h1 className="text-[20px] font-black tracking-tight text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {phase === "done" ? (
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              {headingText}
            </span>
          ) : headingText}
        </h1>
        <p className="text-sm font-medium text-zinc-200">{subText}</p>
        <p className="text-xs text-zinc-400">{versionLine}</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-zinc-900/80">
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
