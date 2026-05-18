import { useEffect, useRef, useState } from "react";
import { BRAND, prefersReducedMotion } from "./assets";

const SESSION_KEY = "optigods_boot_splash_shown";
const SHOW_MS = 1500;
const FADE_MS = 350;

export function BootSplash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "fade">(() => {
    if (typeof window === "undefined") return "hidden";
    if (sessionStorage.getItem(SESSION_KEY)) return "hidden";
    return "show";
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();

  useEffect(() => {
    if (phase === "hidden") return;
    if (phase === "show") {
      sessionStorage.setItem(SESSION_KEY, "1");
      const t = window.setTimeout(() => setPhase("fade"), SHOW_MS);
      return () => window.clearTimeout(t);
    }
    // phase === "fade"
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
      {reduced ? (
        <img
          src={BRAND.goldPng}
          alt="Opti Gods"
          className="w-44 h-44 object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.55)]"
        />
      ) : (
        <video
          ref={videoRef}
          src={BRAND.spinRed}
          autoPlay
          muted
          playsInline
          preload="metadata"
          className="w-[80vw] h-[80vh] object-contain drop-shadow-[0_0_80px_rgba(239,68,68,0.7)]"
        />
      )}
    </div>
  );
}
