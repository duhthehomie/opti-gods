/**
 * Idempotent registry cleanup and expected read probes, not a blanket error
 * suppressor. Writes still fail closed, including callers using SilentlyContinue.
 */
export const NATIVE_SCRIPT_RUNTIME = String.raw`
function ConvertTo-OptiRegistryComparable($Item, [string]$Kind) {
  if ($null -eq $Item) { return '' }
  $base = if ($Item -is [psobject]) { $Item.PSObject.BaseObject } else { $Item }
  if ($base -is [string] -and $Kind -match '^(DWord|QWord)$' -and $base -match '^\s*0x([0-9a-fA-F]{1,16})\s*$') {
    $base = [decimal][Convert]::ToUInt64($Matches[1], 16)
  }
  $isInteger = $base -is [int] -or $base -is [long] -or $base -is [uint32] -or $base -is [uint64] -or $base -is [int16] -or $base -is [uint16] -or $base -is [byte] -or $base -is [sbyte] -or $base -is [decimal]
  if (-not $isInteger) { return [string]$base }
  $number = [decimal]$base
  # DWORD/QWORD are unsigned in the registry but read back as signed numbers.
  if ($number -lt 0 -and $Kind -eq 'DWord') { $number += [decimal]4294967296 }
  if ($number -lt 0 -and $Kind -eq 'QWord') { $number += [decimal]::Parse('18446744073709551616') }
  return $number.ToString([Globalization.CultureInfo]::InvariantCulture)
}
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
    # Surface the real Windows error. A caller's -EA SilentlyContinue would
    # otherwise hide it and only the readback mismatch below would be reported.
    try { Microsoft.PowerShell.Management\Set-ItemProperty @parameters }
    catch { throw "Registry write failed: $p / $Name - $($_.Exception.Message)" }
    $actual = Microsoft.PowerShell.Management\Get-ItemPropertyValue -LiteralPath $p -Name $Name -ErrorAction Stop
    $kind = ''
    try { $kind = (Microsoft.PowerShell.Management\Get-Item -LiteralPath $p -ErrorAction Stop).GetValueKind($Name).ToString() } catch { $kind = '' }
    # Compare values, not their source text: a script literal such as 0x20
    # keeps the text "0x20" while Windows reads back the number 32.
    $expectedValues = @($Value | ForEach-Object { ConvertTo-OptiRegistryComparable $_ $kind })
    $actualValues = @($actual | ForEach-Object { ConvertTo-OptiRegistryComparable $_ $kind })
    $mismatch = $expectedValues.Count -ne $actualValues.Count
    for ($i = 0; -not $mismatch -and $i -lt $expectedValues.Count; $i++) {
      if ($expectedValues[$i] -cne $actualValues[$i]) { $mismatch = $true }
    }
    if ($mismatch) {
      throw ("Registry write did not read back: $p / $Name (wanted " + ($expectedValues -join ',') + ', Windows has ' + ($actualValues -join ',') + ' as ' + $(if ($kind) { $kind } else { 'unknown type' }) + ')')
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
