import type { RequestHandler, Request, Response } from "express";

export function buildSingleTweakPowerShell(id: string, command: string | undefined): string | null {
  if (!/^[A-Za-z0-9_]{2,64}$/.test(id) || !command?.trim()) return null;
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "$__ogStartingErrorCount = $global:Error.Count",
    "$script:__ogSkipped = $false",
    `Write-Output '[Opti Gods] Running ${id}…'`,
    "try {",
    `  & { ${command} } 6>&1 | ForEach-Object {`,
    "    $line = [string]$_",
    "    if ($line -match '(?i)\\[SKIP(?:PED)?\\]') { $script:__ogSkipped = $true }",
    "    Write-Output $line",
    "  }",
    "  if ($script:__ogSkipped) { Write-Output '__OG_RESULT:SKIPPED'; exit 2 }",
    "  if ($global:LASTEXITCODE -is [int] -and $global:LASTEXITCODE -ne 0) { throw ('Command exited with code ' + $global:LASTEXITCODE) }",
    "  if ($global:Error.Count -gt $__ogStartingErrorCount) { throw 'PowerShell reported an error while applying this tweak.' }",
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
