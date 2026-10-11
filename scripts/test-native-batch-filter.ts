import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { transformSync } from "esbuild";

// Evaluate the actual page expressions: runner-only tests cannot catch a page
// dropping dedicated actions before they reach the runner.
const base = process.env.OPTI_RELEASE_TEST_ROOT || ".";
const page = ts.createSourceFile(
  "applied-tweaks.tsx",
  readFileSync(`${base}/client/src/pages/applied-tweaks.tsx`, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const runner = ts.createSourceFile(
  "native-tweak-runner.ts",
  readFileSync(`${base}/client/src/lib/native-tweak-runner.ts`, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function initializer(file: ts.SourceFile, name: string, containing?: string): string {
  let result: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer) {
      const text = node.initializer.getText(file);
      if (!containing || text.includes(containing)) result = text;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(result, `Missing production initializer: ${name}`);
  return result;
}
const predicate = runner.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "isNvidiaAction");
assert.ok(predicate, "Missing production NVIDIA action predicate");
const bindings: Record<string, unknown> = {
  NATIVE_TWEAK_ID_SET: new Set(["DisableNDU"]),
};
const compiledPredicate = transformSync(
  `const NVIDIA_PRESET_ACTION_ID = ${initializer(runner, "NVIDIA_PRESET_ACTION_ID")};
   const NVIDIA_UI_ACTION_IDS = ${initializer(runner, "NVIDIA_UI_ACTION_IDS")};
   ${predicate.getText(runner)}
   module.exports = isNvidiaAction;`,
  { loader: "ts", format: "cjs" },
).code;
const predicateModule = { exports: undefined };
runInNewContext(compiledPredicate, { module: predicateModule });
bindings.isNvidiaAction = predicateModule.exports;
const actions = ["NvidiaPreviewPerformance", "NvidiaPhysxGpu", "NvidiaControlPanelSettings"];
bindings.isScriptOnlyTweakId = (id: string) => id === "CodDefenderExclusion";
bindings.getTweakMeta = (id: string) =>
  ["DisableNDU", "CodDefenderExclusion", "OpenMsiUtilityPro"].includes(id) ? { id } : null;
bindings.getTweakCompatibility = () => ({ ok: true });
bindings.recoverable = [...actions, "DisableNDU", "CodDefenderExclusion", "OpenMsiUtilityPro", "UnknownFixtureAction"];
function evaluate(expression: string): string[] {
  const module = { exports: [] as string[] };
  runInNewContext(transformSync(`module.exports = ${expression};`, { loader: "ts", format: "cjs" }).code,
    { ...bindings, module });
  return Array.from(module.exports);
}
assert.deepEqual(evaluate(initializer(page, "nativeUnsupportedIds")),
  ["OpenMsiUtilityPro", "UnknownFixtureAction"],
  "Dedicated NVIDIA actions must survive the actual page's unsupported-action filter without metadata");

// Simulate stale browser compatibility data. Dedicated native actions must
// reach native hardware validation, not be discarded by the page.
bindings.getTweakCompatibility = () => ({ ok: false });
assert.deepEqual(evaluate(initializer(page, "hardwareSkippedIds")),
  ["DisableNDU", "CodDefenderExclusion", "OpenMsiUtilityPro", "UnknownFixtureAction"]);
bindings.skippedSet = new Set(["DisableNDU", "CodDefenderExclusion", "OpenMsiUtilityPro", "UnknownFixtureAction"]);
assert.deepEqual(evaluate(initializer(page, "executable")), actions);
const assignments: string[] = [];
const findAssignments = (node: ts.Node) => {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && node.left.getText(page) === "executable") {
    assignments.push(node.right.getText(page));
  }
  ts.forEachChild(node, findAssignments);
};
findAssignments(page);
const proFilter = assignments.find(text => text.startsWith("recoverable.filter"));
assert.ok(proFilter, "Missing post-entitlement Pro filter");
assert.deepEqual(evaluate(proFilter), actions, "Pro entitlement handling must not drop NVIDIA UI actions");
bindings.runItems = actions.map(id => ({ id, status: "queued" }));
assert.deepEqual(evaluate(initializer(page, "queuedIds")), actions);
assert.deepEqual(evaluate(initializer(page, "retryStuckIds")), actions);
bindings.latest = { items: actions.map(id => ({ id, status: "stopped" })) };
assert.deepEqual(evaluate(initializer(page, "ids", "latest?.items")), actions);

// Free entitlement still permits only explicitly registered free-native IDs.
const freeFilter = assignments.find(text => text.startsWith("allowanceCandidates"));
assert.ok(freeFilter, "Missing free allowance filter");
bindings.allowanceCandidates = [...actions, "DisableNDU"];
bindings.FREE_NATIVE_TWEAK_LIMIT = 15;
assert.deepEqual(evaluate(freeFilter), ["DisableNDU"], "NVIDIA actions must remain Pro-only");
console.log("[native-batch-filter] PASS: dedicated NVIDIA actions survive page, Pro, queued and stuck-retry filters; unknown actions and free access remain blocked");
