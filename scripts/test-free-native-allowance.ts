// Regression tests for the server-authoritative free native allowance.
//
// Run: npx tsx scripts/test-free-native-allowance.ts
//
// These tests intentionally use Node's built-in assertions so they do not
// change package.json or add another test runner to the desktop build.

import { strict as assert } from "node:assert";
import {
  BEST_15_PRIORITY,
  FREE_NATIVE_TWEAK_LIMIT,
  NATIVE_TWEAK_ID_SET,
  selectBestInstantTweaks,
} from "../shared/native-tweak-ids";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log("\n[free-native-allowance] running tests\n");

const oversizedSelection = [
  ...BEST_15_PRIORITY,
  ...BEST_15_PRIORITY.slice(0, 4),
  "Lap_TimerResolution",
  "DisableIPv6",
];

test("fresh Best 15 selection never returns more than 15 unique native IDs", () => {
  const result = selectBestInstantTweaks(oversizedSelection, new Set(), FREE_NATIVE_TWEAK_LIMIT, false);
  assert.equal(result.ids.length, FREE_NATIVE_TWEAK_LIMIT);
  assert.equal(new Set(result.ids).size, FREE_NATIVE_TWEAK_LIMIT);
  assert.ok(result.ids.every(id => NATIVE_TWEAK_ID_SET.has(id)));
});

test("six active slots leave exactly nine new slots without re-authorizing active IDs", () => {
  const active = new Set(BEST_15_PRIORITY.slice(0, 6));
  const result = selectBestInstantTweaks(oversizedSelection, active, 9, false);
  assert.equal(result.ids.length, 9);
  assert.ok(result.ids.every(id => !active.has(id)));
  assert.equal(new Set([...active, ...result.ids]).size, FREE_NATIVE_TWEAK_LIMIT);
});

test("a full allowance returns no new IDs", () => {
  const active = new Set(BEST_15_PRIORITY.slice(0, FREE_NATIVE_TWEAK_LIMIT));
  const result = selectBestInstantTweaks(oversizedSelection, active, 0, false);
  assert.deepEqual(result.ids, []);
  assert.equal(result.requestedCount, 0);
});

test("Pro selection is still capped to the canonical Best 15 recommendation set", () => {
  const result = selectBestInstantTweaks(oversizedSelection, new Set(), 0, true);
  assert.equal(result.ids.length, FREE_NATIVE_TWEAK_LIMIT);
  assert.equal(new Set(result.ids).size, FREE_NATIVE_TWEAK_LIMIT);
});

if (failed > 0) {
  console.error(`\n${failed} allowance test(s) failed.`);
  process.exit(1);
}
console.log(`\n${passed} allowance test(s) passed.`);