import assert from "node:assert/strict";
import { filterAppliedTweakIds, getAppliedTweakTimestamp, sortAppliedTweakIds } from "../client/src/lib/applied-tweak-list";

const ids = ["OldConfirmed", "WindowsGameModeAlignment", "NvidiaMsiModeValidation", "UnknownTime", "NvidiaControlPanelSettings"];
const recorded = { OldConfirmed: 100, WindowsGameModeAlignment: 300, NvidiaMsiModeValidation: 400, NvidiaControlPanelSettings: 350 };
const local = { OldConfirmed: 200, WindowsGameModeAlignment: 500 };
const metadata: Record<string, { title: string; category: string; plainEnglish: string }> = {
  OldConfirmed: { title: "Older tweak", category: "system", plainEnglish: "Old Windows change" },
  WindowsGameModeAlignment: { title: "Windows Game Mode State Alignment", category: "fivem", plainEnglish: "High performance game GPU preferences" },
  NvidiaMsiModeValidation: { title: "MSI Mode Utility Optimization", category: "nvidia", plainEnglish: "Enable interrupt messages" },
  NvidiaControlPanelSettings: { title: "Opti Gods NVIDIA Preset", category: "nvidia", plainEnglish: "Digital Vibrance" },
  UnknownTime: { title: "Undated tweak", category: "system", plainEnglish: "" },
};
const title = (id: string) => metadata[id]?.title ?? id;
const original = [...ids];
const sorted = sortAppliedTweakIds(ids, recorded, local, title);
assert.deepEqual(sorted, ["WindowsGameModeAlignment", "NvidiaMsiModeValidation", "NvidiaControlPanelSettings", "OldConfirmed", "UnknownTime"]);
assert.deepEqual(ids, original, "Sorting must not mutate original history");
assert.equal(getAppliedTweakTimestamp("OldConfirmed", recorded, local), 200, "Newest successful source wins");
assert.equal(getAppliedTweakTimestamp("x", { x: NaN }, { x: Infinity }), 0);
assert.equal(getAppliedTweakTimestamp("x", { x: -1 }, {}), 0);
assert.deepEqual(sortAppliedTweakIds(["b", "a", "b"], {}, {}, id => id), ["a", "b"], "Deduplicate; deterministic undated order");
assert.deepEqual(filterAppliedTweakIds(sorted, "  GAME   mode ", id => metadata[id]), ["WindowsGameModeAlignment"]);
assert.deepEqual(filterAppliedTweakIds(sorted, "WindowsGameModeAlignment", id => metadata[id]), ["WindowsGameModeAlignment"]);
assert.deepEqual(filterAppliedTweakIds(sorted, "fivem", id => metadata[id]), ["WindowsGameModeAlignment"]);
assert.deepEqual(filterAppliedTweakIds(sorted, "interrupt", id => metadata[id]), ["NvidiaMsiModeValidation"]);
assert.deepEqual(filterAppliedTweakIds(sorted, "nvidia", id => metadata[id]), ["NvidiaMsiModeValidation", "NvidiaControlPanelSettings"], "Filtering preserves newest-first order");
assert.deepEqual(filterAppliedTweakIds(sorted, "does not exist", id => metadata[id]), []);
assert.deepEqual(filterAppliedTweakIds(sorted, "   ", id => metadata[id]), sorted);
assert.deepEqual(filterAppliedTweakIds(["UnregisteredTweak"], "unregistered", () => undefined), ["UnregisteredTweak"]);
console.log("Applied tweak list checks passed: newest timestamps, ties, invalid dates, search names/IDs/categories/descriptions, clear/no-match, preset ordering, immutable inputs.");
