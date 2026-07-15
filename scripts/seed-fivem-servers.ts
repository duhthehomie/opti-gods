/**
 * Seed FiveM community servers with their logos.
 * Run: npx tsx scripts/seed-fivem-servers.ts
 */
import { db } from "../server/db";
import { fivemServers } from "../shared/schema";
import { eq } from "drizzle-orm";

const SERVERS = [
  { connectCode: "pggaejy",        name: "TMFRZ PvP",   logoUrl: "/game-covers/tmfrz.png"   },
  { connectCode: "tmfrz",          name: "TMFRZ PvP",   logoUrl: "/game-covers/tmfrz.png"   },
  { connectCode: "pvp.tmfrz.com",  name: "TMFRZ PvP",   logoUrl: "/game-covers/tmfrz.png"   },
  { connectCode: "gunzrz",         name: "GunzRz",      logoUrl: "/game-covers/gunzrz.png"  },
  { connectCode: "pkrkgm",         name: "Combat",      logoUrl: "/game-covers/combat.png"  },
  { connectCode: "gadvy3z",        name: "Slumz Rz",    logoUrl: "/game-covers/slumzrz.png" },
  { connectCode: "slumzrz",        name: "Slumz Rz",    logoUrl: "/game-covers/slumzrz.png" },
];

async function seed() {
  console.log("Seeding FiveM servers...\n");
  for (const s of SERVERS) {
    const existing = await db.select().from(fivemServers)
      .where(eq(fivemServers.connectCode, s.connectCode)).limit(1);
    if (existing.length) {
      await db.update(fivemServers)
        .set({ name: s.name, logoUrl: s.logoUrl })
        .where(eq(fivemServers.connectCode, s.connectCode));
      console.log(`  ✓ Updated  ${s.connectCode.padEnd(18)} → ${s.name} (${s.logoUrl})`);
    } else {
      await db.insert(fivemServers).values(s);
      console.log(`  ✓ Inserted ${s.connectCode.padEnd(18)} → ${s.name} (${s.logoUrl})`);
    }
  }
  console.log("\nDone.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
