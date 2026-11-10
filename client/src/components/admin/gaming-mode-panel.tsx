import { useCallback, useEffect, useRef, useState } from "react";
import { Power, Radar, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { startVisiblePolling } from "@/lib/foreground-polling";
import { NowPlayingCard } from "./now-playing-card";
import {
  disableGamingMode, enableGamingMode, gamingModeStatus, isNative, readForegroundApp, readNowPlaying,
  type NativeForegroundApp, type NativeGamingModeStatus, type NativeLiveStream, type NativeVideoWatch,
} from "@/lib/tauri-bridge";
import { useAuth } from "@/hooks/use-auth";

const PLATFORM_COLORS: Record<string, string> = { Twitch: "#9146FF", Kick: "#53FC18", YouTube: "#FF0000" };

const ago = (ms: number, now: number) => {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
};

/**
 * Admin test switch for Gaming Mode. The work happens in a background agent
 * (scheduled task) that keeps running after Opti Gods is closed; this panel
 * only turns it on/off and shows what the agent reports.
 */
export interface GamingModeFivemInfo {
  /** "server" | "main_menu" | null (not known yet) */
  state: string | null;
  /** Server name or menu text from the live recorder. */
  label: string;
}

export function GamingModePanel({ fivem = null }: { fivem?: GamingModeFivemInfo | null }) {
  const { toast } = useToast();
  const native = isNative();
  const [status, setStatus] = useState<NativeGamingModeStatus | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenErrorsRef = useRef<Set<string> | null>(null);
  const deadAgentReportedRef = useRef(false);
  const { user } = useAuth();
  // Live voice-call state straight from the app (works even with no game running).
  const [discordCall, setDiscordCall] = useState<boolean | null>(null);
  // Live stream (OBS/Streamlabs log) and Twitch/Kick/YouTube windows, from the app.
  const [live, setLive] = useState<NativeLiveStream | null>(null);
  const [videos, setVideos] = useState<NativeVideoWatch[]>([]);
  useEffect(() => {
    if (!native) return;
    return startVisiblePolling(async () => {
      try {
        const next = await readNowPlaying();
        setDiscordCall(next?.discord_call ?? null);
        setLive(next?.live ?? null);
        setVideos(next?.videos ?? []);
      } catch {
        setDiscordCall(null);
        setLive(null);
        setVideos([]);
      }
    }, 1000);
  }, [native]);

  // Which app is in front, to show whether the game is tabbed in or out.
  const [foreground, setForeground] = useState<NativeForegroundApp | null>(null);
  const [foregroundError, setForegroundError] = useState<string | null>(null);
  useEffect(() => {
    if (!native) return;
    return startVisiblePolling(async () => {
      try {
        setForeground(await readForegroundApp());
        setForegroundError(null);
      } catch (error) {
        setForeground(null);
        setForegroundError(String(error));
      }
    }, 500);
  }, [native]);

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
    return startVisiblePolling(refresh, 500);
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
  const isFiveM = (name: string) => /^fivem/i.test(name);
  // FiveM switches between its launcher and game processes; any FiveM window in front counts.
  const tabbedIn = (game: { pid: number; name: string }) => Boolean(
    foreground && foreground.pid > 0 && (foreground.pid === game.pid || (isFiveM(game.name) && isFiveM(foreground.exe))),
  );
  const anyTabbedIn = games.some(tabbedIn);
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
          <div
            data-testid="card-gaming-mode-active-game"
            className={cn(
              "rounded-lg border px-3 py-2 transition-all duration-300",
              anyTabbedIn
                ? "border-red-500 bg-red-950/50 shadow-[0_0_22px_rgba(239,68,68,0.6),inset_0_0_18px_rgba(239,68,68,0.25)] ring-1 ring-red-500/60"
                : "border-emerald-500/20 bg-black/40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className={cn("flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest", anyTabbedIn ? "text-red-400" : "text-emerald-500")}><Radar className="h-3 w-3" />Active game</div>
              {games.length > 0 && (foregroundError ? (
                <span className="text-[9px] text-amber-400" title={foregroundError} data-testid="text-gaming-mode-tab-error">Tab state unavailable</span>
              ) : anyTabbedIn ? (
                <span data-testid="badge-gaming-mode-tabbed-in" className="flex items-center gap-1.5 rounded-md border border-red-400 bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_14px_rgba(239,68,68,0.9)]">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />Tabbed in
                </span>
              ) : (
                <span data-testid="badge-gaming-mode-tabbed-out" className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Tabbed out
                </span>
              ))}
            </div>
            {games.length ? games.map(game => (
              <div key={game.pid} className="mt-1 text-sm" data-testid={`gaming-mode-game-${game.pid}`}>
                <span className={cn("font-bold", tabbedIn(game) ? "text-red-100 drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]" : "text-white")}>{/^fivem_/i.test(game.name) ? "FiveM" : game.name.replace(/\.exe$/i, "")}</span>
                <span className={cn("ml-2 font-mono text-xs", game.priority_verified ? "text-emerald-400" : "text-red-400")}>
                  {game.priority_verified ? "High priority ✓" : `${game.priority} (not raised)`}
                </span>
                {/^fivem_/i.test(game.name) && (
                  <div className="text-xs" data-testid="text-gaming-mode-fivem-state">
                    {fivem?.state === "server"
                      ? <span className="text-emerald-300">On server · <span className="font-bold text-white">{fivem.label}</span></span>
                      : fivem?.state === "main_menu"
                        ? <span className="text-zinc-300">In the main menu (not on a server)</span>
                        : <span className="text-zinc-500">Checking server or menu…</span>}
                  </div>
                )}
                <div className="text-[10px] text-zinc-500">
                  {game.name} · PID {game.pid} · found by {game.detected_by} · power saving {game.power_throttling_off ? "off" : "not changed"}
                </div>
              </div>
            )) : <div className="mt-1 text-sm text-zinc-400">No game running yet. Open any game and it is boosted within 2 s.</div>}
          </div>
          <div className="rounded-lg border border-red-500/20 bg-black/40 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-red-400">Background apps</div>
            {discordCall && (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1" data-testid="gaming-mode-discord-call">
                <div className="relative h-6 w-6 shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-2 ring-emerald-500" data-testid="img-discord-call-avatar" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5865F2] text-[10px] font-bold text-white ring-2 ring-emerald-500">
                      {(user?.globalName || user?.username || "D").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full border border-black bg-emerald-400" />
                </div>
                <div className="min-w-0 text-xs">
                  <span className="font-bold text-white">Discord</span>
                  <span className="text-emerald-300"> · in a voice call</span>
                  <div className="text-[10px] text-zinc-400">
                    {games.length ? "Voice raised to Above Normal so it stays clear while you play" : "Voice gets priority as soon as a game starts"}
                  </div>
                </div>
              </div>
            )}
            {live && (
              <div className="mt-1 flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: `${PLATFORM_COLORS[live.platform] ?? "#ef4444"}66`, background: `${PLATFORM_COLORS[live.platform] ?? "#ef4444"}1a` }} data-testid="gaming-mode-live">
                <div className="relative h-6 w-6 shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: PLATFORM_COLORS[live.platform] ?? "#ef4444" }} data-testid="img-live-avatar" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: PLATFORM_COLORS[live.platform] ?? "#ef4444" }}>
                      {(user?.globalName || user?.username || "L").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full border border-black bg-red-500" />
                </div>
                <div className="min-w-0 text-xs">
                  <span className="rounded bg-red-600 px-1 py-px text-[9px] font-black uppercase tracking-wider text-white">Live</span>
                  <span className="ml-1.5 font-bold text-white">{live.platform ? `on ${live.platform}` : "streaming"}</span>
                  <span className="text-zinc-300"> · {games.length ? "being optimized" : "optimized as soon as a game starts"}</span>
                  <div className="text-[10px] text-zinc-400">
                    Game at High, background apps slowed. {live.app} is never changed — your stream settings stay exactly as you set them.
                  </div>
                </div>
              </div>
            )}
            {videos.length > 0 && (
              <div className="mt-1 space-y-0.5" data-testid="gaming-mode-watching">
                {videos.map(video => (
                  <div key={`${video.exe}-${video.site}-${video.channel}`} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" style={{ borderColor: `${PLATFORM_COLORS[video.site] ?? "#71717a"}55` }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PLATFORM_COLORS[video.site] ?? "#71717a" }} />
                    <span className="min-w-0 truncate">
                      <span className="font-bold text-white">Watching {video.site}</span>
                      <span className="text-zinc-400"> · {video.channel}</span>
                      <span className="text-emerald-400"> · {games.length ? "video kept at full speed" : "kept at full speed while you play"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 space-y-0.5 text-xs text-zinc-300" data-testid="text-gaming-mode-lowered">
              {!games.length ? (
                <div className="text-zinc-400">Only while a game is running</div>
              ) : status?.apps?.length ? status.apps.filter(app => !(discordCall && app.app === "Discord")).map(app => {
                const optimized = app.lowered + app.efficiency > 0;
                const counts = app.tabs
                  ? `${app.tabs} tab${app.tabs === 1 ? "" : "s"} open`
                  : `${app.processes} process${app.processes === 1 ? "" : "es"}`;
                return (
                  <div key={app.app} data-testid={`gaming-mode-app-${app.app.toLowerCase().replace(/\s+/g, "-")}`}>
                    <span className="font-bold text-white">{app.app}</span>
                    <span className="text-zinc-400"> · {counts}</span>
                    {optimized && <span className="text-red-300"> · being optimized</span>}
                    {app.note && <span className={app.note.startsWith("music") ? "text-emerald-400" : "text-zinc-500"}> · {app.note}</span>}
                    {optimized && (
                      <div className="text-[10px] text-zinc-600">
                        {[
                          app.lowered ? `${app.lowered} lowered priority` : "",
                          app.efficiency ? `${app.efficiency} in efficiency mode` : "",
                          app.already_low ? `${app.already_low} already low` : "",
                        ].filter(Boolean).join(" · ")} of {app.processes} processes
                      </div>
                    )}
                  </div>
                );
              }) : status?.lowered.length
                ? Array.from(new Set(status.lowered)).map(name => `${name} ×${status.lowered.filter(item => item === name).length}`).join(" · ")
                : "No browsers, launchers or chat apps open"}
            </div>
            <div className="mt-1 text-[10px] text-zinc-600">
              {status?.efficiency_mode ? `${status.efficiency_mode} in Windows efficiency mode · ` : ""}Discord, OBS and Streamlabs are never slowed or changed. In a Discord call, Discord gets extra priority so voice stays clear. Twitch, Kick and YouTube windows on any monitor are kept at full speed (Windows can't show which quality the player picked).
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
              <div className="mt-1 text-xs text-zinc-400">{games.length ? "No Spotify, SoundCloud or browser open" : "Music apps are slowed or protected only while a game is running"}</div>
            )}
            <div className="mt-1 text-[10px] text-zinc-600">Now Playing and its controls work any time, with or without a game. While a game runs, the song that is playing stays at full speed and paused players are slowed. With Opti Gods closed, audio activity is used instead. Firefox is never slowed down.</div>
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
