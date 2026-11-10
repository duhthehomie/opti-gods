import { useCallback, useEffect, useRef, useState } from "react";
import { Power, Radar, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { startVisiblePolling } from "@/lib/foreground-polling";
import { NowPlayingCard } from "./now-playing-card";
import {
  disableGamingMode, enableGamingMode, gamingModeStatus, isNative, type NativeGamingModeStatus,
} from "@/lib/tauri-bridge";

const ago = (ms: number, now: number) => {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
};

/**
 * Admin test switch for Gaming Mode. The work happens in a background agent
 * (scheduled task) that keeps running after Opti Gods is closed; this panel
 * only turns it on/off and shows what the agent reports.
 */
export function GamingModePanel() {
  const { toast } = useToast();
  const native = isNative();
  const [status, setStatus] = useState<NativeGamingModeStatus | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenErrorsRef = useRef<Set<string> | null>(null);
  const deadAgentReportedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await gamingModeStatus();
      if (!next) return;
      setStatus(next);
      setNow(Date.now());
      // Surface every new agent failure as a notification (skip ones present at first load).
      const keys = next.errors.map(item => `${item.at_ms}:${item.message}`);
      if (seenErrorsRef.current == null) {
        seenErrorsRef.current = new Set(keys);
      } else {
        for (const item of next.errors) {
          const key = `${item.at_ms}:${item.message}`;
          if (seenErrorsRef.current.has(key)) continue;
          seenErrorsRef.current.add(key);
          toast({ title: "Gaming Mode problem", description: item.message, variant: "destructive" });
        }
      }
      if (next.enabled && !next.agent_running && next.heartbeat_ms > 0) {
        if (!deadAgentReportedRef.current) {
          deadAgentReportedRef.current = true;
          toast({
            title: "Gaming Mode stopped responding",
            description: `It is switched on, but its background agent last reported ${ago(next.heartbeat_ms, Date.now())}. Turn it off and on again.`,
            variant: "destructive",
          });
        }
      } else {
        deadAgentReportedRef.current = false;
      }
    } catch (error) {
      toast({ title: "Could not read Gaming Mode status", description: String(error), variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (!native) return;
    return startVisiblePolling(refresh, 1000);
  }, [native, refresh]);

  const turnOn = async () => {
    setBusy("on");
    try {
      const next = await enableGamingMode();
      setStatus(next);
      seenErrorsRef.current = new Set(next.errors.map(item => `${item.at_ms}:${item.message}`));
      const game = next.games[0];
      toast({
        title: "Gaming Mode enabled",
        description: game
          ? `${game.name} is ${game.priority_verified ? "at High priority (verified)" : `at ${game.priority}`}. It stays on after you close Opti Gods.`
          : `Scanning ${next.processes_scanned} processes for a game. It stays on after you close Opti Gods.`,
        className: "border-emerald-500/40 bg-emerald-600 text-white",
      });
    } catch (error) {
      toast({ title: "Gaming Mode did not turn on", description: String(error), variant: "destructive" });
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async () => {
    setBusy("off");
    try {
      setStatus(await disableGamingMode());
      toast({ title: "Gaming Mode turned off", description: "Game and background app priorities were restored." });
    } catch (error) {
      toast({ title: "Gaming Mode did not turn off cleanly", description: String(error), variant: "destructive" });
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const on = Boolean(status?.enabled && status.agent_running);
  const broken = Boolean(status?.enabled && !status.agent_running);
  const games = status?.games ?? [];
  const lastError = status?.errors.at(-1);

  return (
    <div
      data-testid="panel-gaming-mode"
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-all duration-500",
        on
          ? "border-emerald-400/60 bg-gradient-to-br from-emerald-950/60 via-black to-red-950/50 shadow-[0_0_28px_rgba(16,185,129,0.35),0_0_44px_rgba(239,68,68,0.25)]"
          : broken
            ? "border-red-500/60 bg-red-950/30 shadow-[0_0_24px_rgba(239,68,68,0.3)]"
            : "border-zinc-800 bg-zinc-950",
      )}
    >
      {on && <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-emerald-500/5 via-transparent to-red-500/5" />}
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
            on ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : broken ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-zinc-800 bg-black text-zinc-600",
          )}>
            {broken ? <ShieldAlert className="h-6 w-6" /> : <Zap className={cn("h-6 w-6", on && "drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]")} />}
          </div>
          <div className="min-w-0">
            <div className={cn("text-[10px] font-bold uppercase tracking-widest", on ? "text-emerald-400" : broken ? "text-red-400" : "text-zinc-600")}>
              Gaming Mode · test
            </div>
            <h3 className={cn("text-lg font-display font-bold", on ? "text-white" : broken ? "text-red-200" : "text-zinc-400")} data-testid="text-gaming-mode-state">
              {busy === "on" ? "Turning on…" : busy === "off" ? "Turning off…" : on ? "Gaming Mode enabled" : broken ? "Gaming Mode not responding" : "Gaming Mode off"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {on
                ? `Scanning ${status?.processes_scanned ?? 0} processes every 2 s · last scan ${ago(status!.heartbeat_ms, now)} · keeps running when Opti Gods is closed`
                : broken
                  ? "Switched on, but the background agent is not reporting. Turn it off and on again."
                  : "Raises the running game to High priority and lowers background apps. Stays on until you turn it off."}
            </p>
          </div>
        </div>
        {native ? (
          <button
            type="button"
            data-testid={on || broken ? "button-disable-gaming-mode" : "button-enable-gaming-mode"}
            disabled={busy != null}
            onClick={() => void (on || broken ? turnOff() : turnOn())}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all disabled:cursor-wait disabled:opacity-60",
              on || broken
                ? "border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                : "border-emerald-400/60 bg-gradient-to-r from-emerald-600 to-red-600 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:brightness-110",
            )}
          >
            <Power className="h-4 w-4" />
            {on || broken ? "Turn off Gaming Mode" : "Enable Gaming Mode"}
          </button>
        ) : (
          <span className="text-[11px] text-amber-400">Windows app only</span>
        )}
      </div>

      {on && (
        <div className="relative mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-500/20 bg-black/40 px-3 py-2">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-500"><Radar className="h-3 w-3" />Active game</div>
            {games.length ? games.map(game => (
              <div key={game.pid} className="mt-1 text-sm" data-testid={`gaming-mode-game-${game.pid}`}>
                <span className="font-bold text-white">{game.name}</span>
                <span className={cn("ml-2 font-mono text-xs", game.priority_verified ? "text-emerald-400" : "text-red-400")}>
                  {game.priority_verified ? "High priority ✓" : `${game.priority} (not raised)`}
                </span>
                <div className="text-[10px] text-zinc-500">
                  PID {game.pid} · found by {game.detected_by} · power saving {game.power_throttling_off ? "off" : "not changed"}
                </div>
              </div>
            )) : <div className="mt-1 text-sm text-zinc-400">No game running yet. Open any game and it is boosted within 2 s.</div>}
          </div>
          <div className="rounded-lg border border-red-500/20 bg-black/40 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-red-400">Background apps</div>
            <div className="mt-1 space-y-0.5 text-xs text-zinc-300" data-testid="text-gaming-mode-lowered">
              {!games.length ? (
                <div className="text-zinc-400">Only while a game is running</div>
              ) : status?.apps?.length ? status.apps.map(app => {
                const done = [
                  app.lowered ? `${app.lowered} lowered` : "",
                  app.efficiency ? `${app.efficiency} efficiency mode` : "",
                  app.already_low ? `${app.already_low} already low` : "",
                ].filter(Boolean).join(" · ");
                return (
                  <div key={app.app} data-testid={`gaming-mode-app-${app.app.toLowerCase().replace(/\s+/g, "-")}`}>
                    <span className="font-bold text-white">{app.app}</span>
                    <span className="text-zinc-500"> ×{app.processes}</span>
                    {done && <span className="text-red-300"> · {done}</span>}
                    {app.note && <span className={app.note.startsWith("music") ? "text-emerald-400" : "text-zinc-500"}> · {app.note}</span>}
                  </div>
                );
              }) : status?.lowered.length
                ? Array.from(new Set(status.lowered)).map(name => `${name} ×${status.lowered.filter(item => item === name).length}`).join(" · ")
                : "No browsers, launchers or chat apps open"}
            </div>
            <div className="mt-1 text-[10px] text-zinc-600">
              {status?.efficiency_mode ? `${status.efficiency_mode} in Windows efficiency mode · ` : ""}Discord and OBS are never slowed, so calls and streams stay clean.
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-black/40 px-3 py-2 sm:col-span-2" data-testid="gaming-mode-music">
            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Music</div>
            <NowPlayingCard className="mt-1.5" />
            {status?.music?.length ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {status.music.map(item => (
                  <span
                    key={item.app}
                    className={cn(
                      "rounded border px-2 py-0.5 text-xs",
                      item.state === "playing" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : item.state === "unknown" ? "border-amber-500/40 text-amber-300" : "border-zinc-700 text-zinc-400",
                    )}
                  >
                    {item.app}: {item.state === "playing" ? "playing · audio kept at full speed" : item.state === "unknown" ? "can't check · not slowed down" : "paused · efficiency mode"}{item.source === "audio_activity" ? " (by audio activity)" : ""}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-xs text-zinc-400">{games.length ? "No Spotify, SoundCloud or browser open" : "Checked only while a game is running"}</div>
            )}
            <div className="mt-1 text-[10px] text-zinc-600">Play/pause is read instantly from Windows media controls while Opti Gods is open. With Opti Gods closed, audio activity is used instead. Firefox is never slowed down.</div>
          </div>
        </div>
      )}
      {lastError && (on || broken) && (
        <p className="relative mt-2 truncate text-[11px] text-red-400" title={lastError.message} data-testid="text-gaming-mode-error">
          Last problem ({ago(lastError.at_ms, now)}): {lastError.message}
        </p>
      )}
    </div>
  );
}
