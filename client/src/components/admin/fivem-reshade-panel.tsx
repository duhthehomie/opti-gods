import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  fivemReshadeInstall, fivemReshadeRemove, fivemReshadeStatus, isNative,
  type FivemReshadeOptions, type NativeFivemReshadeStatus,
} from "@/lib/tauri-bridge";

const AD_POSITIONS: Array<{ value: FivemReshadeOptions["ad_position"]; label: string }> = [
  { value: "bottom-center", label: "Bottom centre" },
  { value: "top-center", label: "Top centre" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Admin test panel for the one-click Opti Gods ReShade on FiveM. */
export function FivemReshadePanel() {
  const { toast } = useToast();
  const native = isNative();
  const [status, setStatus] = useState<NativeFivemReshadeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"install" | "remove" | null>(null);
  const [options, setOptions] = useState<FivemReshadeOptions>({ show_logo: true, show_ad: true, ad_position: "bottom-center" });

  const refresh = useCallback(async () => {
    if (!native) return;
    try {
      setStatus(await fivemReshadeStatus());
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, [native]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (action: "install" | "remove") => {
    setBusy(action);
    try {
      const next = action === "install" ? await fivemReshadeInstall(options) : await fivemReshadeRemove();
      setStatus(next);
      setError(null);
      toast({
        title: action === "install" ? "Opti Gods ReShade installed" : "Opti Gods ReShade removed",
        description: action === "install"
          ? "Open FiveM. Press Home in game to open ReShade and move or hide the overlay."
          : "FiveM is back to how it was. Any ReShade you had before was put back.",
      });
    } catch (e) {
      setError(message(e));
      toast({ title: action === "install" ? "Install failed" : "Remove failed", description: message(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-red-500/30 bg-black/50 p-4" data-testid="panel-fivem-reshade">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-bold text-white">FiveM ReShade — one click</h2>
        <span className="rounded bg-red-600/20 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-red-300">Admin test</span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Installs ReShade 6.8.0 into FiveM's plugins folder with the Opti Gods look (DPX, Technicolor, LumaSharpen) and the
        Opti Gods overlay. FiveM must be closed. Any ReShade already there is backed up and put back on remove.
      </p>

      {!native ? (
        <p className="mt-3 text-xs text-zinc-500">Open the Windows app to test this.</p>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs" data-testid="text-fivem-reshade-status">
            {!status ? (
              <span className="text-zinc-500">Checking FiveM…</span>
            ) : !status.fivem_found ? (
              <span className="text-red-300">FiveM was not found. Install FiveM and launch it once.</span>
            ) : (
              <div className="space-y-0.5">
                <div>
                  <span className={status.installed ? "font-bold text-emerald-400" : "font-bold text-zinc-300"}>
                    {status.installed ? `Installed · ReShade ${status.version}` : "Not installed"}
                  </span>
                  {status.fivem_running && <span className="ml-2 font-bold text-amber-300">FiveM is open — close it first</span>}
                </div>
                {status.other_reshade && <div className="text-amber-300">Another ReShade is in FiveM's plugins folder. It will be backed up, not deleted.</div>}
                <div className="truncate text-[10px] text-zinc-500">{status.plugins_dir}</div>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-200">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={options.show_logo} onChange={e => setOptions(o => ({ ...o, show_logo: e.target.checked }))} data-testid="checkbox-reshade-logo" />
              Opti Gods logo
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={options.show_ad} onChange={e => setOptions(o => ({ ...o, show_ad: e.target.checked }))} data-testid="checkbox-reshade-ad" />
              optigods.com banner
            </label>
            <label className="flex items-center gap-2">
              Banner position
              <select
                className="rounded border border-white/15 bg-black px-2 py-1 text-xs disabled:opacity-40"
                value={options.ad_position}
                disabled={!options.show_ad}
                onChange={e => setOptions(o => ({ ...o, ad_position: e.target.value as FivemReshadeOptions["ad_position"] }))}
                data-testid="select-reshade-ad-position"
              >
                {AD_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="bg-red-600 hover:bg-red-500" disabled={busy !== null || !status?.fivem_found} onClick={() => run("install")} data-testid="button-reshade-install">
              {busy === "install" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              {status?.installed ? "Reinstall with these options" : "Install Opti Gods ReShade"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null || !status?.installed} onClick={() => run("remove")} data-testid="button-reshade-remove">
              {busy === "remove" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Remove
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void refresh()} data-testid="button-reshade-refresh">Refresh</Button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-400" data-testid="text-reshade-error">{error}</p>}
          <p className="mt-2 text-[10px] text-zinc-500">In game, press Home to open ReShade: drag the overlay position sliders or untick the overlay. Some FiveM servers block ReShade — check a server's rules.</p>
        </>
      )}
    </div>
  );
}
