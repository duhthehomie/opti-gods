import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Music2, Pause, Play, SkipBack, SkipForward, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { startVisiblePolling } from "@/lib/foreground-polling";
import {
  isNative, mediaControl, readNowPlaying,
  type NativeMusicTab, type NativeNowPlaying, type NativeNowPlayingSession, type NativeVideoWatch,
} from "@/lib/tauri-bridge";
import { useToast } from "@/hooks/use-toast";

export const PLATFORM_COLORS: Record<string, string> = { Twitch: "#9146FF", Kick: "#53FC18", YouTube: "#FF0000" };

const BROWSER_EXES = new Set(["chrome.exe", "msedge.exe", "brave.exe", "opera.exe", "vivaldi.exe", "firefox.exe"]);
/** A paused player stays on screen this long so it can be resumed. */
const PAUSED_GRACE_MS = 30_000;

const norm = (text: string) => text.toLowerCase().replace(/^\(\d+\+?\)\s*/, "").replace(/[^a-z0-9\u00c0-\uffff]+/g, "");

const BROWSER_NAMES: Record<string, string> = { "chrome.exe": "Chrome", "msedge.exe": "Edge", "brave.exe": "Brave", "opera.exe": "Opera", "vivaldi.exe": "Vivaldi", "firefox.exe": "Firefox" };
const browserName = (exe: string) => BROWSER_NAMES[exe] ?? exe.replace(/\.exe$/, "");

/** "(tabbed in)" / "(tabbed out)" for a browser tab; null when unknown. */
export function tabLabel(active: boolean | undefined): string | null {
  if (active === undefined) return null;
  return active ? "tabbed in" : "tabbed out";
}

/** The Windows media session that belongs to a Twitch/Kick/YouTube tab, if any. */
function sessionForVideo(video: NativeVideoWatch, sessions: NativeNowPlayingSession[]): NativeNowPlayingSession | undefined {
  const channel = norm(video.channel);
  if (!channel) return undefined;
  return sessions.find(session => {
    if (session.exe && session.exe !== video.exe) return false;
    const artist = norm(session.artist);
    const title = norm(session.title);
    return (!!artist && (artist === channel || channel.includes(artist) || artist.includes(channel)))
      || (!!title && (title === channel || channel.includes(title) || title.includes(channel)));
  });
}

/** The music tab that a browser media session is playing from, if any. */
function tabForSession(session: NativeNowPlayingSession, tabs: NativeMusicTab[]): NativeMusicTab | undefined {
  const title = norm(session.title);
  if (!title || !session.exe || !BROWSER_EXES.has(session.exe)) return undefined;
  return tabs.find(tab => tab.exe === session.exe && norm(tab.title).includes(title));
}

type Row = {
  key: string;
  kind: "music" | "stream";
  /** "Now playing", "Watching Twitch", "Listening on SoundCloud". */
  label: string;
  color?: string;
  title: string;
  subtitle: string;
  cover: string | null;
  status: string | null;
  tab: string | null;
  sourceId: string | null;
  app: string;
};

