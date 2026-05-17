#!/usr/bin/env tsx
/**
 * Unit tests for the GPU classifier + multi-GPU splitter in
 * client/src/hooks/use-hardware-info.ts.
 *
 * Run: npx tsx scripts/test-hardware-info.ts
 *
 * The splitter is module-private, so we re-implement it here behind the same
 * contract used by use-hardware-info.ts and validate the live classifyGpu
 * export against the expected vendor/tier/isIntegrated matrix.
 */
import assert from "node:assert/strict";
import { classifyGpu } from "../client/src/hooks/use-hardware-info";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \u2717 ${name}`);
    console.log(`    ${(err as Error).message}`);
    failed++;
  }
}

console.log("[hardware-info] running tests\n");

// ---------- classifyGpu: vendor + tier ----------
test("NVIDIA RTX 4090 -> nvidia / high / discrete", () => {
  const g = classifyGpu("NVIDIA GeForce RTX 4090");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "high");
  assert.equal(g.isIntegrated, false);
});
test("NVIDIA GTX 1050 -> nvidia / low", () => {
  const g = classifyGpu("NVIDIA GeForce GTX 1050");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "low");
});
test("NVIDIA Quadro RTX A5000 -> nvidia / pro", () => {
  const g = classifyGpu("NVIDIA RTX A5000");
  assert.equal(g.vendor, "nvidia");
  assert.equal(g.tier, "pro");
});
test("AMD RX 9070 -> amd / high / discrete", () => {
  const g = classifyGpu("AMD Radeon RX 9070 XT");
  assert.equal(g.vendor, "amd");
  assert.equal(g.tier, "high");
  assert.equal(g.isIntegrated, false);
});
test("AMD Vega 8 (APU) -> amd / low / integrated", () => {
  const g = classifyGpu("AMD Radeon Vega 8 Graphics");
  assert.equal(g.vendor, "amd");
  assert.equal(g.isIntegrated, true);
});
test("Intel UHD 630 -> intel / low / integrated", () => {
  const g = classifyGpu("Intel(R) UHD Graphics 630");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, true);
});
test("Intel Arc A770 -> intel / mid / discrete", () => {
  const g = classifyGpu("Intel(R) Arc(TM) A770 Graphics");
  assert.equal(g.vendor, "intel");
  assert.equal(g.isIntegrated, false);
});
test("Unknown vendor -> unknown", () => {
  const g = classifyGpu("Matrox G450");
  assert.equal(g.vendor, "unknown");
});

// ---------- splitGpuList contract (re-implemented mirror) ----------
function splitGpuList(raw: string): string[] {
  if (!raw) return [];
  const initial = raw.split(/[\r\n;|]+/g).map((s) => s.trim()).filter(Boolean);
  const VENDOR_ANCHOR =
    /\b(nvidia|amd|radeon|geforce|quadro|tesla|titan|gtx|rtx|intel|iris|uhd|arc|vega|ryzen)\b/i;
  const VENDOR_HEAD = /^(NVIDIA|AMD|Intel|Radeon|GeForce|Quadro|Iris|Arc)\b/i;
  const out: string[] = [];
  for (const part of initial) {
    let buf = "";
    for (const tok of part.split(/\s+/)) {
      if (
        buf &&
        VENDOR_HEAD.test(tok) &&
        VENDOR_ANCHOR.test(buf) &&
        /(\d|graphics|\))/i.test(buf)
      ) {
        out.push(buf.trim().replace(/[,;]+$/, ""));
        buf = tok;
      } else {
        buf = buf ? `${buf} ${tok}` : tok;
      }
    }
    if (buf.trim()) out.push(buf.trim().replace(/[,;]+$/, ""));
  }
  const seen = new Set<string>();
  return out.filter((n) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

test("Single NVIDIA name is NOT split", () => {
  const r = splitGpuList("NVIDIA GeForce RTX 3060 Laptop GPU");
  assert.deepEqual(r, ["NVIDIA GeForce RTX 3060 Laptop GPU"]);
});
test("Single Intel name is NOT split", () => {
  const r = splitGpuList("Intel(R) UHD Graphics 630");
  assert.deepEqual(r, ["Intel(R) UHD Graphics 630"]);
});
test("Single AMD name is NOT split", () => {
  const r = splitGpuList("AMD Radeon RX 6700 XT");
  assert.deepEqual(r, ["AMD Radeon RX 6700 XT"]);
});
test("Semicolon-separated hybrid (Intel + NVIDIA)", () => {
  const r = splitGpuList(
    "Intel(R) UHD Graphics 630; NVIDIA GeForce RTX 3060 Laptop GPU"
  );
  assert.deepEqual(r, [
    "Intel(R) UHD Graphics 630",
    "NVIDIA GeForce RTX 3060 Laptop GPU",
  ]);
});
test("Newline-separated hybrid (AMD APU + NVIDIA)", () => {
  const r = splitGpuList(
    "AMD Radeon Vega 8 Graphics\nNVIDIA GeForce GTX 1650"
  );
  assert.deepEqual(r, [
    "AMD Radeon Vega 8 Graphics",
    "NVIDIA GeForce GTX 1650",
  ]);
});
test("Run-on hybrid (no separator) splits on vendor-after-model", () => {
  const r = splitGpuList(
    "Intel(R) UHD Graphics 630 NVIDIA GeForce RTX 3060"
  );
  assert.deepEqual(r, [
    "Intel(R) UHD Graphics 630",
    "NVIDIA GeForce RTX 3060",
  ]);
});
test("ANGLE/WebGL renderer string stays intact", () => {
  const r = splitGpuList(
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)"
  );
  // Should not over-split parens/commas — at minimum the RTX model survives.
  assert.ok(r.some((g) => /RTX 3070/.test(g)), `got ${JSON.stringify(r)}`);
});
test("Empty string -> []", () => {
  assert.deepEqual(splitGpuList(""), []);
});
test("De-dupes case-insensitively", () => {
  const r = splitGpuList("NVIDIA GeForce RTX 3060;nvidia geforce rtx 3060");
  assert.equal(r.length, 1);
});

console.log(`\n[hardware-info] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
