import { readFileSync, writeFileSync } from "node:fs";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";

// Keep the approved ID set and strict result wrapper unchanged. Regenerate
// only reviewed command bodies; do not introduce a remote execution fallback.
const file = new URL("../src-tauri/resources/native-tweak-scripts.json", import.meta.url);
const scripts = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
for (const [id, script] of Object.entries(scripts)) {
  const body = buildSafeWindowsCommandOverride(id);
  if (!body) continue;
  const start = script.indexOf("  & { ");
  const end = script.lastIndexOf(" } 6>&1");
  if (start < 0 || end <= start) throw new Error(`Cannot safely regenerate the reviewed wrapper for ${id}.`);
  scripts[id] = `${script.slice(0, start)}  & { ${body}${script.slice(end)}`;
}
writeFileSync(file, JSON.stringify(scripts, null, 2) + "\n");
console.log(`Regenerated ${Object.keys(scripts).length} reviewed script resources; no Windows build started.`);
