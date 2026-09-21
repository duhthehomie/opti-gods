import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { nativeTweakTickets, performanceTweakAllowance, users } from "../shared/schema";
import { selectBestInstantTweaks } from "../shared/native-tweak-ids";

async function cleanup(userId: string) {
  await db.delete(nativeTweakTickets).where(eq(nativeTweakTickets.discordUserId, userId));
  await db.delete(performanceTweakAllowance).where(eq(performanceTweakAllowance.discordUserId, userId));
  await db.delete(users).where(eq(users.discordId, userId));
}

async function main() {
  const candidates = [
    "Win32PrioritySeparation", "GameModeTweaks", "SetResponsiveness",
    "NetworkThrottling", "DisableNagle", "InputLagTCP", "EnableHAGS",
    "DisableGameDVR", "DisablePointerPrecision", "DisableFastStartup",
    "DisablePrefetch", "DisableNDU", "SysVisualBestPerf",
    "DisableTelemetry", "SysHibernateOff", "SetDNSPriority",
  ];
  const partiallyUsed = new Set(candidates.slice(0, 7));
  const proAfterPartialUse = selectBestInstantTweaks(candidates, partiallyUsed, 0, true);
  assert.equal(proAfterPartialUse.ids.length, 15, "Pro must receive all 15 ranked compatible IDs despite prior free usage");
  assert.equal(proAfterPartialUse.requestedCount, 15);
  const fullyUsed = new Set(candidates);
  const proAfterFullUse = selectBestInstantTweaks(candidates, fullyUsed, 0, true);
  assert.equal(proAfterFullUse.ids.length, 15, "Pro must not be filtered by a fully exhausted free ledger");
  const freeAfterPartialUse = selectBestInstantTweaks(candidates, partiallyUsed, 8, false);
  assert.deepEqual(freeAfterPartialUse.ids, candidates.slice(7, 15), "Free selection must exclude charged IDs and remain ranked");

  const userId = `allowance-race-${randomUUID()}`;
  const duplicateUserId = `allowance-duplicate-${randomUUID()}`;
  const lifecycleUserId = `allowance-lifecycle-${randomUUID()}`;

  try {
    await db.insert(users).values([
      { discordId: userId, username: "allowance-concurrency-test" },
      { discordId: duplicateUserId, username: "allowance-duplicate-test" },
      { discordId: lifecycleUserId, username: "allowance-lifecycle-test" },
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
        storage.finalizeNativeTweakTicket(
          userId,
          ticket,
          consumed[index]!.resultSecret,
          true,
          accepted[index]!.tweakId,
        ),
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
    assert.equal(await storage.releasePerformanceTweak(userId, accepted[0]!.tweakId), true);
    assert.deepEqual(await storage.getPerformanceAllowance(userId), { used: 14, remaining: 1 });
    const reusable = await storage.authorizeNativeTweakTicket(
      userId,
      "ConcurrencyTweak17",
      randomUUID().replaceAll("-", ""),
      true,
    );
    assert.ok(reusable.ticket, "a released free slot must be reusable for a different tweak");

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
    assert.deepEqual(await storage.getPerformanceAllowance(duplicateUserId), { used: 1, remaining: 14 });

    // Expiry cleanup and consumption share the account lock. Even with an
    // artificially stale reservation, exactly one operation wins: cleanup
    // invalidates execution, or consumption protects the begun execution.
    const cleanupKey = randomUUID().replaceAll("-", "");
    const cleanupTicket = await storage.authorizeNativeTweakTicket(
      lifecycleUserId, "CleanupRaceTweak", cleanupKey, true,
    );
    await db.update(performanceTweakAllowance)
      .set({ reservedAt: sql`now() - interval '16 minutes'` })
      .where(and(
        eq(performanceTweakAllowance.discordUserId, lifecycleUserId),
        eq(performanceTweakAllowance.tweakId, "CleanupRaceTweak"),
      ));
    const [cleanupResult, cleanupConsume] = await Promise.all([
      storage.reclaimExpiredPerformanceReservations(lifecycleUserId),
      storage.consumeNativeTweakTicket(lifecycleUserId, cleanupTicket.ticket, "CleanupRaceTweak"),
    ]);
    void cleanupResult;
    if (cleanupConsume) {
      assert.deepEqual(await storage.getPerformanceAllowance(lifecycleUserId), { used: 1, remaining: 14 });
      const protectedResult = await storage.finalizeNativeTweakTicket(
        lifecycleUserId, cleanupTicket.ticket, cleanupConsume.resultSecret, true, "CleanupRaceTweak",
      );
      assert.deepEqual(protectedResult, { ok: true, status: "success" });
    } else {
      assert.deepEqual(await storage.getPerformanceAllowance(lifecycleUserId), { used: 0, remaining: 15 });
    }

    // Once consume marks execution begun, cancellation must not release the
    // reservation. Repeated cancellation remains safely false.
    const cancellation = await storage.authorizeNativeTweakTicket(
      lifecycleUserId, "CancellationRaceTweak", randomUUID().replaceAll("-", ""), true,
    );
    const cancellationConsume = await storage.consumeNativeTweakTicket(
      lifecycleUserId, cancellation.ticket, "CancellationRaceTweak",
    );
    assert.ok(cancellationConsume);
    const cancellations = await Promise.all([
      storage.cancelNativeTweakTicket(lifecycleUserId, cancellation.ticket),
      storage.cancelNativeTweakTicket(lifecycleUserId, cancellation.ticket),
    ]);
    assert.deepEqual(cancellations, [false, false]);
    assert.equal(
      (await storage.getConsumedPerformanceTweakIds(lifecycleUserId)).includes("CancellationRaceTweak"),
      true,
    );

    // Competing success/failure reports are one-shot. Repeating the winning
    // result is idempotent; the opposite result can never overwrite it.
    const [successResult, failureResult] = await Promise.all([
      storage.finalizeNativeTweakTicket(
        lifecycleUserId, cancellation.ticket, cancellationConsume!.resultSecret, true, "CancellationRaceTweak",
      ),
      storage.finalizeNativeTweakTicket(
        lifecycleUserId, cancellation.ticket, cancellationConsume!.resultSecret, false, "CancellationRaceTweak",
      ),
    ]);
    const winner = successResult.ok ? "success" : "failure";
    assert.equal(successResult.status, failureResult.status);
    assert.equal(successResult.status, winner);
    assert.equal(successResult.ok, winner === "success");
    assert.equal(failureResult.ok, winner === "failure");
    assert.deepEqual(
      await storage.finalizeNativeTweakTicket(
        lifecycleUserId,
        cancellation.ticket,
        cancellationConsume!.resultSecret,
        winner === "success",
        "CancellationRaceTweak",
      ),
      { ok: true, status: winner },
    );
    assert.deepEqual(
      await storage.finalizeNativeTweakTicket(
        lifecycleUserId,
        cancellation.ticket,
        cancellationConsume!.resultSecret,
        winner !== "success",
        "CancellationRaceTweak",
      ),
      { ok: false, status: winner },
    );

    console.log("PASS: 16 simultaneous unique clicks accepted exactly 15 and rejected 1.");
    console.log("PASS: successful finalization filled exactly 15 active free slots.");
    console.log("PASS: 15 duplicate simultaneous clicks produced one ticket and one reservation.");
    console.log("PASS: cleanup and consumption cannot invalidate a begun execution.");
    console.log("PASS: cancellation cannot release a begun execution.");
    console.log("PASS: finalization is one-shot and repeated winning results are idempotent.");
    console.log("PASS: Undo releases an active slot for a different tweak.");
  } finally {
    await cleanup(userId);
    await cleanup(duplicateUserId);
    await cleanup(lifecycleUserId);
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});