// Lightweight assertion tests for client/src/lib/smart-recommendations.ts.
//
// Focuses on the V2.2 hybrid-aware behaviour:
//   * A laptop with Intel iGPU + NVIDIA dGPU MUST get BOTH Lap_NVIDIA_* and
//     Lap_Intel_* tweaks (parallel vendor branches, not else-if).
//   * An Arc-only Intel rig MUST NOT pull IGpu_Intel_* (Arc is discrete).
//
// Run:  npx tsx scripts/test-smart-recs-hybrid.ts

import { strict as assert } from "node:assert";
import { computeSmartRecs } from "../client/src/lib/smart-recommendations";
import {
  classifyGpu,
  type GpuEntry,
  type HardwareInfo,
} from "../client/src/hooks/use-hardware-info";
import type { OsInfo } from "../client/src/hooks/use-os-detection";

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

const win11: OsInfo = {
  os: "Windows 11 Pro",
  displayName: "Windows 11 Pro (23H2)",
  isWindows: true,
  isWindows11: true,
  isWindows10: false,
  build: "22631",
  loading: false,
};

/** Build a HardwareInfo from a list of raw GPU names + overrides. */
function makeHw(
  gpuNames: string[],
  overrides: Partial<HardwareInfo> = {}
): HardwareInfo {
  const gpus: GpuEntry[] = gpuNames.map(classifyGpu);
  const primary = gpus.find((g) => !g.isIntegrated) ?? gpus[0];
  const amdGpus = gpus.filter((g) => g.vendor === "amd");
  const isAmd = amdGpus.length > 0;
  const isAmdGpu = amdGpus.some((g) => !g.isIntegrated);
  const isAmdApu = amdGpus.some((g) => g.isIntegrated);
  const isNvidia = gpus.some((g) => g.vendor === "nvidia");
  const isIntel = gpus.some((g) => g.vendor === "intel");
  const hasDiscreteGpu = gpus.some((g) => !g.isIntegrated && g.vendor !== "unknown");
  const hasIntegratedGpu = gpus.some((g) => g.isIntegrated);

  return {
    cpuCores: 16,
    cpuPhysicalCores: 8,
    cpuLabel: "Test CPU",
    ramGB: 32,
    ramLabel: "32 GB",
    ramNote: "test",
    gpuName: primary?.name || "Unknown",
    gpuVendor: primary?.vendor || "",
    gpus,
    isNvidia,
    isAMD: isAmd,
    isAmd,
    isIntel,
    nvidiaIsLowEnd: false,
    nvidiaIsRTX: isNvidia,
    isAmdGpu,
    isAmdApu,
    hasDiscreteGpu,
    hasIntegratedGpu,
    isHybridGpu: hasDiscreteGpu && hasIntegratedGpu,
    cpuBrand: "intel",
    isRyzen: false,
    isIntelCore: true,
    cpuGeneration: 12,
    isLaptop: false,
    resolution: "1920x1080",
    loading: false,
    scanned: true,
    ...overrides,
  };
}

console.log("\n[smart-recs hybrid] running tests\n");

// ---------------------------------------------------------------------------
// Hybrid laptop: Intel iGPU + NVIDIA dGPU
// ---------------------------------------------------------------------------

test("Hybrid laptop (Intel UHD + NVIDIA RTX 3060) yields BOTH Lap_NVIDIA_* and Lap_Intel_*", () => {
  const hw = makeHw(
    ["Intel(R) UHD Graphics 630", "NVIDIA GeForce RTX 3060 Laptop GPU"],
    { isLaptop: true }
  );
  // sanity: hybrid flags are correctly populated by makeHw
  assert.equal(hw.isNvidia, true);
  assert.equal(hw.isIntel, true);
  assert.equal(hw.isHybridGpu, true);

  const recs = computeSmartRecs(hw, win11);
  const ids = recs.ids;

  // Lap_NVIDIA_* present
  assert.ok(
    [...ids].some((id) => id.startsWith("Lap_NVIDIA_")),
    "expected at least one Lap_NVIDIA_* tweak"
  );
  assert.ok(ids.has("Lap_NVIDIA_MaxPerformance"));
  assert.ok(ids.has("Lap_NVIDIA_LowLatency"));

  // Lap_Intel_* present (parallel branch, not else-if)
  assert.ok(
    [...ids].some((id) => id.startsWith("Lap_Intel_")),
    "expected at least one Lap_Intel_* tweak"
  );
  assert.ok(ids.has("Lap_Intel_DisableSpeedShift"));
  assert.ok(ids.has("Lap_Intel_DisableECores"));

  // And the non-vendor Lap_ baseline is also there
  assert.ok(ids.has("Lap_UltimatePerformance"));
  assert.ok(ids.has("Lap_DisableCoreParking"));
});

