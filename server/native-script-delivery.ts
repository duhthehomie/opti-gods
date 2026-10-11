import type { RequestHandler, Request, Response } from "express";
import { NATIVE_SCRIPT_RUNTIME, NATIVE_STARTUP_CLEANUP_RUNTIME } from "./native-script-runtime";

export function buildSingleTweakPowerShell(id: string, command: string | undefined): string | null {
  if (!/^[A-Za-z0-9_]{2,64}$/.test(id) || !command?.trim()) return null;
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "$__ogStartingErrors = @($global:Error)",
    "$script:__ogSkipped = $false",
    NATIVE_SCRIPT_RUNTIME,
    ...(id.startsWith("su_") ? [NATIVE_STARTUP_CLEANUP_RUNTIME] : []),
    `Write-Output '[Opti Gods] Running ${id}…'`,
    "try {",
    `  $__ogSource = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(command, "utf8").toString("base64")}'))`,
    "  & ([ScriptBlock]::Create((Convert-OptiReadProbes $__ogSource))) 6>&1 | ForEach-Object {",
    "    $line = [string]$_",
    "    if ($line -match '(?i)\\[SKIP(?:PED)?\\]') { $script:__ogSkipped = $true }",
    "    Write-Output $line",
    "  }",
    "  if ($global:LASTEXITCODE -is [int] -and $global:LASTEXITCODE -ne 0) { throw ('Command exited with code ' + $global:LASTEXITCODE) }",
    "  $__ogUnexpectedErrors = @($global:Error | Where-Object { $__ogStartingErrors -notcontains $_ })",
    "  if ($__ogUnexpectedErrors.Count) { throw ('PowerShell write/command failed: ' + $__ogUnexpectedErrors[0].Exception.Message) }",
    "  if ($script:__ogSkipped) { Write-Output '__OG_RESULT:SKIPPED'; exit 2 }",
    "  Write-Output '__OG_RESULT:APPLIED'",
    "  exit 0",
    "} catch {",
    "  [Console]::Error.WriteLine('[ERROR] ' + $_.Exception.Message)",
    "  Write-Output '__OG_RESULT:FAILED'",
    "  exit 1",
    "}",
  ].join("\n");
}

interface NativeScriptDeliveryDependencies {
  trustedId: (id: unknown) => id is string;
  dedicatedIds: ReadonlySet<string>;
  protectedIds: ReadonlySet<string>;
  authorize: (req: Request, res: Response, ids: string[]) => Promise<boolean>;
  command: (id: string) => string | undefined;
}

/** Deliver server-owned commands only; caller-supplied PowerShell is never read. */
export function createNativeScriptHandler(deps: NativeScriptDeliveryDependencies): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const id: unknown = req.body?.id;
    if (!deps.trustedId(id)) {
      res.status(400).json({ message: "That tweak does not have a trusted Windows script." });
      return;
    }
    if (deps.dedicatedIds.has(id)) {
      res.status(400).json({ message: "This action must use its dedicated native Windows flow." });
      return;
    }
    if (deps.protectedIds.has(id)) {
      res.status(400).json({ message: "This legacy NVIDIA capture-disabling action is unavailable." });
      return;
    }
    // Reuse the live server's Pro check. Bundles or local display state do not
    // substitute for entitlement, and unauthorized callers receive no script.
    if (!(await deps.authorize(req, res, [id]))) return;
    const script = buildSingleTweakPowerShell(id, deps.command(id));
    if (!script) {
      res.status(400).json({ message: "No single-tweak PowerShell script is available for this action." });
      return;
    }
    res.json({ script });
  };
}
