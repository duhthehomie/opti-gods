import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "./assets";
import {
  AUTH_TRANSITION_EVENT,
  clearAuthTransition,
  hasPendingAuthTransition,
} from "@/lib/auth-transition";

const DISPLAY_MS = 2200;

export function AuthTransitionOverlay() {
  const [visible, setVisible] = useState(hasPendingAuthTransition);
  const [videoFailed, setVideoFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearAuthTransition();
    setVisible(false);
  }, []);

  const show = useCallback(() => {
    setVideoFailed(false);
    setVisible(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(hide, DISPLAY_MS);
  }, [hide]);

  useEffect(() => {
    const onStart = () => show();
    const onEnd = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
    };

    window.addEventListener(AUTH_TRANSITION_EVENT, onStart);
    window.addEventListener(`${AUTH_TRANSITION_EVENT}:end`, onEnd);
    if (hasPendingAuthTransition()) show();

    return () => {
      window.removeEventListener(AUTH_TRANSITION_EVENT, onStart);
      window.removeEventListener(`${AUTH_TRANSITION_EVENT}:end`, onEnd);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      data-testid="auth-transition-overlay"
      aria-hidden="true"
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-black"
    >
      {videoFailed ? (
        <div className="flex flex-col items-center gap-5">
          <div
            className="h-36 w-36 rounded-full border-[5px] border-red-500/20 border-t-red-500 animate-spin"
            style={{ boxShadow: "0 0 60px rgba(239,68,68,0.45)" }}
          />
          <span className="text-xs font-bold uppercase tracking-[0.35em] text-red-300/80">
            Opti Gods
          </span>
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
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setVideoFailed(true)}
        />
      )}
    </div>
  );
}