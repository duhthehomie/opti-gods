import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ACTIVE_TCP_COMMAND, CS2_COMMAND, REVIEWED_PERFORMANCE_COMMANDS, REVIEWED_PERFORMANCE_UNDO } from "../server/cs2-network-commands";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";
import { buildSafePreset, GAME_DETECT_PACK_IDS, type PresetHardware } from "../shared/preset-builder";
import { TWEAK_REGISTRY } from "../client/src/lib/tweak-registry";
import { NATIVE_TWEAK_ID_SET } from "../shared/native-tweak-ids";

const pc: PresetHardware = { gpuVendor: "nvidia", gpuName: "RTX 3050", cpuBrand: "intel", cpuLabel: "i5-10400F", cpuCores: 12, osVersion: "win11", ramGB: 16, hasDiscreteGpu: true, isLaptop: false };
for (const rig of [pc, { ...pc, osVersion: "win10" as const }, { ...pc, gpuVendor: "amd" as const, gpuName: "RX 6600" }]) {
  const preset = buildSafePreset(rig);
  assert(preset.core.includes("ActiveAdapterTcpLatency"));
  assert(!preset.core.includes("DisableNagle") && !preset.core.includes("InputLagTCP"), "No duplicate legacy global/all-interface writes");
}
assert(GAME_DETECT_PACK_IDS.includes("game_cs2"));
for (const id of Object.keys(REVIEWED_PERFORMANCE_COMMANDS)) {
  assert(TWEAK_REGISTRY.some(tweak => tweak.id === id));
  assert(NATIVE_TWEAK_ID_SET.has(id));
  assert.equal(readFileSync(`src-tauri/resources/reviewed/${id}.ps1`, "utf8"), REVIEWED_PERFORMANCE_COMMANDS[id]);
  assert.equal(readFileSync(`src-tauri/resources/reviewed/${id}-undo.ps1`, "utf8"), REVIEWED_PERFORMANCE_UNDO[id]);
  const wrapped = buildSingleTweakPowerShell(id, REVIEWED_PERFORMANCE_COMMANDS[id])!;
  assert(wrapped.includes("__OG_RESULT:FAILED") && wrapped.includes("__OG_RESULT:APPLIED"));
  assert(REVIEWED_PERFORMANCE_COMMANDS[id].includes("Save-Originals $entries"));
  assert(REVIEWED_PERFORMANCE_COMMANDS[id].includes("$stage = 'APPLY_VERIFY'"));
}
assert(ACTIVE_TCP_COMMAND.includes("if (-not $nic.HardwareInterface)"));
assert(ACTIVE_TCP_COMMAND.includes("RouteMetric + [int]$ip.InterfaceMetric"));
for (const [name, value] of [["TCPNoDelay", 1], ["TcpAckFrequency", 1], ["TcpDelAckTicks", 0]]) {
  assert(ACTIVE_TCP_COMMAND.includes(`Name='${name}';Kind='DWord';Value=${value}`));
}
assert(ACTIVE_TCP_COMMAND.includes("OG-TCP-") && ACTIVE_TCP_COMMAND.includes("Readback failed"));
assert(!ACTIVE_TCP_COMMAND.includes("SilentlyContinue"));
assert(CS2_COMMAND.includes("appmanifest_730.acf"));
assert(CS2_COMMAND.includes("libraryfolders.vdf"));
assert(CS2_COMMAND.includes("game\\bin\\win64\\cs2.exe"));
assert(CS2_COMMAND.includes("Close Counter-Strike 2"));
assert(CS2_COMMAND.includes("Name='CpuPriorityClass';Kind='DWord';Value=6"));
assert(CS2_COMMAND.includes("GpuPreference=2") && CS2_COMMAND.includes("AutoGameModeEnabled"));
assert(!CS2_COMMAND.includes("Add-MpPreference") && !CS2_COMMAND.includes("MitigationOptions"));
const detector = readFileSync("src-tauri/src/commands/game_detection.rs", "utf8");
assert(detector.includes('id: "game_cs2", executables: &["cs2.exe"]'));
assert(detector.includes('file == "appmanifest_730.acf"'));
const page = readFileSync("client/src/pages/game-profiles.tsx", "utf8");
assert(page.includes('cover: "/game-covers/counter-strike-2.webp"'));
assert(page.includes('recommendationIds: ["game_cs2"]'));
assert(existsSync("client/public/game-covers/counter-strike-2.webp"));
console.log("PASS: CS2 discovery/profile/asset, supplied Win11 PC + Win10/AMD eligibility, Full Optimize active-GUID values, native resources, backup/Undo, and strict runner failure contracts.");
