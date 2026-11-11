import { getEligibleSmartRecommendationIds } from "@/lib/smart-recommendations";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { TWEAK_REGISTRY, getTweakMeta } from "@/lib/tweak-registry";
import { isNvidiaAction, isScriptOnlyTweakId } from "@/lib/native-tweak-runner";
import { readNotApplicableTweakIds } from "@/lib/not-applicable-tweaks";
import { NATIVE_TWEAK_ID_SET } from "@shared/native-tweak-ids";
import { RETIRED_TWEAK_IDS, RUNTIME_ONLY_TWEAK_IDS } from "@shared/retired-tweak-ids";
import { BEST_15_IDS_KEY } from "@/lib/queryClient";
import { detectInstalledGames, isNative } from "@/lib/tauri-bridge";
import { useEffect, useState } from "react";

const NVIDIA_PRESET_ID = "NvidiaControlPanelSettings";
const NVIDIA_MSI_PRO_ID = "EnableNvidiaMSIPro";
const REGISTRY_IDS = new Set(TWEAK_REGISTRY.map(tweak => tweak.id));

/**
 * Game profiles that join the recommended (missing-tweaks) list, but only when
 * the native scan finds the game's executable on this PC.
 */
export const PROFILE_GAME_IDS: readonly string[] = ["game_cs2"];

let installedGamesRequest: Promise<string[]> | null = null;

/** Installed game profile IDs from the native scan (cached for this session). */
export function loadInstalledProfileGameIds(): Promise<string[]> {
  if (!isNative()) return Promise.resolve([]);
  installedGamesRequest ??= detectInstalledGames()
    .then(games => games.map(game => game.id).filter(id => PROFILE_GAME_IDS.includes(id)))
    .catch(error => { installedGamesRequest = null; throw error; });
  return installedGamesRequest;
}

export function useInstalledProfileGameIds(): { ids: string[]; error: string | null } {
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadInstalledProfileGameIds()
      .then(found => { if (alive) { setIds(found); setError(null); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : String(err)); });
    return () => { alive = false; };
  }, []);
  return { ids, error };
}

/**
 * The recommended tweaks a PC is scored against. Dashboard and AI Optimize
 * must both use this so their "X of Y" counts always match.
 */
/** Same test the run page uses before marking a tweak "no trusted batch action". */
export function hasRunnableWindowsAction(id: string): boolean {
  if (isNvidiaAction(id)) return true;
  return Boolean(getTweakMeta(id)) && (NATIVE_TWEAK_ID_SET.has(id) || isScriptOnlyTweakId(id));
}

/**
 * Tweaks that can never be applied on this PC: no Windows action exists in
 * this app, the tweak was retired, it is a one-off action with nothing lasting
 * to confirm, or Windows reported it cannot apply here.
 */
export function isNeverApplicableHere(id: string, notApplicable: ReadonlySet<string> = readNotApplicableTweakIds()): boolean {
  if (id === NVIDIA_PRESET_ID || id === NVIDIA_MSI_PRO_ID) return false;
  return RETIRED_TWEAK_IDS.has(id) || RUNTIME_ONLY_TWEAK_IDS.has(id)
    || !hasRunnableWindowsAction(id) || notApplicable.has(id);
}

export function getScoredRecommendationIds(recIds: Iterable<string>, nvidiaPresetEligible: boolean, installedProfileGameIds: readonly string[] = []): string[] {
  const notApplicable = readNotApplicableTweakIds();
  return Array.from(new Set([
    ...getEligibleSmartRecommendationIds(
      [...Array.from(recIds).filter(id => id !== NVIDIA_PRESET_ID), ...(nvidiaPresetEligible ? [NVIDIA_PRESET_ID] : [])],
      id => id === NVIDIA_PRESET_ID ? nvidiaPresetEligible : getTweakCompatibility(id).ok,
    ),
    ...(nvidiaPresetEligible && getTweakCompatibility(NVIDIA_MSI_PRO_ID).ok ? [NVIDIA_MSI_PRO_ID] : []),
    // Last, so installed game profiles never shift the free 15-tweak allowance.
    ...installedProfileGameIds.filter(id => PROFILE_GAME_IDS.includes(id) && REGISTRY_IDS.has(id) && getTweakCompatibility(id).ok),
  ].filter(id => !isNeverApplicableHere(id, notApplicable))));
}

/**
 * Tweaks confirmed applied on this PC: Windows readback or recorded success,
 * plus successful items of the latest run unless Windows reads them as off.
 */
export function getConfirmedRecommendationIds(options: {
  detected: Record<string, boolean>;
  runItems?: readonly { id: string; status: string }[];
  nvidiaPresetEligible: boolean;
  nvidiaPresetVerified: boolean;
}): Set<string> {
  const { detected, runItems = [], nvidiaPresetEligible, nvidiaPresetVerified } = options;
  const confirmed = new Set(Object.keys(detected).filter(id => detected[id] && REGISTRY_IDS.has(id)));
  for (const item of runItems) {
    if (item.status === "applied" && REGISTRY_IDS.has(item.id) && detected[item.id] !== false) confirmed.add(item.id);
  }
  if (nvidiaPresetEligible && nvidiaPresetVerified) confirmed.add(NVIDIA_PRESET_ID);
  else confirmed.delete(NVIDIA_PRESET_ID);
  return confirmed;
}

export function readBest15Ids(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BEST_15_IDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Free users are scored only on their 15 allowed tweaks; Pro on everything confirmed. */
export function getCountedConfirmedIds(confirmed: Set<string>, scoredIds: readonly string[], isPro: boolean): Set<string> {
  if (isPro) return confirmed;
  const saved = readBest15Ids();
  const freeAllowed = scoredIds.filter(id => saved.length === 0 || saved.includes(id)).slice(0, 15);
  return new Set(freeAllowed.filter(id => confirmed.has(id)));
}
