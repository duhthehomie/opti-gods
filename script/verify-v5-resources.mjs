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
    !miscSource.includes('.join("resources").join("nvidia-profile-inspector")') ||
    !miscSource.includes('.current_dir(&inspector_dir)')) {
  throw new Error("Tauri array-resource runtime paths are missing");
}
const files = {
  "src-tauri/resources/msi-utility/MSI_util_v3.exe": "695800afad96f858a3f291b7df21c16649528f13d39b63fb7c233e5676c8df6f",
  "src-tauri/resources/nvidia-profile-inspector/nvidiaProfileInspector.exe": "1ebd8129b3c564bf226291fb3344819fd59668066f0c5e03334a69a04a62859e",
  "src-tauri/resources/nvidia-profile-inspector/Reference.xml": "0ea7b055aee5c543047243d2dd7abdd1b8c6d96f5d2b7bb5fe17be8130e005ef",
  "src-tauri/resources/nvidia-profile-inspector/nvidiaProfileInspector.exe.config": "051099983b896673909e01a1f631b6652abb88da95c9f06f3efef4be033091fa",
  "src-tauri/resources/nvidia-profile-inspector/OptiGods-Global.nip": "495a88042d441c91c1aaa7ce79c69ef2e18e27aaaf02c49da7fed39917289f85",
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
  ["0x10835002", "0x00000000"], ["0x0098C1AC", "0x00000000"], ["0x2072C5A3", "0x00000002"],
  ["0x1057EB71", "0x00000001"], ["0x00E73211", "0x00000001"], ["0x0019BB68", "0x00000000"],
  ["0x00CE2691", "0x00000014"], ["0x002ECAF2", "0x00000000"], ["0x20C1221E", "0x00000000"],
  ["0x20FDD1F9", "0x00000000"], ["0x00A879CF", "0x60925292"], ["0x20D690F8", "0x00000002"],
];
for (const [id, value] of mappings) if (!nip.includes(`<SettingID>${id}</SettingID>`) || !nip.includes(`<SettingValue>${value}</SettingValue>`)) throw new Error(`Missing NVIDIA mapping ${id}=${value}`);
console.log("v5 resource hashes and preset shape verified.");