import { useEffect, useRef, useState } from "react";
import { BRAND } from "./assets";

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
      {/* Always show the video — ignore OS reduced-motion setting for this
          one-time unlock moment. Fall back to the PNG only if the file fails. */}
      <video
        ref={videoRef}
        src={BRAND.spinWhiteGold}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => {
          const v = e.currentTarget;
          const img = document.createElement("img");
          img.src = BRAND.goldPng;
          img.alt = "Opti Gods Pro";
          img.className = "absolute inset-0 w-full h-full object-contain";
          v.replaceWith(img);
        }}
      />
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
