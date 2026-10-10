$ErrorActionPreference = 'Stop'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\src-tauri\src\commands\nvidia-cpl-settings.ps1'))
$tokens = $null
$errors = $null
$null = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw ($errors | ForEach-Object { $_.Message } | Out-String) }
if ($source.Contains('[System.Windows.Automation.LegacyIAccessiblePattern]')) {
  throw 'Unsupported managed legacy accessibility type remains in the NVIDIA script.'
}
# Execute only assembly/helper initialization, never navigation or driver writes.
# This deliberately uses the same Windows PowerShell host as the native app.
$marker = '$gpu = $env:OPTI_GPU_NAME'
$offset = $source.IndexOf($marker, [StringComparison]::Ordinal)
if ($offset -lt 0) { throw 'NVIDIA script initialization boundary is missing.' }
& ([ScriptBlock]::Create($source.Substring(0, $offset)))
if (-not ('OptiGods.CplMsaa' -as [type]) -or -not ('OptiGods.CplMsaaControl' -as [type])) {
  throw 'NVIDIA MSAA helper failed to compile/load in Windows PowerShell.'
}
if (-not [OptiGods.CplMsaa].GetMethod('FromPoint')) { throw 'MSAA lookup entry point is missing.' }
Write-Output '[nvidia-cpl] Windows PowerShell syntax and MSAA helper compilation passed; no settings were changed.'
