// Detection-based announcement relevance.
// Given an announcement (title+body+tag) and the user's detected hardware/OS,
// determine whether it actually applies to them and why.
//
// We intentionally keep this dependency-free + deterministic so the sidebar
// can call it on every render without a perf hit.

export interface RelevanceHardware {
  isNvidia: boolean;
  isAMD: boolean;
  isIntel: boolean;
  isAmdApu: boolean;
  isLaptop: boolean;
  loading?: boolean;
}

export interface RelevanceOs {
  isWindows: boolean;
  isWindows10: boolean;
  isWindows11: boolean;
}

export interface AnnouncementLite {
  title: string;
  body: string;
  tag: string | null;
  tweakIds: string[] | null;
}

export interface Relevance {
  isRelevant: boolean;
  isCritical: boolean;       // hotfix/warning that targets this user
  reasons: string[];         // human-readable: "Your RTX GPU", "Your laptop", etc.
}

const KEYWORD_MAP: { keywords: RegExp; flag: keyof RelevanceHardware | keyof RelevanceOs; label: string }[] = [
  { keywords: /\bnvidia|rtx|gtx|geforce|nvapi|dlss\b/i,             flag: "isNvidia",    label: "your NVIDIA GPU" },
  { keywords: /\bamd\b|radeon|adrenalin|hypr-?rx|anti-?lag/i,        flag: "isAMD",       label: "your AMD GPU" },
  { keywords: /\bryzen\b/i,                                          flag: "isAMD",       label: "your AMD CPU" },
  { keywords: /\bintel\b|core\s*i[3579]|13th|14th\s*gen|13900|14900|13700|14700/i, flag: "isIntel", label: "your Intel CPU" },
  { keywords: /\bapu\b|vega\b/i,                                     flag: "isAmdApu",    label: "your AMD APU" },
  { keywords: /\blaptop\b|battery|modern\s*standby|s3\s*sleep|hibernate/i, flag: "isLaptop", label: "your laptop" },
  { keywords: /windows\s*11|win\s*11|win11|24h2|26100/i,             flag: "isWindows11", label: "your Windows 11 install" },
  { keywords: /windows\s*10|win\s*10|win10|22h2|19045/i,             flag: "isWindows10", label: "your Windows 10 install" },
];

export function getAnnouncementRelevance(
  ann: AnnouncementLite,
  hw: RelevanceHardware,
  os: RelevanceOs,
): Relevance {
  // While hardware is still being detected we treat everything as relevant —
  // better to over-show than to hide a critical fix during the first 200ms.
  if (hw.loading) {
    return { isRelevant: true, isCritical: isCriticalTag(ann.tag), reasons: [] };
  }

  const hay = `${ann.title}\n${ann.body}`;
  const reasons: string[] = [];
  let mentionsAnyTarget = false;
  let userMatchesATarget = false;

  for (const rule of KEYWORD_MAP) {
    if (!rule.keywords.test(hay)) continue;
    mentionsAnyTarget = true;
    const userHasFlag = (rule.flag in hw)
      ? (hw as any)[rule.flag] === true
      : (os as any)[rule.flag] === true;
    if (userHasFlag) {
      userMatchesATarget = true;
      reasons.push(rule.label);
    }
  }

  // If the announcement doesn't mention any specific hardware/OS keyword, it
  // applies to everyone (general updates, announcements, multi-platform fixes).
  const isRelevant = !mentionsAnyTarget || userMatchesATarget;
  const isCritical = isRelevant && isCriticalTag(ann.tag);

  return { isRelevant, isCritical, reasons };
}

function isCriticalTag(tag: string | null): boolean {
  const t = (tag || "").toLowerCase();
  return t === "hotfix" || t === "warning";
}

// Convenience: how many actionable, system-relevant updates does this user
// have outstanding? (Used by the sidebar flash indicator.)
export function countActionableForSystem(
  announcements: AnnouncementLite[],
  appliedTweaks: Record<string, boolean>,
  hw: RelevanceHardware,
  os: RelevanceOs,
): { total: number; critical: number } {
  let total = 0;
  let critical = 0;
  for (const ann of announcements) {
    const ids = ann.tweakIds || [];
    if (ids.length === 0) continue;
    const rel = getAnnouncementRelevance(ann, hw, os);
    if (!rel.isRelevant) continue;
    const newOnes = ids.filter(id => !appliedTweaks[id]).length;
    if (newOnes > 0) {
      total += newOnes;
      if (rel.isCritical) critical += newOnes;
    }
  }
  return { total, critical };
}
