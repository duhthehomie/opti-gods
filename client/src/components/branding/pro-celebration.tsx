import { useEffect, useRef, useState } from "react";
import { BRAND, prefersReducedMotion } from "./assets";

const PRO_EVENT = "optigods_pro_changed";
export const PRO_CELEBRATE_EVENT = "optigods_pro_celebrate";
const DISMISS_MS = 4000;
const FADE_MS = 400;

export function fireCelebration() {
  window.dispatchEvent(new Event(PRO_CELEBRATE_EVENT));
}

export function ProCelebration() {
  const [phase, setPhase] = useState<"hidden" | "show" | "fade">("hidden");
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasProRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    wasProRef.current = !!localStorage.getItem("optigods_session_v2");

    const onChange = () => {
      const nowPro = !!localStorage.getItem("optigods_session_v2");
      if (nowPro && !wasProRef.current) {
        setPhase("show");
      }
      wasProRef.current = nowPro;
    };

    const onForce = () => setPhase("show");

    window.addEventListener(PRO_EVENT, onChange);
    window.addEventListener(PRO_CELEBRATE_EVENT, onForce);
    return () => {
      window.removeEventListener(PRO_EVENT, onChange);
      window.removeEventListener(PRO_CELEBRATE_EVENT, onForce);
    };
  }, []);

  useEffect(() => {
    if (phase === "hidden") return;
    if (phase === "show") {
      const t = window.setTimeout(() => setPhase("fade"), DISMISS_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

  const reduced = prefersReducedMotion();

  return (
    <div
      data-testid="pro-celebration"
      role="dialog"
      aria-label="Pro unlocked"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
      style={{
        opacity: phase === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
      onClick={() => setPhase("fade")}
    >
      {reduced ? (
        <img
          src={BRAND.goldPng}
          alt="Opti Gods Pro Unlocked"
          className="relative z-10 w-56 h-56 object-contain drop-shadow-[0_0_50px_rgba(250,204,21,0.6)]"
        />
      ) : (
        <video
          ref={videoRef}
          src={BRAND.spinWhiteGold}
          autoPlay
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="relative z-10 mt-6 text-center space-y-1 px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/80">
          Welcome to
        </p>
        <p className="text-3xl md:text-4xl font-display font-black uppercase tracking-[0.18em] text-white">
          Opti Gods <span className="text-amber-300">Pro</span>
        </p>
        <p className="text-xs text-zinc-400 mt-3">All tweaks unlocked. Lifetime access granted.</p>
      </div>
    </div>
  );
}
