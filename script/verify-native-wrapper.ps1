$ErrorActionPreference = 'Stop'
$fixtures = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-wrapper-fixtures.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($fixture in $fixtures) {
  $tokens = $null; $parseErrors = $null
  $null = [System.Management.Automation.Language.Parser]::ParseInput($fixture.script, [ref]$tokens, [ref]$parseErrors)
  if (@($parseErrors).Count) { throw "Fixture parse failed: $($fixture.name): $($parseErrors.Message -join '; ')" }
  $path = Join-Path ([IO.Path]::GetTempPath()) ("OptiGods-OutcomeFixture-" + [Guid]::NewGuid().ToString('N') + '.ps1')
  try {
    [IO.File]::WriteAllText($path, $fixture.script, [Text.UTF8Encoding]::new($true))
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = Join-Path $PSHOME 'powershell.exe'
    $info.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$path`""
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $info.EnvironmentVariables.Remove('PSModulePath')
    $process = [Diagnostics.Process]::Start($info)
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(15000)) { $process.Kill(); throw "Fixture timed out: $($fixture.name)" }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne $fixture.code -or $stdout -notmatch "__OG_RESULT:$($fixture.marker)") {
      throw "Outcome fixture $($fixture.name) failed (exit $($process.ExitCode), expected $($fixture.code)): $stdout $stderr"
    }
    Write-Output "PASS: $($fixture.name)"
  } finally {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  }
}
