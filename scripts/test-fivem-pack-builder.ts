import { strict as assert } from "node:assert";
import { strFromU8, unzipSync } from "fflate";
import {
  buildNativeFivemCitizenFiles,
  FIVEM_PACK_PATHS,
  packageFivemCitizenZip,
  validateFivemPackXml,
} from "../client/src/lib/fivem-pack-builder";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    process.stdout.write(`  \u2713 ${name}\n`);
  } catch (error) {
    failed++;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`  \u2717 ${name}\n      ${message}`);
    process.stdout.write(`  \u2717 ${name}\n      ${message}\n`);
  }
}

const timecycleXml = '<?xml version="1.0" encoding="UTF-8"?>\n<timecycle_mods_file><mods><Item /></mods></timecycle_mods_file>\n';
const weatherXml = '<?xml version="1.0" encoding="UTF-8"?>\n<CWeatherTypeList><WeatherTypes><Item /></WeatherTypes></CWeatherTypeList>\n';
const backupFirstReadme = "INSTALL — BACKUP FIRST\r\nBack up any existing files.\r\nRestore the files you backed up.";

const ALLOWED_ZIP_FILES = [
  "READ ME - How to install.txt",
  "citizen/common/data/weather.xml",
  "citizen/platform/data/tune/timecycle_mods_1.xml",
];

console.log("\n[fivem-pack-builder] running tests\n");

test("ZIP contains exactly two citizen XML files and the backup-first README", () => {
  const files = unzipSync(packageFivemCitizenZip(timecycleXml, weatherXml, backupFirstReadme));
  assert.deepEqual(Object.keys(files).sort(), ALLOWED_ZIP_FILES);

  const readme = strFromU8(files["READ ME - How to install.txt"]);
  assert.match(readme, /INSTALL — BACKUP FIRST/);
  assert.match(readme, /Back up any existing files/i);
  assert.match(readme, /Restore the files you backed up/i);
});

test("ZIP is rejected if backup-first README instructions are removed", () => {
  assert.throws(
    () => packageFivemCitizenZip(timecycleXml, weatherXml, "Copy these files into FiveM."),
    /backup and restore instructions are required/,
  );
});

test("ZIP excludes installers, resources, autoexec, and visualsettings files", () => {
  const paths = Object.keys(unzipSync(packageFivemCitizenZip(timecycleXml, weatherXml, backupFirstReadme)));
  const forbidden = /\.(bat|cmd|ps1)$/i;
  for (const path of paths) {
    assert.ok(!forbidden.test(path), `installer script returned: ${path}`);
    assert.ok(!/(^|\/)resources?\//i.test(path), `resource returned: ${path}`);
    assert.ok(!/(^|\/)autoexec\.cfg$/i.test(path), `autoexec returned: ${path}`);
    assert.ok(!/(^|\/)visualsettings\.dat$/i.test(path), `visualsettings returned: ${path}`);
  }
});

test("native installation receives only the two validated citizen XML files", () => {
  const files = buildNativeFivemCitizenFiles(timecycleXml, weatherXml);
  assert.deepEqual(files.map(file => file.path).sort(), ALLOWED_ZIP_FILES.slice(1));
  assert.ok(files.every(file => file.path.startsWith("citizen/")));
});

test("non-finite numeric XML is rejected before download", () => {
  assert.throws(
    () => packageFivemCitizenZip(timecycleXml.replace("<mods>", "<mods><value>NaN</value>"), weatherXml, backupFirstReadme),
    /invalid numeric values/,
  );
  assert.throws(
    () => buildNativeFivemCitizenFiles(timecycleXml, weatherXml.replace("<WeatherTypes>", "<WeatherTypes><value>Infinity</value>")),
    /invalid numeric values/,
  );
});

test("malformed or invalid-root XML is rejected", () => {
  assert.throws(
    () => validateFivemPackXml("bad.xml", '<?xml version="1.0" encoding="UTF-8"?><root><Item></root>', "root"),
    /mismatched XML tags/,
  );
  assert.throws(
    () => validateFivemPackXml("bad.xml", '<?xml version="1.0" encoding="UTF-8"?><wrong></wrong>', "root"),
    /invalid root document/,
  );
});

console.log(`\n[fivem-pack-builder] ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}