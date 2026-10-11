import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { buildSingleTweakPowerShell, createNativeScriptHandler } from "../server/native-script-delivery";

async function main() {
  const commands: Record<string, string> = {
    DiscordDisableHWAccel: "Write-Output '[OK] fixture'",
    NativeOnly: "throw 'native only'",
    CaptureDisabled: "throw 'protected'",
    EmptyCommand: "",
  };
  let authorized = false;
  let commandReads = 0;
  let authCalls = 0;
  const handler = createNativeScriptHandler({
    trustedId: (id: unknown): id is string =>
      typeof id === "string" && Object.hasOwn(commands, id),
    dedicatedIds: new Set(["NativeOnly"]),
    protectedIds: new Set(["CaptureDisabled"]),
    authorize: async (_req, res, ids) => {
      authCalls++;
      assert.deepEqual(ids, ["DiscordDisableHWAccel"]);
      if (authorized) return true;
      res.status(403).json({ message: "Pro required" });
      return false;
    },
    command: id => { commandReads++; return commands[id]; },
  });
  async function request(id: unknown, extra: Record<string, unknown> = {}) {
    let status = 200;
    let body: unknown;
    const headers: Record<string, string> = {};
    const res = {
      status(code: number) { status = code; return this; },
      json(value: unknown) { body = value; return this; },
      setHeader(key: string, value: string) { headers[key] = value; return this; },
    } as unknown as Response;
    await handler({ body: { id, ...extra } } as Request, res, (() => {}) as NextFunction);
    return { status, body, headers };
  }
  for (const id of [undefined, "../bad", "NotInCatalog", "NativeOnly", "CaptureDisabled"]) {
    assert.equal((await request(id)).status, 400);
  }
  assert.equal(authCalls, 0);
  assert.equal(commandReads, 0);
  const denied = await request("DiscordDisableHWAccel");
  assert.equal(denied.status, 403);
  assert.equal(commandReads, 0);
  assert.equal(denied.headers["Cache-Control"], "private, no-store");
  authorized = true;
  const allowed = await request("DiscordDisableHWAccel", { command: "throw 'injected'", script: "bad" });
  assert.equal(allowed.status, 200);
  const script = (allowed.body as { script: string }).script;
  assert(script.includes(Buffer.from(commands.DiscordDisableHWAccel, "utf8").toString("base64")));
  assert(!script.includes("injected"));
  assert(!script.includes("<!DOCTYPE"));
  for (const marker of ["APPLIED", "SKIPPED", "FAILED"]) assert(script.includes(`__OG_RESULT:${marker}`));
  assert(script.includes("Convert-OptiReadProbes"));
  assert(script.includes("PowerShell write/command failed:"));
  assert(!script.includes("StartingErrorCount"));
  const startup = buildSingleTweakPowerShell("su_discord", "reg delete HKCU\\fixture /v Discord /f");
  assert(startup?.includes("function reg"));
  assert(!script.includes("function reg"));
  assert.equal(buildSingleTweakPowerShell("bad-id!", commands.DiscordDisableHWAccel), null);
  assert.equal(buildSingleTweakPowerShell("EmptyCommand", ""), null);
  for (let i = 0; i < 392; i++) assert.equal((await request("DiscordDisableHWAccel")).status, 200);
  console.log("PASS: native script handler rejects unknown/dedicated/protected IDs; denies non-Pro without reading commands; returns JSON scripts from server-owned commands only; preserves terminal markers; serves a full-sized authorized batch.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
