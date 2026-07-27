import { useEffect, useRef, useState } from "react";
import { BRAND } from "./assets";

const SESSION_KEY = "optigods_boot_splash_shown";
const SHOW_MS = 3500;
const FADE_MS = 500;

export function BootSplash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "fade">(() => {
    if (typeof window === "undefined") return "hidden";
    if (sessionStorage.getItem(SESSION_KEY)) return "hidden";
    return "show";
  });
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (phase === "hidden") return;
    if (phase === "show") {
      sessionStorage.setItem(SESSION_KEY, "1");
      const t = window.setTimeout(() => setPhase("fade"), SHOW_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

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
          ref={videoRef}
          src={BRAND.spinRed}
          autoPlay
          muted
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
