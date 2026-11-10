import { useEffect, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { startVisiblePolling } from "@/lib/foreground-polling";
import { isNative, readNowPlaying, type NativeNowPlaying } from "@/lib/tauri-bridge";

/**
 * What's playing right now, from Windows media controls (Spotify, SoundCloud,
 * YouTube and other browser players). Updates within half a second of
 * play/pause. Read-only.
 */
export function NowPlayingCard({ className }: { className?: string }) {
  const native = isNative();
  const [state, setState] = useState<NativeNowPlaying | null>(null);
  const [error, setError] = useState("");

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
  const session = state?.sessions.find(item => item.title || item.artist) ?? state?.sessions[0];
  const playing = session?.status === "playing";

  return (
    <div
      data-testid="card-now-playing"
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-lg border bg-black/40 p-2 pr-3 transition-colors duration-300",
        playing ? "border-red-500/40" : "border-white/10",
        className,
      )}
    >
      {session?.cover && (
        <div
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-0 scale-125 bg-cover bg-center blur-2xl transition-opacity duration-500", playing ? "opacity-25" : "opacity-10")}
          style={{ backgroundImage: `url(${session.cover})` }}
        />
      )}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900">
        {session?.cover ? (
          <img src={session.cover} alt="" className={cn("h-full w-full object-cover transition-all duration-300", !playing && "grayscale-[60%] opacity-70")} data-testid="img-now-playing-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600"><Music2 className="h-6 w-6" /></div>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
          <span className={playing ? "text-red-400" : "text-zinc-500"}>Now playing</span>
          {session && (
            <span
              data-testid="status-now-playing"
              className={cn(
                "flex items-center gap-1 rounded border px-1.5 py-px",
                playing ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400",
              )}
            >
              {playing ? <Play className="h-2.5 w-2.5 fill-current" /> : <Pause className="h-2.5 w-2.5" />}
              {playing ? "Playing" : session.status === "paused" ? "Paused" : session.status}
            </span>
          )}
        </div>
        {session ? (
          <>
            <div className="truncate text-sm font-bold text-white" data-testid="text-now-playing-title" title={session.title}>{session.title || "Unknown track"}</div>
            <div className="truncate text-xs text-zinc-400" data-testid="text-now-playing-artist">
              {[session.artist, session.album].filter(Boolean).join(" · ") || "Unknown artist"}
              <span className="text-zinc-600"> · {session.app}</span>
            </div>
          </>
        ) : (
          <div className="mt-1 text-xs text-zinc-500">{error || "Nothing playing. Start Spotify, SoundCloud or a browser player."}</div>
        )}
        {session && error && <div className="truncate text-[10px] text-amber-400">{error}</div>}
      </div>
      {playing && (
        <div className="relative flex h-6 items-end gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3].map(bar => (
            <span key={bar} className="w-1 rounded-sm bg-red-500" style={{ height: "100%", animation: `og-eq 0.9s ${bar * 0.15}s ease-in-out infinite alternate` }} />
          ))}
          <style>{"@keyframes og-eq { from { transform: scaleY(0.25); } to { transform: scaleY(1); } } [data-testid='card-now-playing'] span[style*='og-eq'] { transform-origin: bottom; }"}</style>
        </div>
      )}
    </div>
  );
}
