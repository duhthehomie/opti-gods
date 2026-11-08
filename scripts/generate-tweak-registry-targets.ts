/**
 * Builds client/src/generated/tweak-registry-targets.ts: for each tweak, the
 * registry values its PowerShell command always writes (literal hive, path,
 * name and value). The admin recorder reads these back, read-only, to show
 * which tweaks are really applied or missing on this PC.
 *
 * Only unconditional writes are kept: anything inside if/foreach/switch blocks,
 * or using variables that are not literal registry paths, is skipped so a
 * hardware-dependent write can never be reported as "missing".
 *
 * Run: npx tsx scripts/generate-tweak-registry-targets.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";
import { buildNativeBatchCommandFix } from "../server/native-batch-command-fixes";
import { extractTweakCommands } from "./tweak-command-source";

export type RegistryTarget = {
  hive: "HKLM" | "HKCU";
  path: string;
  name: string;
  type: "dword" | "qword" | "sz";
  value: number | string;
};

export const REGISTRY_TARGETS_FILE = join(process.cwd(), "client", "src", "generated", "tweak-registry-targets.ts");

const HIVE = /^(HKLM|HKCU|HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER)(?::)?\\+(.+)$/i;

function normalizeSystemResponsiveness(command: string): string {
  // Same clamp server/routes.ts applies before any command is served.
  const clampAboveTen = (match: string, prefix: string, value: string) => (Number(value) > 10 ? `${prefix}10` : match);
  return command
    .replace(/((?:-Name\s+)?['"]SystemResponsiveness['"]\s+(?:-Value\s+)?)(\d+)/gi, clampAboveTen)
    .replace(/(SystemResponsiveness=)(\d+)/gi, clampAboveTen);
}

function splitHive(raw: string): { hive: "HKLM" | "HKCU"; path: string } | null {
  const cleaned = raw.replace(/^Registry::/i, "").replace(/\\\\/g, "\\").replace(/\\+$/, "");
  const match = cleaned.match(HIVE);
  if (!match || /[$`*?]/.test(match[2])) return null;
  const hive = /^(HKLM|HKEY_LOCAL_MACHINE)$/i.test(match[1]) ? "HKLM" : "HKCU";
  return { hive, path: match[2] };
}

function tokens(statement: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^']|'')*)'|"([^"`$]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(statement))) {
    if (m[1] != null) out.push(`'${m[1].replace(/''/g, "'")}`);
    else if (m[2] != null) out.push(`'${m[2]}`);
    else out.push(m[3]);
  }
  return out;
}

const literal = (token: string | undefined) => (token?.startsWith("'") ? token.slice(1) : null);

function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text, 16);
  return null;
}

function valueFor(rawValue: string | null, bare: string | undefined, type: string): RegistryTarget["value"] | null {
  if (type === "sz") return rawValue ?? (bare && /^[\w.\-]+$/.test(bare) ? bare : null);
  const n = parseNumber(rawValue ?? bare);
  if (n == null) return null;
  return type === "dword" ? (n < 0 ? n >>> 0 : n) : n;
}

function typeFor(raw: string | undefined): RegistryTarget["type"] | null {
  const t = (raw ?? "dword").replace(/^'/, "").toLowerCase();
  if (t === "dword" || t === "reg_dword") return "dword";
  if (t === "qword" || t === "reg_qword") return "qword";
  if (t === "string" || t === "reg_sz") return "sz";
  return null;
}

/** Top-level statements only; returns each with whether it sits inside a conditional block. */
function statements(command: string): Array<{ text: string; conditional: boolean }> {
  const out: Array<{ text: string; conditional: boolean }> = [];
  const stack: boolean[] = []; // true when the open block is conditional
  let current = "";
  let quote: string | null = null;
  const flush = () => {
    if (current.trim()) out.push({ text: current.trim(), conditional: stack.some(Boolean) });
    current = "";
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
    if (ch === "#" && /(^|\s)$/.test(current)) {
      while (i < command.length && command[i] !== "\n") i++;
      flush();
      continue;
    }
    if (ch === "{") {
      const before = current.trimEnd();
      // try/catch/finally and plain script blocks run unconditionally; everything else may not.
      const unconditional = /(^|[\s;}])(try|finally)$/i.test(before) || before === "";
      flush();
      stack.push(!unconditional || stack.length > 0 && stack[stack.length - 1]);
      continue;
    }
    if (ch === "}") { flush(); stack.pop(); continue; }
    if (ch === ";" || ch === "\n" || ch === "|") { flush(); continue; }
    current += ch;
  }
  flush();
  return out;
}