/** Music and streams playing right now. Empty when nothing is playing. */
export function buildRows(state: NativeNowPlaying | null, recent: Map<string, number>, now: number): Row[] {
  if (!state) return [];
  const sessions = state.sessions.filter(session => session.title || session.artist);
  const videos = state.videos ?? [];
  const musicTabs = state.music_tabs ?? [];
  const rows: Row[] = [];
  const streamSessions = new Set<NativeNowPlayingSession>();
  const usedTabs = new Set<NativeMusicTab>();

  for (const video of videos) {
    const session = sessionForVideo(video, sessions);
    if (session) streamSessions.add(session);
    // Only streams that are actually playing: sound from the tab, or the
    // player reports playing. Firefox cannot say, so its showing tab counts.
    const playing = video.audible || session?.status === "playing" || (video.exe === "firefox.exe" && video.active);
    if (!playing) continue;
    rows.push({
      key: `stream-${video.exe}-${video.site}-${video.channel}`,
      kind: "stream",
      label: `Watching ${video.site}`,
      color: PLATFORM_COLORS[video.site],
      title: session?.title || video.channel,
      subtitle: [session?.title ? video.channel : "", session?.app || browserName(video.exe)].filter(Boolean).join(" · "),
      cover: session?.cover ?? null,
      status: session?.status ?? "playing",
      tab: tabLabel(video.active),
      sourceId: session?.source_id ?? null,
      app: session?.app || video.site,
    });
  }

  for (const session of sessions) {
    if (streamSessions.has(session)) continue;
    const key = `${session.source_id}\u0001${session.title}`;
    if (session.status === "playing") recent.set(key, now);
    const lastPlaying = recent.get(key);
    if (session.status !== "playing" && (lastPlaying === undefined || now - lastPlaying > PAUSED_GRACE_MS)) continue;
    const tab = tabForSession(session, musicTabs);
    if (tab) usedTabs.add(tab);
    rows.push({
      key: `music-${key}`,
      kind: "music",
      label: tab?.site ? `Listening on ${tab.site}` : "Now playing",
      title: session.title || "Unknown track",
      subtitle: [[session.artist, session.album].filter(Boolean).join(" · ") || "Unknown artist", session.app].join(" · "),
      cover: session.cover,
      status: session.status,
      tab: tab ? tabLabel(tab.active) : null,
      sourceId: session.source_id || null,
      app: session.app,
    });
  }

  // Music tabs Windows media controls are not showing (the browser reports
  // only one player at a time, e.g. the stream).
  for (const tab of musicTabs) {
    if (usedTabs.has(tab)) continue;
    rows.push({
      key: `tab-${tab.exe}-${tab.title}`,
      kind: "music",
      label: tab.site ? `Listening on ${tab.site}` : "Now playing",
      title: tab.title,
      subtitle: browserName(tab.exe),
      cover: null,
      status: "playing",
      tab: tabLabel(tab.active),
      sourceId: null,
      app: tab.site || "Browser",
    });
  }

  // Music first, then streams.
  return rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "music" ? -1 : 1));
}

/**
 * Gaming Mode's "Now playing" section: music (Spotify, SoundCloud and other
 * players, including browser tabs you are not looking at) and Twitch, Kick or
 * YouTube streams, each on its own row marked tabbed in or out. Renders
 * nothing at all while nothing is playing.
 */
export function NowPlayingSection({ className, children, footer }: { className?: string; children?: ReactNode; footer?: ReactNode }) {
  const native = isNative();
  const [state, setState] = useState<NativeNowPlaying | null>(null);
  const [error, setError] = useState("");
  const recentRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!native) return;
    return startVisiblePolling(async () => {
      try {
        const next = await readNowPlaying();
        setState(next);
        setError(next?.error ?? "");
      } catch (readError) {
        setError(String(readError));
      }
    }, 500);
  }, [native]);

  if (!native) return null;
  const rows = buildRows(state, recentRef.current, Date.now());
  if (!rows.length) return null;
  const hasMusic = rows.some(row => row.kind === "music");
  const hasStream = rows.some(row => row.kind === "stream");
  const heading = hasMusic && hasStream ? "Music & streams" : hasStream ? "Watching" : "Music";

  return (
    <div className={cn("rounded-lg border border-emerald-500/20 bg-black/40 px-3 py-2", className)} data-testid="gaming-mode-music">
      <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500" data-testid="text-now-playing-heading">{heading}</div>
      <div className="mt-1.5 space-y-1.5">
        {rows.map(row => (
          <MediaRow key={row.key} row={row} onChanged={setState} />
        ))}
      </div>
      {error && <div className="mt-1 truncate text-[10px] text-amber-400">{error}</div>}
      {children}
      {footer}
    </div>
  );
}

