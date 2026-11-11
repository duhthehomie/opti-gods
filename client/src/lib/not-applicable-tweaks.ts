/**
 * Tweaks that Windows reported can never apply on this PC: the app or service
 * is not installed, the hardware does not have the setting, or Windows
 * protects it. They are removed from this PC's score instead of staying
 * "missing" forever. A later run that applies the tweak brings it back.
 */
const NOT_APPLICABLE_KEY = "optigods-not-applicable-tweaks";
// Must match NATIVE_RUN_STATE_KEY in native-tweak-runner (kept separate to avoid an import cycle).
const RUN_STATE_KEY = "optigods-native-run-state";

const TRANSIENT_SKIP = /\b(close|launch|re-?run)\b|open \S+ once|could not|is (open|running)/i;
const PERMANENT_SKIP = new RegExp([
  "already debloated", "not installed", "already absent", "not on startup",
  "per-user services", "does not apply to this (cpu|gpu)", "windows (did|does) not expose",
  "not exposed by windows", "is not present", "does not have this setting", "windows protects",
  "is not enabled on", "no connected wi-fi adapter", "no active network adapter",
  "is not registered for this windows user", "not detected", "not supported by the active",
  "requires 16gb\\+ ram", "driver key not found", "no discord cache folders",
].join("|"), "i");

interface RunItemLike { id: string; status: string; message?: string }

export function isPermanentSkipMessage(message: string | undefined): boolean {
  if (!message || !/\[SKIP/i.test(message)) return false;
  return PERMANENT_SKIP.test(message) && !TRANSIENT_SKIP.test(message);
}

function readStored(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(NOT_APPLICABLE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function merge(stored: Record<string, string>, items: readonly RunItemLike[]): Record<string, string> {
  const next = { ...stored };
  for (const item of items) {
    if (item.status === "applied") delete next[item.id];
    else if (item.status === "skipped" && isPermanentSkipMessage(item.message)) next[item.id] = item.message!;
  }
  return next;
}

function readRunItems(): RunItemLike[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUN_STATE_KEY) || "null") as { items?: RunItemLike[] } | null;
    return Array.isArray(parsed?.items) ? parsed!.items : [];
  } catch {
    return [];
  }
}

/** Save permanent skips (and clear re-applied ones) from a run's results. */
export function rememberNotApplicableTweaks(items: readonly RunItemLike[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(NOT_APPLICABLE_KEY, JSON.stringify(merge(readStored(), items))); } catch { /* best effort */ }
}

/** Tweaks this PC cannot apply, including results of the latest saved run. */
export function readNotApplicableTweakIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return new Set(Object.keys(merge(readStored(), readRunItems())));
}
