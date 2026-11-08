import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { REVIEWED_PERFORMANCE_COMMANDS, REVIEWED_PERFORMANCE_UNDO } from "../server/cs2-network-commands";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";

// Run normally for this checkout, or pass a verified release checkout path.
// Never overwrite a release's entire existing native bundle or build script.
const root = resolve(process.argv[2] ?? ".");
const folder = join(root, "src-tauri/resources/reviewed");
mkdirSync(folder, { recursive: true });
for (const [id, command] of Object.entries(REVIEWED_PERFORMANCE_COMMANDS)) {
  writeFileSync(join(folder, `${id}.ps1`), command);
  writeFileSync(join(folder, `${id}-undo.ps1`), REVIEWED_PERFORMANCE_UNDO[id]);
}
const bundlePath = join(root, "src-tauri/resources/native-tweak-scripts.json");
if (existsSync(bundlePath)) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  for (const [id, command] of Object.entries(REVIEWED_PERFORMANCE_COMMANDS)) {
    bundle[id] = buildSingleTweakPowerShell(id, command);
  }
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + "\n");
  const buildPath = join(root, "src-tauri/build.rs");
  let build = readFileSync(buildPath, "utf8");
  if (!/^\$required = @\(([^)\r\n]+)\)$/m.test(build)) throw new Error("Release reviewed-script allowlist not found.");
  build = build.replace(/^\$required = @\(([^)\r\n]+)\)$/m, (_, list: string) => {
    const ids = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
    for (const id of Object.keys(REVIEWED_PERFORMANCE_COMMANDS)) if (!ids.includes(id)) ids.push(id);
    return "$required = @(" + ids.map(id => `'${id}'`).join(",") + ")";
  });
  writeFileSync(buildPath, build);
}
console.log(`Synced reviewed CS2/network resources into ${root}`);