function MediaRow({ row, onChanged }: { row: Row; onChanged: (next: NativeNowPlaying | null) => void }) {
  const [sending, setSending] = useState<"toggle" | "next" | "previous" | null>(null);
  const { toast } = useToast();
  const playing = row.status === "playing";
  const accent = row.kind === "stream" ? row.color ?? "#ef4444" : undefined;

  const control = async (action: "toggle" | "next" | "previous") => {
    if (!row.sourceId || sending) return;
    setSending(action);
    try {
      await mediaControl(row.sourceId, action);
      onChanged(await readNowPlaying());
    } catch (controlError) {
      toast({ title: `${row.app} did not respond`, description: String(controlError), variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  return (
    <div
      data-testid={row.kind === "stream" ? "card-now-watching" : "card-now-playing"}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-lg border bg-black/40 p-2 pr-3 transition-colors duration-300",
        !accent && (playing ? "border-red-500/40" : "border-white/10"),
      )}
      style={accent ? { borderColor: `${accent}66` } : undefined}
    >
      {row.cover && (
        <div
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-0 scale-125 bg-cover bg-center blur-2xl transition-opacity duration-500", playing ? "opacity-25" : "opacity-10")}
          style={{ backgroundImage: `url(${row.cover})` }}
        />
      )}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900">
        {row.cover ? (
          <img src={row.cover} alt="" className={cn("h-full w-full object-cover transition-all duration-300", !playing && "grayscale-[60%] opacity-70")} data-testid="img-now-playing-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={accent ? { color: accent } : undefined}>
            {row.kind === "stream" ? <Tv className="h-6 w-6" /> : <Music2 className="h-6 w-6 text-zinc-600" />}
          </div>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
          <span className={cn(!accent && (playing ? "text-red-400" : "text-zinc-500"))} style={accent ? { color: accent } : undefined} data-testid="text-now-playing-label">
            {row.label}
          </span>
          {row.status && (
            <span
              data-testid="status-now-playing"
              className={cn(
                "flex items-center gap-1 rounded border px-1.5 py-px",
                playing ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400",
              )}
            >
              {playing ? <Play className="h-2.5 w-2.5 fill-current" /> : <Pause className="h-2.5 w-2.5" />}
              {playing ? (row.kind === "stream" ? "Live" : "Playing") : row.status === "paused" ? "Paused" : row.status}
            </span>
          )}
          {row.tab && (
            <span className={cn("rounded border px-1.5 py-px normal-case tracking-normal", row.tab === "tabbed in" ? "border-white/30 text-white" : "border-zinc-700 text-zinc-400")} data-testid="text-now-playing-tab">
              ({row.tab})
            </span>
          )}
        </div>
        <div className="truncate text-sm font-bold text-white" data-testid="text-now-playing-title" title={row.title}>{row.title}</div>
        <div className="truncate text-xs text-zinc-400" data-testid="text-now-playing-artist">{row.subtitle}</div>
      </div>
      {row.sourceId && (
        <div className="relative flex items-center gap-1">
          {row.kind === "music" && (
            <button type="button" onClick={() => control("previous")} disabled={!!sending} title="Previous track" data-testid="button-media-previous"
              className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">
              {sending === "previous" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipBack className="h-4 w-4" />}
            </button>
          )}
          <button type="button" onClick={() => control("toggle")} disabled={!!sending} title={playing ? "Pause" : "Play"} data-testid="button-media-toggle"
            className="rounded-full bg-red-600 p-2 text-white transition-colors hover:bg-red-500 disabled:opacity-50">
            {sending === "toggle" ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          {row.kind === "music" && (
            <button type="button" onClick={() => control("next")} disabled={!!sending} title="Next track" data-testid="button-media-next"
              className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">
              {sending === "next" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
      {playing && (
        <div className="relative flex h-6 items-end gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3].map(bar => (
            <span key={bar} className="w-1 rounded-sm" style={{ background: accent ?? "#ef4444", height: "100%", transformOrigin: "bottom", animation: `og-eq 0.9s ${bar * 0.15}s ease-in-out infinite alternate` }} />
          ))}
          <style>{"@keyframes og-eq { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }"}</style>
        </div>
      )}
    </div>
  );
}
