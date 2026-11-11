import { readRegistryValues, type RegistryReadResult } from "@/lib/tauri-bridge";
import { TWEAK_REGISTRY_TARGETS, type TweakRegistryTarget } from "@/generated/tweak-registry-targets";

/**
 * Read-only check of the registry values each tweak always writes. Shared by the
 * dashboard score and the admin recorder audit so both agree on what is applied.
 */

export type ValueCheck = { key: string; current: string; needed: string; ok: boolean };
/** Values other tweaks also write for the same key. Two tweaks that disagree
 *  (e.g. TdrDelay 8 vs 10) must not make one of them look missing forever. */
export type AcceptedValues = Map<string, Array<number | string>>;

export const regKey = (t: TweakRegistryTarget) => `${t.hive}\\${t.path}\\${t.name}`.toLowerCase();
const shownValue = (t: TweakRegistryTarget) => (t.type === "sz" ? `"${t.value}"` : `${t.value} (${t.type.toUpperCase()})`);

/** Windows names a key's default value "(Default)" in tools, but reads it by the empty name. */
export const readName = (name: string) => (name === "(Default)" ? "" : name);

/** Windows keeps every DirectX graphics preference in one "Name=value;" string, so other
 *  settings (windowed-game optimizations, Auto HDR) sit beside ours. Compare the pairs. */
function settingPairs(text: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const part of text.split(";")) {
    const [name, ...rest] = part.split("=");
    if (name.trim()) pairs.set(name.trim().toLowerCase(), rest.join("=").trim().toLowerCase());
  }
  return pairs;
}

function sameValue(target: TweakRegistryTarget, wanted: number | string, read: RegistryReadResult): boolean {
  if (target.type === "sz" && target.name === "DirectXUserGlobalSettings" && read.kind === "sz") {
    const have = settingPairs(String(read.value));
    const need = settingPairs(String(wanted));
    return need.size > 0 && Array.from(need).every(([name, value]) => have.get(name) === value);
  }
  if (target.type === "sz") return String(read.value).trim().toLowerCase() === String(wanted).trim().toLowerCase();
  if (read.kind === "dword" || read.kind === "qword") return Number(read.value) === Number(wanted);
  // Control Panel values (mouse, desktop timeouts, font smoothing) are stored by
  // Windows as text such as "1000"; the same number as text is the same setting.
  if (read.kind === "sz") return /^\s*-?\d+\s*$/.test(String(read.value)) && Number(read.value) === Number(wanted);
  return false;
}

export function checkValue(target: TweakRegistryTarget, read: RegistryReadResult | undefined, accepted?: AcceptedValues): ValueCheck {
  const key = `${target.hive}\\${target.path} · ${target.name}`;
  const needed = shownValue(target);
  // Windows treats an absent LargeSystemCache as 0 (the gaming default).
  if ((!read || read.kind === "missing") && target.name === "LargeSystemCache" && Number(target.value) === 0) {
    return { key, current: "not set (Windows default 0)", needed, ok: true };
  }
  // A service that is not installed on this PC has nothing to disable.
  if ((!read || read.kind === "missing") && target.absentOk) {
    return { key, current: "service not installed", needed, ok: true };
  }
  if (!read || read.kind === "missing") return { key, current: "not set", needed, ok: false };
  if (read.kind === "error" || read.kind === "other") return { key, current: read.kind === "error" ? `unreadable (${String(read.value)})` : "other type", needed, ok: false };
  const wanted = [...(accepted?.get(regKey(target)) ?? [target.value])];
  // A service set to Manual to stop it auto-starting is also satisfied when it is Disabled.
  if (target.absentOk && Number(target.value) === 3) wanted.push(4);
  let ok = wanted.some(value => sameValue(target, value, read));
  // NTFS last-access: Windows may rewrite 1 as 0x80000001/0x80000003 (system managed).
  // Any odd value means last-access updates are off, which is what the tweak needs.
  if (!ok && target.name === "NtfsDisableLastAccessUpdate" && Number(target.value) === 1 && (read.kind === "dword" || read.kind === "qword")) {
    ok = (Number(read.value) & 1) === 1;
  }
  return { key, current: read.kind === "sz" ? `"${read.value}"` : String(read.value), needed, ok };
}

/** Writes the FiveM Full Perf Stack makes inside a PowerShell loop, which the target
 *  generator cannot read. Without them, its IoPriority 2 makes another FiveM tweak's
 *  IoPriority 3 look missing (and the reverse). */
const IFEO = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options";
const LOOP_WRITES: Record<string, Array<{ key: string; value: number }>> = {
  FiveMFullPerfStack: ["GTA5.exe", "FiveM.exe"].flatMap(exe => [
    { key: `hklm\\${IFEO}\\${exe}\\PerfOptions\\CpuPriorityClass`.toLowerCase(), value: 3 },
    { key: `hklm\\${IFEO}\\${exe}\\PerfOptions\\IoPriority`.toLowerCase(), value: 2 },
  ]),
};

export function buildAcceptedValues(ids: Iterable<string>): AcceptedValues {
  const map: AcceptedValues = new Map();
  const add = (key: string, value: number | string) => {
    const list = map.get(key) ?? [];
    if (!list.some(v => String(v) === String(value))) list.push(value);
    map.set(key, list);
  };
  for (const id of Array.from(ids)) {
    for (const t of TWEAK_REGISTRY_TARGETS[id] ?? []) add(regKey(t), t.value);
    for (const w of LOOP_WRITES[id] ?? []) add(w.key, w.value);
  }
  return map;
}

export type RegistryReadback = Map<string, RegistryReadResult>;

/** One native read of every value the given tweaks write. Never writes. */
export async function readTweakRegistry(ids: Iterable<string>): Promise<RegistryReadback> {
  const queries = new Map<string, TweakRegistryTarget>();
  for (const id of Array.from(ids)) for (const target of TWEAK_REGISTRY_TARGETS[id] ?? []) queries.set(regKey(target), target);
  const list = Array.from(queries.values());
  if (!list.length) return new Map();
  const results = await readRegistryValues(list.map(({ hive, path, name }) => ({ hive, path, name: readName(name) })));
  return new Map(list.map((target, index) => [regKey(target), results[index]]));
}

/** true when every value the tweak writes reads back as needed; undefined when it has none. */
export function registryStatus(id: string, readback: RegistryReadback, accepted: AcceptedValues): boolean | undefined {
  const targets = TWEAK_REGISTRY_TARGETS[id];
  if (!targets?.length) return undefined;
  return targets.every(t => checkValue(t, readback.get(regKey(t)), accepted).ok);
}

/** Live registry status for every tweak with known registry values. */
export async function readRegistryAppliedState(): Promise<Record<string, boolean>> {
  const ids = Object.keys(TWEAK_REGISTRY_TARGETS);
  const readback = await readTweakRegistry(ids);
  const accepted = buildAcceptedValues(ids);
  const out: Record<string, boolean> = {};
  for (const id of ids) {
    const status = registryStatus(id, readback, accepted);
    if (status !== undefined) out[id] = status;
  }
  return out;
}
