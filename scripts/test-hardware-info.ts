// Lightweight assertion tests for client/src/hooks/use-hardware-info.ts.
//
// Same harness as scripts/test-preset-builder.ts (node:assert + tsx). The two
// pure helpers under test — classifyGpu and splitGpuList — are exported from
// the hook module so we can exercise them without a React/JSDOM environment.
//
// Run:  npx tsx scripts/test-hardware-info.ts

import { strict as assert } from "node:assert";
import {
  classifyGpu,
  splitGpuList,
} from "../client/src/hooks/use-hardware-info";

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

console.log("\n[hardware-info] running tests\n");

// ---------------------------------------------------------------------------
// classifyGpu — vendor + tier + integrated matrix
// ---------------------------------------------------------------------------

test("NVIDIA RTX 4090 → nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 4090");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
  assert.equal(g.isIntegrated, false);
});

test("NVIDIA RTX 3060 → nvidia / mid / discrete (Task #61)", () => {
  // Regression: prior high-band regex `rtx\s*30[6-9]\d` swallowed the entire
  // 30xx range. 3060/3060 Ti/3070 are mid-tier; only 3080/3090 are high.
  const g = classifyGpu("NVIDIA GeForce RTX 3060");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
  assert.equal(g.isIntegrated, false);
});

test("NVIDIA RTX 3060 Laptop GPU → nvidia / mid / discrete (Task #61)", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 3060 Laptop GPU");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
  assert.equal(g.isIntegrated, false);
});

test("NVIDIA RTX 3060 Ti → nvidia / mid / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 3060 Ti");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA RTX 3070 → nvidia / mid / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 3070");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA RTX 3080 → nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 3080");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
});

test("NVIDIA RTX 3080 Ti → nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 3080 Ti");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
});

test("NVIDIA RTX 3090 → nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 3090");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
});

test("NVIDIA RTX 4060 → nvidia / mid / discrete (Task #61)", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 4060");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA RTX 4070 Ti → nvidia / mid / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 4070 Ti");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA RTX 4080 → nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 4080");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
});

test("NVIDIA RTX 5070 → nvidia / mid / discrete (Task #61)", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 5070");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA RTX 5090 → nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 5090");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
});

test("NVIDIA RTX 2060 → nvidia / mid / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 2060");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA GTX 1060 → nvidia / low / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce GTX 1060");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "low");
});

test("NVIDIA GTX 1660 → nvidia / mid / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce GTX 1660 SUPER");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "mid");
});

test("NVIDIA Quadro RTX A6000 → nvidia / pro", () => {
  const g = classifyGpu("NVIDIA RTX A6000");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "pro");
});

test("NVIDIA MX450 → nvidia / low / discrete (mobile)", () => {
  const g = classifyGpu("NVIDIA GeForce MX450");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "low");
  assert.equal(g.isIntegrated, false);
});

test("AMD RX 7900 XTX → amd / high / discrete", () => {
  const g = classifyGpu("AMD Radeon RX 7900 XTX");
  assert.equal(g.vendor, "amd");
  assert.equal(g.tier, "high");
  assert.equal(g.isIntegrated, false);
});

test("AMD RX 6700 XT → amd / high / discrete", () => {
  const g = classifyGpu("AMD Radeon RX 6700 XT");
  assert.equal(g.vendor, "amd");
  assert.equal(g.tier, "high");
});

test("AMD RX 5500 XT → amd / mid / discrete", () => {
  const g = classifyGpu("AMD Radeon RX 5500 XT");
  assert.equal(g.vendor, "amd");
  assert.equal(g.tier, "mid");
});

test("AMD RX 580 → amd / low / discrete", () => {
  const g = classifyGpu("AMD Radeon RX 580");
  assert.equal(g.vendor, "amd");
  assert.equal(g.tier, "low");
  assert.equal(g.isIntegrated, false);
});

test("AMD Vega 8 (APU iGPU) → amd / low / INTEGRATED", () => {
  const g = classifyGpu("AMD Radeon Vega 8 Graphics");
  assert.equal(g.vendor, "amd");
  assert.equal(g.isIntegrated, true);
  assert.equal(g.tier, "low");
});

test("AMD Ryzen Radeon Graphics (APU iGPU) → amd / INTEGRATED", () => {
  const g = classifyGpu("AMD Ryzen 7 5700G with Radeon Graphics");
  assert.equal(g.vendor, "amd");
  assert.equal(g.isIntegrated, true);
});

test("AMD Radeon Pro W6800 → amd / pro / discrete", () => {
  const g = classifyGpu("AMD Radeon Pro W6800");
  assert.equal(g.vendor, "amd");
  assert.equal(g.tier, "pro");
  assert.equal(g.isIntegrated, false);
});

