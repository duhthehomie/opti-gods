type ApplyTimes = Readonly<Record<string, number>>;
type SearchMetadata = { title?: string; category?: string; plainEnglish?: string };

/** History is a timestamp, never evidence that the current Windows value matches. */
export function getAppliedTweakTimestamp(id: string, recordedAt: ApplyTimes, appliedAt: ApplyTimes): number {
  return Math.max(0, ...[recordedAt[id], appliedAt[id]].filter(
    (time): time is number => typeof time === "number" && Number.isFinite(time) && time > 0,
  ));
}

export function sortAppliedTweakIds(
  ids: readonly string[],
  recordedAt: ApplyTimes,
  appliedAt: ApplyTimes,
  titleForId: (id: string) => string,
): string[] {
  return Array.from(new Set(ids)).sort((a, b) =>
    getAppliedTweakTimestamp(b, recordedAt, appliedAt) - getAppliedTweakTimestamp(a, recordedAt, appliedAt)
    || titleForId(a).localeCompare(titleForId(b))
    || a.localeCompare(b),
  );
}

export function filterAppliedTweakIds(
  ids: readonly string[],
  query: string,
  metaForId: (id: string) => SearchMetadata | undefined,
): string[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [...ids];
  return ids.filter(id => {
    const meta = metaForId(id);
    const searchable = [id, meta?.title, meta?.category, meta?.plainEnglish].filter(Boolean).join(" ").toLocaleLowerCase();
    return words.every(word => searchable.includes(word));
  });
}
