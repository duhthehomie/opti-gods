import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { useInstalledVersion } from "@/hooks/use-installed-version";
import { simpleUpdateNotes } from "@/lib/update-notes";
import { cn } from "@/lib/utils";
import { downloadAndRunInstaller, isNative } from "@/lib/tauri-bridge";
import { playOptimizationActionSound } from "@/lib/action-sound";
import { useToast } from "@/hooks/use-toast";
import WebsiteDownload from "@/components/website-download";

export default function Updates() {
  return isNative() ? <NativeUpdates /> : <WebsiteDownload />;
}

function NativeUpdates() {
  const { data, isError, isFetching, refetch } = useVersionInfo();
  const { version: installedVersion, error: installedError } = useInstalledVersion();
  const { toast } = useToast();
  const [downloadOpened, setDownloadOpened] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadError, setDownloadError] = useState("");
  const checking = !data || !installedVersion;
  const error = installedError || (isError ? "Could not check the latest GitHub release. Please try again." : null);
  const latestVersion = data?.latestVersion ?? null;
  const updateAvailable = !!installedVersion && !!latestVersion &&
    compareVersions(latestVersion, installedVersion) > 0;
  const newerBuild = !!installedVersion && !!latestVersion &&
    compareVersions(installedVersion, latestVersion) > 0;
  const notes = simpleUpdateNotes(data?.notes);

  async function downloadInstaller() {
    if (!updateAvailable || downloading) return;
    setDownloading(true);
    setDownloadError("");
    setDownloadPercent(0);
    try {
      // Downloads into Downloads, checks it against the release checksum and
      // opens the installer. Opti Gods then closes so setup can replace it.
      const result = await downloadAndRunInstaller(setDownloadPercent);
      setDownloadOpened(true);
      playOptimizationActionSound();
      toast({
        title: `Update v${result.version} downloaded`,
        description: "The installer is open. Opti Gods closes in a few seconds so setup can finish. Your settings and applied-tweak history are kept.",
      });
    } catch (failure) {
      const message = String(failure).replace(/^Error:\s*/, "");
      setDownloadError(message);
      toast({ title: "Update download failed", description: message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  const statusText = error ? "Update check needs attention." :
    checking ? "Checking release status…" :
    updateAvailable ? (downloading
      ? `Downloading v${latestVersion}… ${downloadPercent}%`
      : downloadOpened
      ? "Installer opened — finish setup there. Opti Gods closes in a few seconds."
      : `Update available · v${latestVersion}`) :
    newerBuild ? `You are up to date · v${installedVersion}` :
    `You are on the latest version · v${installedVersion}`;

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Software Updates</h1>
            <p className="mt-1 text-sm text-zinc-500">Check your installed version and get the latest Opti Gods release.</p>
          </div>
          <button
            type="button"
            onClick={() => { setDownloadOpened(false); setDownloadError(""); void refetch(); }}
            disabled={isFetching}
            data-testid="button-refresh-updates"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="update-center"
          className="rounded-2xl border border-red-500/25 bg-red-500/[0.035] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5">
                <Download className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Opti Gods Update Center</p>
                <h2 className="mt-1 text-lg font-black text-white">Software Updates</h2>
                <p className="mt-1 text-xs text-zinc-500">Keep Opti Gods current with security, stability, and compatibility fixes.</p>
              </div>
            </div>
            <span className={cn(
              "rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
              updateAvailable ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-white/10 text-zinc-300"
            )}>
              {error ? "Check unavailable" : checking ? "Checking" : updateAvailable ? "Update available" : newerBuild ? "Current version" : "Latest version"}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white" data-testid="update-status">{statusText}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Installed {installedVersion ? `v${installedVersion}` : "checking…"} · Latest {latestVersion ? `v${latestVersion}` : "checking…"}
                </p>
              </div>
              {!checking && !error && updateAvailable && (
                <button
                  type="button"
                  data-testid="button-download-install-update"
                  onClick={() => void downloadInstaller()}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {downloading ? `Downloading ${downloadPercent}%` : downloadOpened ? "Download and install again" : "Download and install"}
                </button>
              )}
              {checking && !error && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
            </div>
            {downloading && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10" data-testid="progress-installer-download">
                <div className="h-full bg-red-500 transition-all duration-200" style={{ width: `${downloadPercent}%` }} />
              </div>
            )}
            {downloadOpened && updateAvailable && !downloading && (
              <p className="mt-2 text-xs text-emerald-300" data-testid="text-installer-opened">Installer opened. Click Install, and Opti Gods reopens on the new version. Your settings and applied-tweak history are kept.</p>
            )}
            {downloadError && !downloading && (
              <p className="mt-2 text-xs text-red-400" role="alert" data-testid="text-installer-error">{downloadError}</p>
            )}
            {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
          </div>

          {data?.notes && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Latest release changes</p>
              <div className="grid gap-2 md:grid-cols-3">
                {notes.map(note => (
                  <div key={note} className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-zinc-300">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.section>
      </div>
    </AppLayout>
  );
}
