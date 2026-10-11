$ErrorActionPreference = 'Stop'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\src-tauri\src\commands\nvidia-cpl-settings.ps1'))
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
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
& {
  # Run the production launch functions with mocked Windows services. No app
  # activation, process creation, registry edits, or driver writes are allowed.
  foreach ($name in @('Get-NvidiaStoreTarget', 'Assert-NvidiaPublisher', 'Start-NvidiaControlPanel')) {
    $definitions = @($ast.FindAll({
      param($node)
      $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $true))
    if ($definitions.Count -ne 1) { throw "Missing or ambiguous production function: $name" }
    . ([ScriptBlock]::Create($definitions[0].Extent.Text))
  }
  $script:testPackage = [pscustomobject]@{
    Name = 'NVIDIACorp.NVIDIAControlPanel'
    PackageFamilyName = 'NVIDIACorp.NVIDIAControlPanel_56jybvy8sckqj'
    PackageFullName = 'fixture'
    InstallLocation = 'C:\Program Files\WindowsApps\NVIDIAFixture'
  }
  $script:testApps = @([pscustomobject]@{ Id = 'NVIDIACorp.NVIDIAControlPanel'; Executable = 'nvcplui.exe' })
  $script:testSignature = 'Valid'
  $script:testExists = $true
  $script:testDenyLaunch = $false
  $script:testCalls = @()
  function Get-AppxPackage { param($Name, $ErrorAction) $script:testPackage }
  function Get-AppxPackageManifest {
    param($Package, $ErrorAction)
    [pscustomobject]@{ Package = [pscustomobject]@{ Applications = [pscustomobject]@{ Application = $script:testApps } } }
  }
  function Test-Path { param($LiteralPath) $script:testExists }
  function Get-AuthenticodeSignature {
    param($LiteralPath)
    [pscustomobject]@{ Status = $script:testSignature; SignerCertificate = [pscustomobject]@{ Subject = 'CN=NVIDIA Corporation' } }
  }
  function Start-Process {
    param($FilePath, [string[]]$ArgumentList, $WorkingDirectory, $ErrorAction)
    if ($script:testDenyLaunch) { throw 'Access is denied (fixture)' }
    $script:testCalls += [pscustomobject]@{ Path = $FilePath; Args = $ArgumentList; Directory = $WorkingDirectory }
  }
  function Expect-Failure($action, $message) {
    $failed = $false
    try { & $action } catch {
      if ($_.Exception.Message -notlike "*$message*") { throw }
      $failed = $true
    }
    if (-not $failed) { throw "Expected failure: $message" }
  }
  Start-NvidiaControlPanel
  if ($script:testCalls.Count -ne 1 -or $script:testCalls[0].Path -ne (Join-Path $env:WINDIR 'explorer.exe') -or $script:testCalls[0].Args[0] -ne 'shell:AppsFolder\NVIDIACorp.NVIDIAControlPanel_56jybvy8sckqj!NVIDIACorp.NVIDIAControlPanel') {
    throw 'Store app must use registered shell activation, never direct WindowsApps execution.'
  }
  $script:testCalls = @()
  $script:testSignature = 'NotTrusted'
  Expect-Failure { Start-NvidiaControlPanel } 'publisher trust verification'
  if ($script:testCalls.Count -ne 0) { throw 'Untrusted executable was launched.' }
  $script:testSignature = 'Valid'
  $originalApps = $script:testApps
  $script:testApps = @([pscustomobject]@{ Id = 'NVIDIA'; Executable = '..\nvcplui.exe' })
  Expect-Failure { Start-NvidiaControlPanel } 'outside its registered package'
  $script:testApps = @($originalApps[0], $originalApps[0])
  Expect-Failure { Start-NvidiaControlPanel } 'unavailable or ambiguous'
  $script:testApps = $originalApps
  $script:testDenyLaunch = $true
  Expect-Failure { Start-NvidiaControlPanel } 'registered Store entry'
  if ($script:testCalls.Count -ne 0) { throw 'Store activation denial attempted a raw executable fallback.' }
  $script:testDenyLaunch = $false
  $script:testPackage = $null
  Start-NvidiaControlPanel
  $desktop = Join-Path $env:ProgramFiles 'NVIDIA Corporation\Control Panel Client\nvcplui.exe'
  if ($script:testCalls.Count -ne 1 -or $script:testCalls[0].Path -ne $desktop -or $script:testCalls[0].Directory -ne (Split-Path -Parent $desktop)) {
    throw 'Desktop installation must retain its signed executable launch path.'
  }
  $script:testExists = $false
  Expect-Failure { Start-NvidiaControlPanel } 'required to verify'
  Write-Output '[nvidia-cpl] Launch routing, signature rejection, package containment/ambiguity, access denial, desktop fallback, and missing-app mocks passed.'
}
& {
  foreach ($name in @('Normalize-Name', 'Get-ControlParent', 'Test-NavigationControl', 'Close-OwnedControlPanel')) {
    $definitions = @($ast.FindAll({
      param($node)
      $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $true))
    if ($definitions.Count -ne 1) { throw "Missing production function: $name" }
    . ([ScriptBlock]::Create($definitions[0].Extent.Text))
  }
  function Get-ControlParent($element) { $element.Parent }
  function New-TestControl($type, $name, $actionable, $parent) {
    $control = [pscustomobject]@{
      Current = [pscustomobject]@{ ControlType = $type; Name = $name; ClassName = '' }
      Parent = $parent
      Actionable = $actionable
    }
    $control | Add-Member -MemberType ScriptMethod -Name TryGetCurrentPattern -Value {
      param($pattern, $value)
      return ($this.Actionable -and $pattern.Id -eq [System.Windows.Automation.InvokePattern]::Pattern.Id)
    }
    return $control
  }
  $pane = [System.Windows.Automation.ControlType]::Pane
  $link = [System.Windows.Automation.ControlType]::Hyperlink
  $text = [System.Windows.Automation.ControlType]::Text
  $navigation = New-TestControl $pane 'Left View' $false $null
  $settings = New-TestControl $pane 'Settings:' $false $null
  $name = 'Adjust image settings with preview'
  if (-not (Test-NavigationControl (New-TestControl $link $name $true $navigation) $null)) {
    throw 'Actionable NVIDIA sidebar hyperlink was rejected as a non-TreeItem.'
  }
  if (Test-NavigationControl (New-TestControl $link $name $true $settings) $null) {
    throw 'Same-named page heading/link outside navigation was accepted.'
  }
  if (Test-NavigationControl (New-TestControl $text $name $false $navigation) $null) {
    throw 'Non-actionable sidebar text was accepted.'
  }
  $legacyLink = [pscustomobject]@{ Current = [pscustomobject]@{ Role = 30 } }
  if (-not (Test-NavigationControl (New-TestControl $link $name $false $navigation) $legacyLink)) {
    throw 'Legacy sidebar link was rejected.'
  }
  if (Test-NavigationControl (New-TestControl $link $name $false $settings) $legacyLink) {
    throw 'Legacy link outside navigation was accepted.'
  }
  $script:testCloses = 0
  $process = [pscustomobject]@{ Id = 100 }
  $process | Add-Member -MemberType ScriptMethod -Name CloseMainWindow -Value { $script:testCloses++; return $true }
  $launchMode = 'already-open Control Panel'
  $existingPanelIds = @()
  Close-OwnedControlPanel
  $launchMode = 'registered Store app fixture'
  $existingPanelIds = @(100)
  Close-OwnedControlPanel
  if ($script:testCloses -ne 0) { throw 'A user-owned Control Panel was closed.' }
  $existingPanelIds = @()
  Close-OwnedControlPanel
  if ($script:testCloses -ne 1) { throw 'The newly opened Control Panel was not closed on successful verification.' }
  Write-Output '[nvidia-cpl] Sidebar hyperlink/legacy matching, heading rejection, and owned-window cleanup mocks passed.'
}