test("Hybrid laptop also gets the Intel iGPU tweak bundle (IGpu_Intel_*)", () => {
  const hw = makeHw(
    ["Intel(R) UHD Graphics 630", "NVIDIA GeForce RTX 3060 Laptop GPU"],
    { isLaptop: true }
  );
  const ids = computeSmartRecs(hw, win11).ids;
  assert.ok(
    [...ids].some((id) => id.startsWith("IGpu_Intel_")),
    "hybrid laptop should still receive Intel iGPU driver tweaks"
  );
  // And NVIDIA discrete bundle
  assert.ok(
    [...ids].some((id) => id.startsWith("Nvidia")),
    "hybrid laptop should also get NVIDIA discrete tweaks"
  );
});

// ---------------------------------------------------------------------------
// Arc-only desktop: Intel discrete, NO iGPU
// ---------------------------------------------------------------------------

test("Arc-only Intel desktop does NOT pull IGpu_Intel_* tweaks", () => {
  const hw = makeHw(["Intel Arc A770"], { isLaptop: false });
  assert.equal(hw.isIntel, true);
  assert.equal(hw.hasIntegratedGpu, false, "Arc is discrete — no integrated GPU");
  assert.equal(hw.hasDiscreteGpu, true);

  const ids = computeSmartRecs(hw, win11).ids;
  const intelIgpuIds = [...ids].filter((id) => id.startsWith("IGpu_Intel_"));
  assert.equal(
    intelIgpuIds.length,
    0,
    `Arc-only rig must NOT receive IGpu_Intel_* tweaks, got: ${JSON.stringify(intelIgpuIds)}`
  );

  // And — since not a laptop — no Lap_Intel_* either
  const lapIntelIds = [...ids].filter((id) => id.startsWith("Lap_Intel_"));
  assert.equal(lapIntelIds.length, 0, "desktop must not receive Lap_Intel_* tweaks");

  // Also no NVIDIA / AMD cross-contamination
  assert.ok(![...ids].some((id) => id.startsWith("Nvidia")));
  assert.ok(![...ids].some((id) => id.startsWith("Amd")));
});

test("Arc-only Intel desktop still gets the universal CORE bundle", () => {
  const hw = makeHw(["Intel Arc A770"], { isLaptop: false });
  const ids = computeSmartRecs(hw, win11).ids;
  // Spot-check a few CORE entries
  assert.ok(ids.has("DisableTelemetry"));
  assert.ok(ids.has("GameModeTweaks"));
  assert.ok(ids.has("SetHighPerformancePlan"));
});

// ---------------------------------------------------------------------------
// Pure NVIDIA dGPU desktop — sanity baseline (no Lap_*, no IGpu_*)
// ---------------------------------------------------------------------------

test("Pure NVIDIA dGPU desktop: no Lap_*, no IGpu_*", () => {
  const hw = makeHw(["NVIDIA GeForce RTX 4090"], { isLaptop: false });
  const ids = computeSmartRecs(hw, win11).ids;
  assert.ok(![...ids].some((id) => id.startsWith("Lap_")), "desktop must have no Lap_ tweaks");
  assert.ok(![...ids].some((id) => id.startsWith("IGpu_")), "discrete-only rig must have no IGpu_ tweaks");
  assert.ok([...ids].some((id) => id.startsWith("Nvidia")), "should get NVIDIA tweaks");
});

console.log(`\n[smart-recs hybrid] ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
