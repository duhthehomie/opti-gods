import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { nativeTweakTickets, performanceTweakAllowance, users } from "../shared/schema";

async function cleanup(userId: string) {
  await db.delete(nativeTweakTickets).where(eq(nativeTweakTickets.discordUserId, userId));
  await db.delete(performanceTweakAllowance).where(eq(performanceTweakAllowance.discordUserId, userId));
  await db.delete(users).where(eq(users.discordId, userId));
}

async function main() {
  const userId = `allowance-race-${randomUUID()}`;
  const duplicateUserId = `allowance-duplicate-${randomUUID()}`;

  try {
    await db.insert(users).values([
      { discordId: userId, username: "allowance-concurrency-test" },
      { discordId: duplicateUserId, username: "allowance-duplicate-test" },
    ]);

    // Model 16 simultaneous clicks for 16 distinct eligible actions. The
    // storage layer is the authoritative quota boundary used by the API.
    const attempts = Array.from({ length: 16 }, (_, index) => ({
      tweakId: `ConcurrencyTweak${index + 1}`,
      key: randomUUID().replaceAll("-", ""),
    }));
    const issued = await Promise.allSettled(
      attempts.map(({ tweakId, key }) =>
        storage.authorizeNativeTweakTicket(userId, tweakId, key, true)
          .then(result => ({ ...result, tweakId })),
      ),
    );

    const accepted = issued
      .filter((result): result is PromiseFulfilledResult<{ ticket: string; reused: boolean; tweakId: string }> => result.status === "fulfilled")
      .map(result => result.value);
    const rejected = issued.filter(result => result.status === "rejected");

    if (accepted.length !== 15) {
      console.error(rejected.map(result => String((result as PromiseRejectedResult).reason)));
    }
    assert.equal(accepted.length, 15, "exactly 15 simultaneous unique requests must be accepted");
    assert.equal(rejected.length, 1, "the 16th simultaneous unique request must be rejected");
    assert.match(String((rejected[0] as PromiseRejectedResult).reason), /FREE_ALLOWANCE_EXHAUSTED/);

    // Simulate the trusted native executor consuming and successfully
    // finalizing every accepted ticket.
    const consumed = await Promise.all(
      accepted.map(({ ticket, tweakId }) => storage.consumeNativeTweakTicket(userId, ticket, tweakId)),
    );
    assert.ok(consumed.every(Boolean), "all 15 reserved tickets must consume exactly once");

    const finalized = await Promise.all(
      accepted.map(({ ticket }, index) =>
        storage.finalizeNativeTweakTicket(ticket, consumed[index]!.resultSecret, true),
      ),
    );
    assert.ok(finalized.every(result => result.ok && result.status === "success"));

    const status = await storage.getPerformanceAllowance(userId);
    assert.deepEqual(status, { used: 15, remaining: 0 });

    await assert.rejects(
      storage.authorizeNativeTweakTicket(
        userId,
        "ConcurrencyTweak17",
        randomUUID().replaceAll("-", ""),
        true,
      ),
      /FREE_ALLOWANCE_EXHAUSTED/,
    );

    // Repeated simultaneous clicks for the same operation must all resolve to
    // one ticket and one reserved credit, never sibling executable tickets.
    const duplicateKey = randomUUID().replaceAll("-", "");
    const duplicates = await Promise.all(
      Array.from({ length: 15 }, () =>
        storage.authorizeNativeTweakTicket(
          duplicateUserId,
          "ConcurrencySameTweak",
          duplicateKey,
          true,
        ),
      ),
    );
    assert.equal(new Set(duplicates.map(result => result.ticket)).size, 1);
    assert.deepEqual(await storage.getPerformanceAllowance(duplicateUserId), { used: 0, remaining: 15 });

    console.log("PASS: 16 simultaneous unique clicks accepted exactly 15 and rejected 1.");
    console.log("PASS: successful finalization consumed exactly 15 lifetime credits.");
    console.log("PASS: 15 duplicate simultaneous clicks produced one ticket and one reservation.");
  } finally {
    await cleanup(userId);
    await cleanup(duplicateUserId);
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});