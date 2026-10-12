import { readFileSync, writeFileSync } from "node:fs";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";
import { buildNativeBatchCommandFix } from "../server/native-batch-command-fixes";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";
import ts from "typescript";

// Fixed reviewed scope. Use the same checked runtime as authenticated server
// delivery; every bundled action still requires live native Pro authorization.
const file = new URL("../src-tauri/resources/native-tweak-scripts.json", import.meta.url);
const scripts = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
const additions = ["DisableCoreParking", "Win11ParkingCoreOverride", "Win11ProcessorIdleMin", "su_chrome", "FiveMSteamOverlayOff", "Win11Widgets", "ProcSvc_cbdhsvc", "ProcSvc_OneSyncSvc", "ProcSvc_ApplyAll", "WinTitusAdobeBlock", "WinTitusEdgeRemove", "WinTitusServicesManual", "CodDefenderExclusion"];
const routes = ts.createSourceFile("routes.ts", readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const originalCommands = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "TWEAK_COMMANDS" && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    for (const property of node.initializer.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && ts.isNoSubstitutionTemplateLiteral(property.initializer)) {
        originalCommands.set(property.name.text, property.initializer.text);
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(routes);
for (const id of additions) {
  const command = originalCommands.get(id);
  if (!command) throw new Error(`Missing reviewed source command: ${id}`);
  const corrected = buildSafeWindowsCommandOverride(id) ?? buildNativeBatchCommandFix(id, command);
  if (!corrected) throw new Error(`Missing logged command correction: ${id}`);
  scripts[id] = buildSingleTweakPowerShell(id, corrected);
}
// Keep the exact build-time allowlist aligned; never weaken or bypass it.
const buildSource = readFileSync(new URL("../src-tauri/build.rs", import.meta.url), "utf8");
const requiredLine = buildSource.match(/^\$required = @\(([^)\r\n]+)\)$/m);
if (!requiredLine) throw new Error("Missing build-time reviewed script allowlist.");
const requiredIds = [...requiredLine[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
const missing = requiredIds.filter(id => !(id in scripts));
const unexpected = Object.keys(scripts).filter(id => !requiredIds.includes(id));
if (new Set(requiredIds).size !== requiredIds.length || missing.length || unexpected.length) {
  throw new Error(`Reviewed bundle scope mismatch: missing [${missing}], unexpected [${unexpected}].`);
}
for (const [id, script] of Object.entries(scripts)) {
  if (!script.includes("__OG_RESULT:APPLIED") || !script.includes("__OG_RESULT:SKIPPED")) {
    throw new Error(`Missing checked terminal markers for ${id}.`);
  }
}
writeFileSync(file, JSON.stringify(scripts, null, 2) + "\n");
console.log(`Preserved the original reviewed resources and generated ${additions.length} logged corrections; ${Object.keys(scripts).length} total. No Windows build started.`);
