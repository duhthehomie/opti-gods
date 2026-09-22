import loadingGifAsset from "@/assets/opti-gods-loading-splash.gif";

export const BRAND = {
  goldPng: "/branding/optigods-gold.png",
  redPng: "/branding/optigods-red.png",
  spinRed: "/branding/spin-red.mp4",
  // Import this through Vite instead of relying on a root-relative public URL.
  // Tauri's packaged WebView serves hashed bundle assets reliably.
  loadingGif: loadingGifAsset,
  spinSilver: "/branding/spin-silver.mp4",
  spinWhiteGold: "/branding/spin-whitegold.mp4",
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