export function parseRegistryWrites(command: string): RegistryTarget[] {
  const vars = new Map<string, string>();
  const writes = new Map<string, RegistryTarget>();
  for (const { text, conditional } of statements(command)) {
    const assign = text.match(/^\$(\w+)\s*=\s*['"]([^'"$`]+)['"]$/);
    if (assign) {
      if (conditional) vars.delete(assign[1].toLowerCase());
      else vars.set(assign[1].toLowerCase(), assign[2]);
      continue;
    }
    if (conditional) continue;

    const reg = text.match(/^reg(?:\.exe)?\s+add\s+("[^"]+"|\S+)(.*)$/i);
    if (reg) {
      const key = splitHive(reg[1].replace(/"/g, ""));
      const rest = reg[2];
      const name = rest.match(/\/v\s+("[^"]+"|\S+)/i)?.[1].replace(/"/g, "");
      const type = typeFor(rest.match(/\/t\s+(\S+)/i)?.[1]);
      const data = rest.match(/\/d\s+("[^"]*"|\S+)/i)?.[1].replace(/"/g, "");
      const value = type && data != null ? valueFor(type === "sz" ? data : null, data, type) : null;
      if (key && name && type && value != null) {
        writes.set(`${key.hive}\\${key.path}\\${name}`.toLowerCase(), { ...key, name, type, value });
      }
      continue;
    }

    const cmd = text.match(/^(Set-ItemProperty|New-ItemProperty|sp)\s+(.*)$/i);
    if (!cmd) continue;
    const args = tokens(cmd[2]);
    const named = new Map<string, string>();
    const positional: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (/^-\w+$/.test(arg)) {
        const key = arg.slice(1).toLowerCase();
        if (["force", "erroraction", "ea"].includes(key)) {
          if (key !== "force") i++;
          continue;
        }
        named.set(key, args[i + 1] ?? "");
        i++;
      } else {
        positional.push(arg);
      }
    }
    const pathToken = named.get("path") ?? named.get("literalpath") ?? positional[0];
    let rawPath = literal(pathToken);
    if (rawPath == null && pathToken?.startsWith("$")) rawPath = vars.get(pathToken.slice(1).toLowerCase()) ?? null;
    const key = rawPath ? splitHive(rawPath) : null;
    const name = literal(named.get("name") ?? positional[1]) ?? (named.get("name") ?? positional[1])?.match(/^[\w.\-]+$/)?.[0];
    const type = typeFor(named.get("type") ?? named.get("propertytype"));
    const valueToken = named.get("value") ?? positional[2];
    const value = type && valueToken ? valueFor(literal(valueToken), valueToken.startsWith("'") ? undefined : valueToken, type) : null;
    if (key && name && type && value != null) {
      writes.set(`${key.hive}\\${key.path}\\${name}`.toLowerCase(), { ...key, name, type, value });
    }
  }
  return Array.from(writes.values());
}

export function buildRegistryTargets(commands: Record<string, string>): Record<string, RegistryTarget[]> {
  const out: Record<string, RegistryTarget[]> = {};
  for (const id of Object.keys(commands).sort()) {
    const served = buildNativeBatchCommandFix(id, commands[id] ?? "") ?? buildSafeWindowsCommandOverride(id) ?? commands[id];
    const targets = parseRegistryWrites(normalizeSystemResponsiveness(served));
    if (targets.length) out[id] = targets;
  }
  return out;
}

export function renderRegistryTargetsFile(targets: Record<string, RegistryTarget[]>): string {
  return [
    "// Generated by scripts/generate-tweak-registry-targets.ts from TWEAK_COMMANDS. Do not edit.",
    "// Registry values each tweak always writes; read back (never written) by the admin recorder.",
    "export type TweakRegistryTarget = { hive: \"HKLM\" | \"HKCU\"; path: string; name: string; type: \"dword\" | \"qword\" | \"sz\"; value: number | string };",
    `export const TWEAK_REGISTRY_TARGETS: Record<string, TweakRegistryTarget[]> = ${JSON.stringify(targets, null, 1)};`,
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const targets = buildRegistryTargets(extractTweakCommands());
  writeFileSync(REGISTRY_TARGETS_FILE, renderRegistryTargetsFile(targets));
  const values = Object.values(targets).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`[registry-targets] ${Object.keys(targets).length} tweaks, ${values} registry values -> ${REGISTRY_TARGETS_FILE}`);
}
