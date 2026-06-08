import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { BRAND, prefersReducedMotion } from "./assets";

export function AdminSilverMark({ className = "" }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.1 },
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, []);

  if (reduced) {
    return (
      <img
        src={BRAND.goldPng}
        alt="Opti Gods"
        className={cn("w-20 h-20 object-cover", className)}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={BRAND.spinSilver}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className={cn("w-20 h-20 object-cover", className)}
      data-testid="admin-silver-mark"
    />
  );
}
