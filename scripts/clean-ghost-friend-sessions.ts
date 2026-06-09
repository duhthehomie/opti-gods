import { db } from "../server/db";
import { proSessions, proFriendTokens } from "../shared/schema";
import { sql, like } from "drizzle-orm";

async function main() {
  const tokens = await db.select({ token: proFriendTokens.token }).from(proFriendTokens);
  const validRefs = new Set(tokens.map(t => `friend:${t.token}`));

  const sessions = await db.select({ codeRef: proSessions.codeRef })
    .from(proSessions)
    .where(like(proSessions.codeRef, "friend:%"));

  const ghosts = sessions.filter(s => s.codeRef && !validRefs.has(s.codeRef));

  if (ghosts.length === 0) {
    console.log("No ghost friend sessions — everything is clean.");
    return;
  }

  for (const g of ghosts) {
    await db.delete(proSessions).where(sql`${proSessions.codeRef} = ${g.codeRef}`);
    console.log(" deleted:", g.codeRef);
  }
  console.log(`Done — removed ${ghosts.length} ghost session(s).`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
