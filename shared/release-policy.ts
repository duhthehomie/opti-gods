/** Compare release numbers, including GitHub's leading "v" tags. */
export function compareReleaseVersions(a: string, b: string): number {
  const parse = (value: string) => value.trim().replace(/^v/i, "").split(".").map(n => Number.parseInt(n, 10) || 0);
  const left = parse(a), right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if ((left[i] ?? 0) !== (right[i] ?? 0)) return (left[i] ?? 0) - (right[i] ?? 0);
  }
  return 0;
}

export function resolveLatestVersion(github: string | undefined, file: string, override?: string | null): string {
  // Published GitHub releases take precedence over stale admin overrides.
  // Do not advertise an unpublished local build with an older release's URL.
  if (github) return github.replace(/^v/i, "");
  const candidate = override || file;
  return compareReleaseVersions(candidate, file) >= 0 ? candidate : file;
}

