import { readFileSync, writeFileSync } from "node:fs";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";

// Keep the approved ID set unchanged and use the same checked runtime as the
// authenticated server delivery. Do not introduce an entitlement bypass.
const file = new URL("../src-tauri/resources/native-tweak-scripts.json", import.meta.url);
const scripts = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
for (const [id, script] of Object.entries(scripts)) {
  let body = buildSafeWindowsCommandOverride(id);
  const start = script.indexOf("  & { ");
  const end = script.lastIndexOf(" } 6>&1");
  if (start < 0 || end <= start) throw new Error(`Cannot safely regenerate the reviewed wrapper for ${id}.`);
  body ??= script.slice(start + "  & { ".length, end);
  const rebuilt = buildSingleTweakPowerShell(id, body);
  if (!rebuilt) throw new Error(`No checked reviewed wrapper for ${id}.`);
  scripts[id] = rebuilt;
}
writeFileSync(file, JSON.stringify(scripts, null, 2) + "\n");
console.log(`Regenerated ${Object.keys(scripts).length} reviewed script resources; no Windows build started.`);
