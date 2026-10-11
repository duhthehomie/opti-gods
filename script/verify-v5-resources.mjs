import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const permissions = readFileSync(resolve(root, "src-tauri/permissions/app-commands.toml"), "utf8");
if (!permissions.includes('identifier = "allow-open-msi-utility"') ||
    !permissions.includes('identifier = "allow-import-nvidia-preset"')) {
  throw new Error("Dedicated NVIDIA command permissions are missing");
}
const miscSource = readFileSync(resolve(root, "src-tauri/src/commands/misc.rs"), "utf8");
if (!miscSource.includes('.join("resources").join("msi-utility")') ||
    !miscSource.includes('.join("resources").join("nvidia-profile-inspector")')) {
  throw new Error("Tauri array-resource runtime paths are missing");
}
if (!miscSource.includes("nvidia_profile::apply(&settings") || !miscSource.includes("nvidia_profile::verify(&settings")) {
  throw new Error("Direct NVIDIA transaction and final readback are missing");
}
const cplScript = resolve(root, "src-tauri/src/commands/nvidia-cpl-settings.ps1");
if (!existsSync(cplScript)) throw new Error("NVIDIA Control Panel verification source is missing");
if (process.platform === "win32") {
  execFileSync(resolve(process.env.SystemRoot || "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", "$tokens=$null; $errors=$null; $null=[System.Management.Automation.Language.Parser]::ParseFile($env:OPTI_CPL_SCRIPT,[ref]$tokens,[ref]$errors); if($errors.Count){throw ($errors.Message -join '; ')}"], {env: {...process.env, OPTI_CPL_SCRIPT: cplScript}, stdio: "inherit", timeout: 15000});
}
const files = {
  "src-tauri/resources/msi-utility/MSI_util_v3.exe": "695800afad96f858a3f291b7df21c16649528f13d39b63fb7c233e5676c8df6f",
  "src-tauri/resources/nvidia-profile-inspector/nvidiaProfileInspector.exe": "1ebd8129b3c564bf226291fb3344819fd59668066f0c5e03334a69a04a62859e",
  "src-tauri/resources/nvidia-profile-inspector/Reference.xml": "0ea7b055aee5c543047243d2dd7abdd1b8c6d96f5d2b7bb5fe17be8130e005ef",
  "src-tauri/resources/nvidia-profile-inspector/nvidiaProfileInspector.exe.config": "051099983b896673909e01a1f631b6652abb88da95c9f06f3efef4be033091fa",
  "src-tauri/resources/nvidia-profile-inspector/OptiGods-Global.nip": "3cf4bc8ad521a637e909f7e33aaf696a919cbb7590523e745ba47cb18cf87eb3",
  "src-tauri/resources/nvidia-profile-inspector/OptiGods-Global-utf8.nip": "4fb0dee44642bf9fe23e147096d876974c22c30e556bb8309d35f80fbbb172bb",
};
for (const [relative, expected] of Object.entries(files)) {
  const path = resolve(root, relative);
  if (!existsSync(path) || statSync(path).size < 32) throw new Error(`Missing or implausibly small resource: ${relative}`);
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== expected) throw new Error(`Hash mismatch for ${relative}: ${actual}`);
}
const nipPath = resolve(root, "src-tauri/resources/nvidia-profile-inspector/OptiGods-Global.nip");
const nipBytes = readFileSync(nipPath);
if (!(nipBytes[0] === 0xff && nipBytes[1] === 0xfe)) throw new Error("NVIDIA preset must be UTF-16LE with BOM");
const nip = nipBytes.subarray(2).toString("utf16le");
if (!nip.includes("<ArrayOfProfile>") || !nip.includes("<ProfileName>GLOBAL DRIVER PROFILE</ProfileName>")) throw new Error("NVIDIA preset shape is invalid");
const mappings = [
  ["0x10835002", "0x00000000"], ["0x0098C1AC", "0x00000000"], ["0x2072C5A3", "0x00000000"],
  ["0x1057EB71", "0x00000001"], ["0x00E73211", "0x00000001"], ["0x0019BB68", "0x00000000"],
  ["0x00CE2691", "0x00000014"], ["0x002ECAF2", "0x00000001"], ["0x20C1221E", "0x00000000"],
  ["0x20FDD1F9", "0x00000000"], ["0x00A879CF", "0x08416747"], ["0x20D690F8", "0x00000002"],
  ["0x0064B541", "0x00000001"], ["0x10A879CF", "0x00000004"],
];
const utf8 = readFileSync(resolve(root, "src-tauri/resources/nvidia-profile-inspector/OptiGods-Global-utf8.nip"), "utf8");
function settings(xml) {
  const result = new Map();
  for (const match of xml.matchAll(/<ProfileSetting>([\s\S]*?)<\/ProfileSetting>/g)) {
    const id = Number(match[1].match(/<SettingID>(.*?)<\/SettingID>/)?.[1]);
    const value = Number(match[1].match(/<SettingValue>(.*?)<\/SettingValue>/)?.[1]);
    if (!Number.isInteger(id) || !Number.isInteger(value) || result.has(id)) throw new Error("Invalid or duplicate NVIDIA setting");
    result.set(id, value);
  }
  return result;
}
for (const xml of [nip, utf8]) {
  const actual = settings(xml);
  if (actual.size !== mappings.length) throw new Error("NVIDIA preset setting count differs from approved mappings");
  for (const [id, value] of mappings) {
    if (actual.get(Number(id)) !== Number(value)) throw new Error(`Wrong NVIDIA mapping ${id}=${value}`);
  }
}
if (!miscSource.includes(files["src-tauri/resources/nvidia-profile-inspector/OptiGods-Global-utf8.nip"])) {
  throw new Error("Native preset integrity hash is not aligned with the bundle");
}
console.log("v5 resource hashes and both approved NVIDIA preset copies verified.");
