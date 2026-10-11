/**
 * Idempotent registry cleanup and expected read probes, not a blanket error
 * suppressor. Writes still fail closed, including callers using SilentlyContinue.
 */
export const NATIVE_SCRIPT_RUNTIME = String.raw`
function Set-ItemProperty {
  [CmdletBinding()]
  param(
    [Parameter(Position=0)][string[]]$Path,
    [string[]]$LiteralPath,
    [Parameter(Position=1,Mandatory=$true)][string]$Name,
    [Parameter(Position=2,Mandatory=$true)][AllowNull()][object]$Value,
    [string]$Type,
    [switch]$Force
  )
  $paths = if ($LiteralPath) { $LiteralPath } else { $Path }
  if (-not $paths -or -not @($paths).Count) { throw 'Registry write requires an explicit path.' }
  foreach ($p in $paths) {
    if (-not (Test-Path -LiteralPath $p -ErrorAction Stop)) {
      # Only create missing Microsoft policy/settings folders. Do not invent
      # hardware capability or vendor-driver paths to manufacture success.
      if ($p -notmatch '^HK(CU|LM):\\SOFTWARE\\(Policies\\)?Microsoft\\') { throw "Required registry/settings path is unavailable: $p" }
      Microsoft.PowerShell.Management\New-Item -Path $p -Force -ErrorAction Stop | Out-Null
    }
    $parameters = @{ LiteralPath = $p; Name = $Name; Value = $Value; Force = $true; ErrorAction = 'Stop' }
    if ($Type) { $parameters['Type'] = $Type }
    Microsoft.PowerShell.Management\Set-ItemProperty @parameters
    $actual = Microsoft.PowerShell.Management\Get-ItemPropertyValue -LiteralPath $p -Name $Name -ErrorAction Stop
    $expectedValues = @($Value); $actualValues = @($actual)
    if ($expectedValues.Count -ne $actualValues.Count) { throw "Registry write did not read back: $p / $Name" }
    for ($i = 0; $i -lt $expectedValues.Count; $i++) {
      if ([string]$expectedValues[$i] -cne [string]$actualValues[$i]) { throw "Registry write did not read back: $p / $Name" }
    }
  }
}
function taskkill {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  $imageFlag = [Array]::IndexOf($Arguments, '/im')
  if ($imageFlag -ge 0 -and $imageFlag + 1 -lt $Arguments.Count) {
    $image = [IO.Path]::GetFileNameWithoutExtension($Arguments[$imageFlag+1])
    if (-not (Get-Process -Name $image -ErrorAction Ignore)) { $global:LASTEXITCODE = 0; return }
  }
  & taskkill.exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Process cleanup failed (exit $LASTEXITCODE)." }
}
function Remove-ItemProperty {
  [CmdletBinding()]
  param(
    [Parameter(Position=0)][string[]]$Path,
    [string[]]$LiteralPath,
    [Parameter(Position=1,Mandatory=$true)][string[]]$Name,
    [switch]$Force
  )
  $paths = if ($LiteralPath) { $LiteralPath } else { $Path }
  if (-not $paths -or -not @($paths).Count) { throw 'Registry cleanup requires an explicit path.' }
  foreach ($p in $paths) {
    if (-not (Test-Path -LiteralPath $p -ErrorAction Stop)) { continue }
    $properties = Microsoft.PowerShell.Management\Get-ItemProperty -LiteralPath $p -ErrorAction Stop
    foreach ($n in $Name) {
      $matched = @($properties.PSObject.Properties | Where-Object { $_.Name -like $n })
      foreach ($property in $matched) {
        Microsoft.PowerShell.Management\Remove-ItemProperty -LiteralPath $p -Name $property.Name -Force -ErrorAction Stop
        $after = Microsoft.PowerShell.Management\Get-ItemProperty -LiteralPath $p -ErrorAction Stop
        if ($after.PSObject.Properties.Name -contains $property.Name) { throw "Registry cleanup was not verified: $p / $($property.Name)" }
      }
    }
  }
}
function Convert-OptiReadProbes([string]$Source) {
  $tokens = $null; $parseErrors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseInput($Source, [ref]$tokens, [ref]$parseErrors)
  if (@($parseErrors).Count) { throw ("Trusted script parse failed: " + (($parseErrors | ForEach-Object { $_.Message }) -join '; ')) }
  $edits = @()
  foreach ($node in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)) {
    # Suppression was explicitly requested on these READS. Ignore prevents an
    # expected missing-service/key probe from polluting the global error list.
    # Mutation commands are never included.
    if ($node.GetCommandName() -notmatch '^Get-(Service|Process|ItemProperty|ItemPropertyValue|ChildItem|ScheduledTask|AppxPackage|Command|NetAdapter.*)$') { continue }
    $elements = @($node.CommandElements)
    for ($i = 1; $i -lt $elements.Count - 1; $i++) {
      $parameter = $elements[$i]; $value = $elements[$i+1]
      if ($parameter -is [System.Management.Automation.Language.CommandParameterAst] -and
          $parameter.ParameterName -in @('EA','ErrorAction') -and
          $value -is [System.Management.Automation.Language.StringConstantExpressionAst] -and
          $value.Value -eq 'SilentlyContinue') {
        $edits += @{ Start = $value.Extent.StartOffset; Length = $value.Extent.EndOffset - $value.Extent.StartOffset }
      }
    }
  }
  foreach ($edit in ($edits | Sort-Object Start -Descending)) {
    $Source = $Source.Remove($edit.Start, $edit.Length).Insert($edit.Start, 'Ignore')
  }
  return $Source
}
`;

// Startup scripts historically used reg.exe delete on entries that may not
// exist. Native stderr then aborted PowerShell under ErrorActionPreference=Stop.
// Keep the same requested removals but verify them through the registry provider.
export const NATIVE_STARTUP_CLEANUP_RUNTIME = String.raw`
function reg {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  $valueFlag = [Array]::IndexOf($Arguments, '/v')
  if ($Arguments.Count -ge 2 -and $Arguments[0] -eq 'delete' -and $valueFlag -ge 0 -and $valueFlag + 1 -lt $Arguments.Count) {
    $path = $Arguments[1] -replace '^HKCU\\', 'HKCU:\' -replace '^HKLM\\', 'HKLM:\'
    Remove-ItemProperty -LiteralPath $path -Name $Arguments[$valueFlag+1] -Force -ErrorAction Stop
    $global:LASTEXITCODE = 0
    return
  }
  & reg.exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Registry command failed (exit $LASTEXITCODE)." }
}
`;
