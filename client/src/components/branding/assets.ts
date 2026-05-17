export const BRAND = {
  goldPng: "/branding/optigods-gold.png",
  redPng: "/branding/optigods-red.png",
  spinRed: "/branding/spin-red.mp4",
  spinSilver: "/branding/spin-silver.mp4",
  spinWhiteGold: "/branding/spin-whitegold.mp4",
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
