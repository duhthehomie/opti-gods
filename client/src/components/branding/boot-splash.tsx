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
  const videoRef = useRef<HTMLVideoElement>(null);

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
      <video
        ref={videoRef}
        src={BRAND.spinRed}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
}
