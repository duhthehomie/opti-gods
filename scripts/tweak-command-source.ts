// Reads TWEAK_COMMANDS from server/routes.ts as text (importing routes.ts
// would start the Express server). Shared by the smoke test and generators.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function extractTweakCommands(): Record<string, string> {
  const src = readFileSync(join(process.cwd(), "server", "routes.ts"), "utf8");
  const startIdx = src.indexOf("const TWEAK_COMMANDS");
  if (startIdx < 0) throw new Error("TWEAK_COMMANDS block not found in server/routes.ts");
  // Find the matching closing `};` by counting brace depth from the first `{`.
  const braceOpen = src.indexOf("{", startIdx);
  let depth = 0;
  let endIdx = -1;
  let inTemplate = false; // inside `…` — skip braces (PS scriptblocks contain `{`/`}`)
  let inSingle = false;   // inside '…' single-quoted JS string
  let inDouble = false;   // inside "…" double-quoted JS string
  let inLineCmt = false;
  for (let i = braceOpen; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];
    if (inLineCmt) { if (ch === "\n") inLineCmt = false; continue; }
    if (inTemplate) { if (ch === "`" && prev !== "\\") inTemplate = false; continue; }
    if (inSingle)   { if (ch === "'" && prev !== "\\") inSingle = false; continue; }
    if (inDouble)   { if (ch === '"' && prev !== "\\") inDouble = false; continue; }
    if (ch === "/" && src[i + 1] === "/") { inLineCmt = true; continue; }
    if (ch === "`")  { inTemplate = true; continue; }
    if (ch === "'")  { inSingle = true; continue; }
    if (ch === '"')  { inDouble = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  if (endIdx < 0) throw new Error("could not find end of TWEAK_COMMANDS block");
  const block = src.slice(braceOpen + 1, endIdx);

  const out: Record<string, string> = {};
  // Match `  Identifier: `...`,` — backtick-quoted, may contain escaped backticks.
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*`([\s\S]*?)`\s*,?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const id = m[1];
    // Decode TS template literal escapes: \\ -> \, \` -> `, \$ -> $
    const cmd = m[2].replace(/\\`/g, "`").replace(/\\\$/g, "$").replace(/\\\\/g, "\\");
    out[id] = cmd;
  }
  return out;
}

