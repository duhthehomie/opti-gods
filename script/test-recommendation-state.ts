import assert from "node:assert/strict";
import { getMissingRecommendationIds, type MissingRecommendationOptions } from "../client/src/lib/missing-recommendations";

const ids = Array.from({ length: 411 }, (_, index) => `tweak-${index}`);
const state: MissingRecommendationOptions = {
  native: true,
  stateReady: true,
  appliedState: Object.fromEntries(ids.slice(0, 45).map(id => [id, true])),
  selectedState: {},
};
const pending = getMissingRecommendationIds(ids, state);
assert.equal(pending.length, 366, "All 366 unconfirmed compatible actions must be queued");
assert.deepEqual(pending, ids.slice(45));
assert.equal(new Set(pending).size, pending.length);
assert.deepEqual(getMissingRecommendationIds(["unknown"], { ...state, stateReady: false }), []);
assert.deepEqual(getMissingRecommendationIds(["a"], {
  ...state, appliedState: { a: false }, runItems: [{ id: "a", status: "applied" }],
}), ["a"], "Current false readback must remain actionable");
assert.deepEqual(getMissingRecommendationIds(["a"], {
  ...state, appliedState: { a: true }, runStatus: "completed", runItems: [{ id: "a", status: "failed" }],
}), ["a"], "Failed attempts must be retryable");
assert.deepEqual(getMissingRecommendationIds(["a"], {
  ...state, runItems: [{ id: "a", status: "skipped" }],
}), ["a"], "An earlier skip is not applied success");
assert.deepEqual(getMissingRecommendationIds(["a"], {
  ...state, runItems: [{ id: "a", status: "applied" }],
}), []);
assert.deepEqual(getMissingRecommendationIds(["NvidiaControlPanelSettings"], state), ["NvidiaControlPanelSettings"]);
assert.deepEqual(getMissingRecommendationIds(["NvidiaControlPanelSettings"], {
  ...state, appliedState: { NvidiaControlPanelSettings: true },
}), []);
console.log("Recommendation state checks passed: 411 - 45 = 366; unknown, skipped, failed, readback and NVIDIA paths.");
