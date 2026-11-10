export const CURRENT_UPDATE_HIGHLIGHTS = [
  "Restored Pro access after Discord username changes.",
  "Added a backup-first FiveM UI and input recovery fix.",
  "Removed risky FiveM network and system changes from automatic presets.",
];

/**
 * Release notes are one paragraph per version ("V5.2.91 — A. B. V5.2.90 — C.").
 * Keep only the newest version's part and split it into sentences.
 */
function newestVersionSentences(notes: string): string[] {
  const match = notes.trim().match(/^V?\d+(?:\.\d+)+\s*[—–-]\s*([\s\S]*?)(?=\s+V?\d+(?:\.\d+)+\s*[—–-]\s|$)/i);
  if (!match) return [];
  return match[1]
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
}

export function simpleUpdateNotes(notes: string | null | undefined): string[] {
  const sentences = newestVersionSentences(notes ?? "");
  if (sentences.length > 0) return sentences.slice(0, 8);
  const lines = (notes ?? "")
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^#+\s*/, "").trim())
    .filter(line => line.length > 0 && !/^v?\d+(?:\.\d+)+\s*[-—:]/i.test(line));

  return lines.length > 0 ? lines.slice(0, 8) : CURRENT_UPDATE_HIGHLIGHTS;
}