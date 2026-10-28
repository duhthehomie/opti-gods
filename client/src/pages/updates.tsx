import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { useInstalledVersion } from "@/hooks/use-installed-version";
import { apiUrl } from "@/lib/api-base";
import { simpleUpdateNotes } from "@/lib/update-notes";
import { cn } from "@/lib/utils";

export default function Updates() {
  const { data, isError, isFetching, refetch } = useVersionInfo();
  const { version: installedVersion, error: installedError } = useInstalledVersion();
  const [downloadOpened, setDownloadOpened] = useState(false);
  const checking = !data || !installedVersion;
  const error = installedError || (isError ? "Could not check the latest GitHub release. Please try again." : null);
  const latestVersion = data?.latestVersion ?? null;
  const updateAvailable = !!installedVersion && !!latestVersion &&
    compareVersions(latestVersion, installedVersion) > 0;
  const newerBuild = !!installedVersion && !!latestVersion &&
    compareVersions(installedVersion, latestVersion) > 0;
  const notes = simpleUpdateNotes(data?.notes);

  function downloadInstaller() {
    if (!updateAvailable) return;
    // Published manifests are currently unsigned. Do not feed them into the
    // signature-required native updater or claim that a download was installed.
    const link = document.createElement("a");
    link.href = apiUrl(data?.updaterCmdUrl || "/api/download/latest");
    link.download = `OptiGods-Setup-${latestVersion}.exe`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setDownloadOpened(true);
  }

  const statusText = error ? "Update check needs attention." :
    checking ? "Checking release status…" :
    updateAvailable ? (downloadOpened
      ? "Installer download opened — run it to finish updating."
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
            onClick={() => { setDownloadOpened(false); void refetch(); }}
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
                  onClick={downloadInstaller}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-red-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadOpened ? "Download installer again" : "Download latest installer"}
                </button>
              )}
              {checking && !error && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
            </div>
            {downloadOpened && updateAvailable && (
              <p className="mt-2 text-xs text-zinc-400">Open the downloaded installer, finish setup, then reopen Opti Gods. Your settings and applied-tweak history are kept.</p>
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
