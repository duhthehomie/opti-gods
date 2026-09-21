import { storage } from "../server/storage";

const TOP_DRIVERS = [
  { version: "566.36", branch: "Game Ready", releasedAt: new Date("2024-12-05") },
  { version: "565.90", branch: "Game Ready", releasedAt: new Date("2024-11-12") },
  { version: "560.94", branch: "Game Ready", releasedAt: new Date("2024-09-17") },
  { version: "555.99", branch: "Studio", releasedAt: new Date("2024-06-04") },
  { version: "552.44", branch: "Game Ready", releasedAt: new Date("2024-04-16") },
];

async function main() {
  for (const d of TOP_DRIVERS) {
    await storage.upsertNvidiaDriver({
      version: d.version,
      branch: d.branch,
      releasedAt: d.releasedAt,
      tweaksValidated: false,
    });
    console.log(`seeded ${d.version}`);
  }
  console.log(`Done — seeded ${TOP_DRIVERS.length} drivers.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
