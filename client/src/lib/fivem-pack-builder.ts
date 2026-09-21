import { strToU8, zipSync } from "fflate";

export const FIVEM_PACK_PATHS = {
  timecycle: "citizen/platform/data/tune/timecycle_mods_1.xml",
  weather: "citizen/common/data/weather.xml",
  readme: "READ ME - How to install.txt",
} as const;

export function validateFivemPackXml(name: string, value: string, root: string): void {
  if (!value.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error(`${name} failed validation: missing XML declaration`);
  }
  if (value.includes("NaN") || value.includes("Infinity")) {
    throw new Error(`${name} contains invalid numeric values`);
  }

  const tags = value.match(/<[^>]+>/g);
  if (!tags) throw new Error(`${name} failed validation: no XML elements`);

  const stack: string[] = [];
  let documentRoot = "";
  for (const tag of tags) {
    if (tag.startsWith("<?") || tag.startsWith("<!") || tag.endsWith("/>")) continue;
    const closing = tag.startsWith("</");
    const match = tag.match(/^<\/?([A-Za-z_][\w:.-]*)/);
    if (!match) throw new Error(`${name} failed validation: malformed tag`);
    const tagName = match[1];
    if (closing) {
      if (stack.pop() !== tagName) {
        throw new Error(`${name} failed validation: mismatched XML tags`);
      }
    } else {
      if (!documentRoot) documentRoot = tagName;
      stack.push(tagName);
    }
  }
  if (documentRoot !== root || stack.length !== 0) {
    throw new Error(`${name} failed validation: invalid ${root} document`);
  }
}

function validatePackFiles(timecycle: string, weather: string): void {
  validateFivemPackXml("timecycle_mods_1.xml", timecycle, "timecycle_mods_file");
  validateFivemPackXml("weather.xml", weather, "CWeatherTypeList");
}

export function packageFivemCitizenZip(
  timecycle: string,
  weather: string,
  readme: string,
): Uint8Array {
  validatePackFiles(timecycle, weather);
  if (
    !readme.includes("INSTALL — BACKUP FIRST") ||
    !/back up any existing files/i.test(readme) ||
    !/restore the files you backed up/i.test(readme)
  ) {
    throw new Error("README failed validation: backup and restore instructions are required");
  }
  return zipSync({
    [FIVEM_PACK_PATHS.timecycle]: strToU8(timecycle),
    [FIVEM_PACK_PATHS.weather]: strToU8(weather),
    [FIVEM_PACK_PATHS.readme]: strToU8(readme),
  });
}

export function buildNativeFivemCitizenFiles(timecycle: string, weather: string) {
  validatePackFiles(timecycle, weather);
  return [
    { path: FIVEM_PACK_PATHS.timecycle, content: timecycle },
    { path: FIVEM_PACK_PATHS.weather, content: weather },
  ];
}