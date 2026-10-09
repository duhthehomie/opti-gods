import { useEffect, useState } from "react";
import { BRAND } from "./assets";

const SHOW_MS = 3500;
const FADE_MS = 500;

export function BootSplash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "fade">(() => {
    if (typeof window === "undefined") return "hidden";
    // Show the same short branded startup on the public website and in the app.
    return "show";
  });
  const [videoFailed, setVideoFailed] = useState(false);
  const [usingFirstPaint] = useState(() => typeof document !== "undefined" && Boolean(document.getElementById("og-first-paint-splash")));

  useEffect(() => {
    const firstPaintSplash = document.getElementById("og-first-paint-splash");
    if (!firstPaintSplash) return;
    // Keep one already-playing video; do not restart it behind another overlay.
    if (phase === "fade") firstPaintSplash.style.opacity = "0";
    if (phase === "hidden") firstPaintSplash.remove();
  }, [phase]);

  useEffect(() => {
    if (phase === "hidden") return;
    if (phase === "show") {
      const t = window.setTimeout(() => setPhase("fade"), SHOW_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "hidden" || usingFirstPaint) return null;

  return (
    <div
      data-testid="boot-splash"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black pointer-events-none"
      style={{
        opacity: phase === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      {videoFailed ? (
        /* CSS ring fallback — no white-background PNG */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              border: "6px solid rgba(255,30,30,0.18)",
              borderTopColor: "#ff1e1e",
              animation: "og-splash-spin 1.05s linear infinite",
              boxShadow: "0 0 60px rgba(255,30,30,0.45), inset 0 0 20px rgba(255,30,30,0.25)",
            }}
          />
          <div
            style={{
              fontWeight: 700,
              letterSpacing: "0.3em",
              fontSize: 13,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 0 12px rgba(255,30,30,0.5)",
            }}
          >
            Opti Gods
          </div>
          <style>{`@keyframes og-splash-spin { to { transform: rotate(360deg); } }`}</style>
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
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