test("Intel UHD Graphics 630 → intel / low / INTEGRATED", () => {
  const g = classifyGpu("Intel(R) UHD Graphics 630");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, true);
  assert.equal(g.tier, "low");
});

test("Intel Iris Xe → intel / low / INTEGRATED", () => {
  const g = classifyGpu("Intel(R) Iris(R) Xe Graphics");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, true);
});

test("Intel Arc A770 → intel / mid / DISCRETE", () => {
  const g = classifyGpu("Intel Arc A770");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, false, "Arc is Intel's only discrete family");
  assert.equal(g.tier, "mid");
});

test("Intel Arc A770 with (TM) marker → intel / mid / DISCRETE (Task #62)", () => {
  // Windows DXDiag/WMI inserts "(TM)" between "Arc" and the model. Both the
  // isIntegrated guard AND the tier regex must tolerate it.
  const g = classifyGpu("Intel(R) Arc(TM) A770 Graphics");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, false);
  assert.equal(g.tier, "mid");
});

test("Intel Arc B580 with (TM) marker → intel / mid / DISCRETE", () => {
  const g = classifyGpu("Intel(R) Arc(TM) B580 Graphics");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, false);
  assert.equal(g.tier, "mid");
});

test("Intel Arc Pro A60 → intel / mid / DISCRETE", () => {
  const g = classifyGpu("Intel(R) Arc(TM) Pro A60 Graphics");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, false);
  assert.equal(g.tier, "mid");
});

test("Intel Arc B580 → intel / mid / DISCRETE", () => {
  const g = classifyGpu("Intel Arc B580");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, false);
  assert.equal(g.tier, "mid");
});

test("Intel HD Graphics 4000 → intel / low / INTEGRATED", () => {
  const g = classifyGpu("Intel(R) HD Graphics 4000");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, true);
});

test("Empty / garbage → unknown vendor", () => {
  const g = classifyGpu("Microsoft Basic Render Driver");
  assert.equal(g.vendor, "unknown");
});

// ---------------------------------------------------------------------------
// splitGpuList — hybrid string parsing
// ---------------------------------------------------------------------------

test("splitGpuList: semicolon-separated hybrid string", () => {
  const list = splitGpuList(
    "Intel(R) UHD Graphics 630; NVIDIA GeForce RTX 3060 Laptop GPU"
  );
  assert.equal(list.length, 2, `expected 2 GPUs, got ${list.length}: ${JSON.stringify(list)}`);
  assert.ok(/intel/i.test(list[0]));
  assert.ok(/nvidia/i.test(list[1]));
});

test("splitGpuList: newline-separated hybrid string", () => {
  const list = splitGpuList(
    "Intel(R) UHD Graphics 630\nNVIDIA GeForce RTX 3060 Laptop GPU"
  );
  assert.equal(list.length, 2);
});

test("splitGpuList: pipe-separated hybrid string", () => {
  const list = splitGpuList("AMD Radeon RX 6700 XT | Intel UHD Graphics 770");
  assert.equal(list.length, 2);
});

test("splitGpuList: single discrete name stays intact (NVIDIA RTX 3060)", () => {
  const list = splitGpuList("NVIDIA GeForce RTX 3060 Laptop GPU");
  assert.equal(list.length, 1, `expected single GPU, got ${JSON.stringify(list)}`);
  assert.equal(list[0], "NVIDIA GeForce RTX 3060 Laptop GPU");
});

test("splitGpuList: single AMD name stays intact", () => {
  const list = splitGpuList("AMD Radeon RX 7900 XTX");
  assert.equal(list.length, 1);
});

test("splitGpuList: run-on vendor boundary (Intel<sp>NVIDIA) splits correctly", () => {
  const list = splitGpuList(
    "Intel(R) UHD Graphics 630 NVIDIA GeForce RTX 3060 Laptop GPU"
  );
  assert.equal(list.length, 2, `expected 2 GPUs, got ${JSON.stringify(list)}`);
  assert.ok(/intel/i.test(list[0]));
  assert.ok(/nvidia/i.test(list[1]));
});

test("splitGpuList: de-duplicates case-insensitively", () => {
  const list = splitGpuList(
    "NVIDIA GeForce RTX 4090\nNVIDIA GeForce RTX 4090\nnvidia geforce rtx 4090"
  );
  assert.equal(list.length, 1);
});

test("splitGpuList: empty string → []", () => {
  assert.deepEqual(splitGpuList(""), []);
});

console.log(`\n[hardware-info] ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
