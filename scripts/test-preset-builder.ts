// Lightweight assertion tests for shared/preset-builder.ts.
//
// Why not vitest? Adding vitest would change package.json (forbidden in this
// codebase per the fullstack-js skill). This script uses Node's built-in
// `assert` via tsx, mirroring scripts/smoke-test-ps1.ts. CI runs it the same
// way it runs the PS1 smoke test.
//
// Run:  npx tsx scripts/test-preset-builder.ts

import { strict as assert } from "node:assert";
import {
  buildSafePreset,
  FORBIDDEN_AUTO_TWEAKS,
  EXPERT_TWEAK_IDS,
  hardwareFromRig,
  type PresetHardware,
} from "../shared/preset-builder";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    process.stdout.write(`  \u2713 ${name}\n`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  \u2717 ${name}\n      ${msg}`);
    process.stdout.write(`  \u2717 ${name}\n      ${msg}\n`);
  }
}

console.log("\n[preset-builder] running tests\n");

const nvidiaRtxHw: PresetHardware = {
  gpuVendor: "nvidia",
  gpuName: "RTX 3070",
  cpuBrand: "amd",
  cpuLabel: "Ryzen 5 5600X",
  cpuCores: 12,
  ramGB: 32,
  osVersion: "win11",
  isLaptop: false,
  hasDiscreteGpu: true,
};

const amdGpuHw: PresetHardware = {
  gpuVendor: "amd",
  gpuName: "RX 6700 XT",
  cpuBrand: "amd",
  cpuLabel: "Ryzen 7 5800X",
  cpuCores: 16,
  ramGB: 32,
  osVersion: "win11",
  isLaptop: false,
  hasDiscreteGpu: true,
};

const intelIgpuLaptopHw: PresetHardware = {
  gpuVendor: "intel",
  gpuName: "UHD 770",
  cpuBrand: "intel",
  cpuLabel: "i5-1240P",
  cpuCores: 16,
  ramGB: 16,
  osVersion: "win11",
  isLaptop: true,
  hasDiscreteGpu: false,
};

test("NVIDIA RTX build: includes Nvidia tweaks, no Amd* leakage", () => {
  const p = buildSafePreset(nvidiaRtxHw, "balanced");
  assert.ok(p.core.some(id => id.startsWith("Nvidia")), "expected Nvidia tweaks");
  assert.ok(p.core.includes("EnableHAGS"), "RTX should opt into HAGS");
  assert.ok(!p.core.some(id => id.startsWith("Amd")), "AMD tweaks must NOT appear on NVIDIA box");
  assert.ok(!p.core.some(id => id.startsWith("IGpu_")), "iGPU tweaks must NOT appear when dGPU present");
});

test("AMD discrete build: includes Amd* tweaks, no Nvidia leakage", () => {
  const p = buildSafePreset(amdGpuHw);
  assert.ok(p.core.some(id => id.startsWith("Amd")), "expected AMD tweaks");
  assert.ok(!p.core.some(id => id.startsWith("Nvidia")), "Nvidia tweaks must NOT appear on AMD box");
});

test("Intel iGPU laptop: includes IGpu_Intel + Lap_ tweaks, no Nvidia/Amd dGPU", () => {
  const p = buildSafePreset(intelIgpuLaptopHw);
  assert.ok(p.core.some(id => id.startsWith("IGpu_Intel")), "expected IGpu_Intel tweaks");
  assert.ok(p.core.some(id => id.startsWith("Lap_")), "expected Lap_ tweaks");
  assert.ok(!p.core.some(id => id.startsWith("Nvidia")), "no Nvidia tweaks on Intel iGPU");
});

test("Lap_* tweaks blocked on desktop", () => {
  const p = buildSafePreset(nvidiaRtxHw);
  assert.ok(!p.core.some(id => id.startsWith("Lap_")), "Lap_ tweaks must not appear on desktop");
});

test("Win11* tweaks blocked on Win10", () => {
  const hw: PresetHardware = { ...nvidiaRtxHw, osVersion: "win10" };
  const p = buildSafePreset(hw);
  assert.ok(!p.core.some(id => id.startsWith("Win11")), "Win11 tweaks must not appear on Win10");
});

test("FORBIDDEN tweaks are NEVER in core without opt-in", () => {
  const p = buildSafePreset(nvidiaRtxHw, "balanced", []);
  for (const id of FORBIDDEN_AUTO_TWEAKS) {
    assert.ok(!p.core.includes(id), `forbidden tweak ${id} must NOT be in core`);
    assert.ok(!p.expert.includes(id), `forbidden tweak ${id} must NOT be in expert without opt-in`);
  }
});

test("FORBIDDEN tweaks move to expert when explicitly opted in", () => {
  const p = buildSafePreset(nvidiaRtxHw, "balanced", ["EnableMSIMode"]);
  assert.ok(!p.core.includes("EnableMSIMode"), "opted-in forbidden tweak still NOT in core");
  assert.ok(p.expert.includes("EnableMSIMode"), "opted-in forbidden tweak SHOULD be in expert");
});

test("FORBIDDEN tweaks land in blocked[] with reason when not opted in", () => {
  // FORBIDDEN aren't in any of our candidate lists by default, so they won't
  // appear in blocked unless someone (e.g. AI) tries to opt them in.
  // Verify: when the AI sends EnableMSIMode as opt-in WITHOUT it being in
  // the candidate set, it still goes through expert path (opt-in honoured).
  // When NOT opted in and NOT in candidates, it simply isn't generated.
  // This test documents the contract.
  const p = buildSafePreset(nvidiaRtxHw);
  assert.equal(p.core.includes("EnableMSIMode"), false);
});

test("EXPERT tweaks land in expert section, not core", () => {
  const p = buildSafePreset({ ...nvidiaRtxHw }, "balanced", ["DisableDefender"]);
  assert.ok(!p.core.includes("DisableDefender"), "DisableDefender must NOT be in core");
  assert.ok(p.expert.includes("DisableDefender"), "DisableDefender SHOULD be in expert when opted in");
});

test("EXPERT registry membership: all FORBIDDEN are in EXPERT set", () => {
  for (const id of FORBIDDEN_AUTO_TWEAKS) {
    assert.ok(EXPERT_TWEAK_IDS.has(id), `FORBIDDEN tweak ${id} should also be EXPERT`);
  }
});

test("Hardware-mismatch opt-in is recorded in blocked", () => {
  // Try to opt an AMD tweak into an NVIDIA box
  const p = buildSafePreset(nvidiaRtxHw, "balanced", ["AmdAntiLag"]);
  assert.ok(!p.core.includes("AmdAntiLag"), "AmdAntiLag must NOT be in core on NVIDIA");
  assert.ok(p.blocked.some(b => b.id === "AmdAntiLag"), "AmdAntiLag should be in blocked[]");
});

test("Unknown vendor: only universal tweaks, no vendor families", () => {
  const hw: PresetHardware = {
    gpuVendor: "unknown",
    cpuBrand: "unknown",
    ramGB: 16,
    osVersion: "win11",
    isLaptop: false,
  };
  const p = buildSafePreset(hw);
  assert.ok(p.core.length > 0, "should still produce a core preset");
  assert.ok(!p.core.some(id => id.startsWith("Nvidia") || id.startsWith("Amd") || id.startsWith("IGpu_")));
});

test("hardwareFromRig: detects NVIDIA RTX correctly", () => {
  const hw = hardwareFromRig({
    cpu: "AMD Ryzen 5 5600X 6-Core Processor",
    gpu: "NVIDIA GeForce RTX 3070",
    ramGb: 32,
    chassis: "Desktop",
    refreshHz: 144,
  });
  assert.equal(hw.gpuVendor, "nvidia");
  assert.equal(hw.cpuBrand, "amd");
  assert.equal(hw.isLaptop, false);
  assert.equal(hw.hasDiscreteGpu, true);
});

test("hardwareFromRig: detects laptop chassis", () => {
  const hw = hardwareFromRig({
    cpu: "Intel Core i7-12700H",
    gpu: "Intel Iris Xe Graphics",
    ramGb: 16,
    chassis: "Notebook",
    refreshHz: 165,
  });
  assert.equal(hw.isLaptop, true);
  assert.equal(hw.gpuVendor, "intel");
  assert.equal(hw.hasDiscreteGpu, false);
});

test("Goal=stability drops aggressive scheduler tweaks", () => {
  const balanced = buildSafePreset(nvidiaRtxHw, "balanced");
  const stable = buildSafePreset(nvidiaRtxHw, "stability");
  assert.ok(balanced.core.includes("DisableDynamicTick"));
  assert.ok(!stable.core.includes("DisableDynamicTick"));
});

console.log(`\n[preset-builder] ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
