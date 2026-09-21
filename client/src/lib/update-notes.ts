export const CURRENT_UPDATE_HIGHLIGHTS = [
  "Restored Pro access after Discord username changes.",
  "Added a backup-first FiveM UI and input recovery fix.",
  "Removed risky FiveM network and system changes from automatic presets.",
];

export function simpleUpdateNotes(notes: string | null | undefined): string[] {
  const lines = (notes ?? "")
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^#+\s*/, "").trim())
    .filter(line => line.length > 0 && !/^v?\d+(?:\.\d+)+\s*[-—:]/i.test(line));

  return lines.length > 0 ? lines.slice(0, 8) : CURRENT_UPDATE_HIGHLIGHTS;
}