export type TweakRunTab = "all" | "failed" | "skipped";

export function getCompatibleScriptRetryIds(
  items: readonly { id: string; status: string }[],
  hasTrustedScript: (id: string) => boolean,
  isCompatible: (id: string) => boolean,
): string[] {
  return Array.from(new Set(items
    .filter(item => (item.status === "skipped" || item.status === "failed")
      && hasTrustedScript(item.id) && isCompatible(item.id))
    .map(item => item.id)));
}

export function getCompatibilitySkipMessage(
  errorKind: string | null | undefined,
  message: string | null | undefined,
): string | null {
  const detail = message?.trim() ?? "";
  if (errorKind === "compatibility") {
    return detail || "This tweak is not compatible with this PC.";
  }
  return /\bnot for this system\b/i.test(detail) ? detail : null;
}

export function getTweakRunItemsForTab<T extends { status: string }>(
  items: readonly T[],
  tab: TweakRunTab,
): T[] {
  return tab === "all" ? Array.from(items) : items.filter(item => item.status === tab);
}

export function countTweakRunItemsWithStatus<T extends { status: string }>(
  items: readonly T[],
  status: "failed" | "skipped",
): number {
  return items.filter(item => item.status === status).length;
}
