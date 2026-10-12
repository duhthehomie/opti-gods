$ErrorActionPreference = 'Stop'
& {
  # Exercise the exact native bootstrap in Windows PowerShell with synthetic
  # UTF-8 source larger than CreateProcess's command-line limit. No settings.
  $native = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\src-tauri\src\commands\nvidia_cpl_process.rs'))
  $match = [regex]::Match($native, 'pub const BOOTSTRAP: &str = "([^"]+)";')
  if (-not $match.Success -or $match.Groups[1].Value.Length -ge 512) { throw 'Missing short reviewed stdin bootstrap.' }
  $bootstrap = $match.Groups[1].Value
  if (-not $bootstrap.Contains('[Console]::OpenStandardInput()') -or -not $bootstrap.Contains('StreamReader')) {
    throw 'Bootstrap must decode the raw stdin pipe, not the Windows console text reader.'
  }
  if (-not $bootstrap.Contains('ReadToEnd().TrimStart([char]0xFEFF)')) {
    throw 'Bootstrap must explicitly remove leading BOM characters before parsing source.'
  }
  $expected = 'stdin fixture ' + [char]0x2713 + [char]0x00E9
  $payload = '#' + ('x' * 40000) + "`n" + '[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Write-Output "' + $expected + '"'
  foreach ($withBom in @($false, $true)) {
  $process = [Diagnostics.Process]::new()
  $process.StartInfo.FileName = Join-Path $PSHOME 'powershell.exe'
  $process.StartInfo.Arguments = '-NoProfile -NonInteractive -Sta -Command "' + $bootstrap + '"'
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.CreateNoWindow = $true
  $process.StartInfo.RedirectStandardInput = $true
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true
  $process.StartInfo.StandardOutputEncoding = [Text.Encoding]::UTF8
  $process.StartInfo.StandardErrorEncoding = [Text.Encoding]::UTF8
  $process.StartInfo.EnvironmentVariables.Remove('PSModulePath')
  try {
    $null = $process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    # Match Rust's raw byte pipe exactly. Closing StreamWriter can emit its
    # own encoding preamble even though the payload was written via BaseStream.
    $inputPipe = $process.StandardInput.BaseStream
    if ($withBom) {
      $preamble = [byte[]]@(0xEF, 0xBB, 0xBF)
      $inputPipe.Write($preamble, 0, $preamble.Length)
    }
    $inputPipe.Write($bytes, 0, $bytes.Length)
    $inputPipe.Close()
    if (-not $process.WaitForExit(10000)) { throw 'Windows PowerShell stdin fixture exceeded its deadline.' }
    if (-not $stdout.Wait(5000) -or -not $stderr.Wait(5000)) { throw 'Windows PowerShell output did not reach EOF.' }
    if ($process.ExitCode -ne 0 -or $stdout.Result.Trim() -ne $expected) {
      $details = $stderr.Result
      if ($details.Length -gt 1200) { $details = $details.Substring(0, 1200) + ' [diagnostic truncated]' }
      throw "Large stdin/UTF-8 bootstrap did not execute exactly once (BOM=$withBom, exit=$($process.ExitCode)): $details"
    }
    Write-Output "[nvidia-cpl] Large UTF-8 stdin execution passed (BOM=$withBom)."
  } finally {
    if ($process.Id -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
    $process.Dispose()
  }
  }
  Write-Output '[nvidia-cpl] Large-source Windows PowerShell stdin transport and Unicode readback passed, with and without BOM.'
}
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
# Exercise the same WPF geometry types used by live UIA hit testing and the
# fixtures, before any navigation mocks. Loading UIA alone is not sufficient.
$geometryBounds = [System.Windows.Rect]::new(100, 200, 300, 20)
$geometryPoint = [System.Windows.Point]::new(250, 210)
if (-not $geometryBounds.Contains($geometryPoint)) { throw 'WindowsBase geometry initialization failed.' }
if (-not ('OptiGods.CplMsaa' -as [type]) -or -not ('OptiGods.CplMsaaControl' -as [type])) {
  throw 'NVIDIA MSAA helper failed to compile/load in Windows PowerShell.'
}
if (-not [OptiGods.CplMsaa].GetMethod('FromPoint')) { throw 'MSAA lookup entry point is missing.' }
if (-not ('OptiGods.CplInput' -as [type])) { throw 'Exact-navigation input helper failed to compile.' }
if (-not ('OptiGods.CplTrackbar' -as [type]) -or -not [OptiGods.CplTrackbar].GetMethod('Read') -or -not [OptiGods.CplTrackbar].GetMethod('SetMinimum')) {
  throw 'Native NVIDIA trackbar helper failed to compile/load.'
}
$expectedInputSize = if ([IntPtr]::Size -eq 8) { 40 } else { 28 }
if ([OptiGods.CplInput]::InputSize -ne $expectedInputSize) { throw 'Win32 input structure layout is incorrect.' }
Write-Output '[nvidia-cpl] Windows PowerShell syntax, WindowsBase Point/Rect geometry, and MSAA/input helper compilation passed; no settings were changed.'
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
  foreach ($name in @('Normalize-Name', 'Get-ControlParent', 'Test-NavigationScope', 'Test-StaticNavigation', 'Test-NavigationControl', 'Select-StaticNavigation', 'Close-OwnedControlPanel')) {
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
      Current = [pscustomobject]@{
        ControlType = $type; Name = $name; ClassName = ''
        IsOffscreen = $false; IsEnabled = $true; NativeWindowHandle = 0
        BoundingRectangle = [System.Windows.Rect]::new(100, 200, 300, 20)
      }
      Parent = $parent
      Actionable = $actionable
      RuntimeId = @(1, 2, 3)
    }
    $control | Add-Member -MemberType ScriptMethod -Name TryGetCurrentPattern -Value {
      param($pattern, $value)
      return ($this.Actionable -and $pattern.Id -eq [System.Windows.Automation.InvokePattern]::Pattern.Id)
    }
    $control | Add-Member -MemberType ScriptMethod -Name GetRuntimeId -Value { $this.RuntimeId }
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
  $static = New-TestControl $pane $name $false $navigation
  $static.Current.ClassName = 'Static'
  if (-not (Test-NavigationControl $static $null)) { throw 'The reported patternless Static sidebar entry is still rejected.' }
  $heading = New-TestControl $pane $name $false $settings
  $heading.Current.ClassName = 'Static'
  $heading.RuntimeId = @(4, 5, 6)
  if (Test-NavigationControl $heading $null) { throw 'Patternless Static page heading was accepted as navigation.' }
  $static.Current.IsEnabled = $false
  if (Test-NavigationControl $static $null) { throw 'Disabled Static navigation was accepted.' }
  $static.Current.IsEnabled = $true
  $static.Current.IsOffscreen = $true
  if (Test-NavigationControl $static $null) { throw 'Offscreen Static navigation was accepted.' }
  $static.Current.IsOffscreen = $false
  $static.Current.Name = 'Unapproved setting'
  if (Test-NavigationControl $static $null) { throw 'An unapproved Static entry was accepted.' }
  $static.Current.Name = $name
  $script:testHit = $static
  $script:testClicks = @()
  function Focus-ControlPanel {}
  function Get-ControlAtPoint($x, $y) { $script:testHit }
  function Send-ExactNavigationClick($element, $x, $y) {
    $script:testClicks += [pscustomobject]@{ X = $x; Y = $y }
  }
  Select-StaticNavigation $static
  if ($script:testClicks.Count -ne 1 -or $script:testClicks[0].X -ne 250 -or $script:testClicks[0].Y -ne 210) {
    throw 'Navigation did not use the live exact-element bounds.'
  }
  $script:testHit = $heading
  $blocked = $false
  try { Select-StaticNavigation $static } catch {
    if ($_.Exception.Message -notlike '*no click was sent*') { throw }
    $blocked = $true
  }
  if (-not $blocked -or $script:testClicks.Count -ne 1) { throw 'Covered/mismatched navigation was clicked.' }
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
  Write-Output '[nvidia-cpl] Sidebar hyperlink/legacy/Static matching, heading/offscreen/disabled/overlay rejection, live-bounds hit testing, and owned-window cleanup mocks passed.'
}
& {
  foreach ($name in @('Normalize-Name', 'Test-ExpectedPhysxGpu', 'Get-PreviewState', 'Set-PreviewPerformance', 'Assert-AdvancedPreview')) {
    $definitions = @($ast.FindAll({
      param($node)
      $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $true))
    if ($definitions.Count -ne 1) { throw "Missing production function: $name" }
    . ([ScriptBlock]::Create($definitions[0].Extent.Text))
  }
  function Expect-PreviewFailure($action, $message) {
    $failed = $false
    try { & $action } catch {
      if ($_.Exception.Message -notlike "*$message*") { throw }
      $failed = $true
    }
    if (-not $failed) { throw "Expected preview failure: $message" }
  }
  $script:previewWrites = 0
  $script:nativeRejected = $false
  $script:nativePersist = $true
  $script:previewValue = 2
  function Read-NativePreviewSlider($slider) {
    if ($script:nativeRejected) { throw 'not a verified native NVIDIA trackbar' }
    [pscustomobject]@{ Minimum = 0; Maximum = 2; Value = $script:previewValue }
  }
  function Set-NativePreviewPerformance($slider) {
    $script:previewWrites++
    if ($script:nativePersist) { $script:previewValue = 0 }
  }
  $slider = [pscustomobject]@{
    Current = [pscustomobject]@{ IsEnabled = $false }
    Range = $null
  }
  $slider | Add-Member -MemberType ScriptMethod -Name TryGetCurrentPattern -Value {
    param($pattern, $value)
    if ($null -ne $this.Range) { $value.Value = $this.Range; return $true }
    return $false
  }
  # Reproduce the real failing state: disabled slider, no RangeValue pattern.
  $state = Get-PreviewState $slider
  if ($state.Value -ne 2 -or $script:previewWrites -ne 0) { throw 'Preflight changed the disabled preview slider.' }
  Expect-PreviewFailure { Set-PreviewPerformance $slider } 'still disabled'
  if ($script:previewWrites -ne 0) { throw 'A disabled preview slider was written.' }
  $slider.Current.IsEnabled = $true
  Set-PreviewPerformance $slider
  if ($script:previewValue -ne 0 -or $script:previewWrites -ne 1) { throw 'Patternless native preview slider was not set to Performance.' }
  $script:previewValue = 2
  $script:nativePersist = $false
  Expect-PreviewFailure { Set-PreviewPerformance $slider } 'did not read back'
  $script:nativeRejected = $true
  Expect-PreviewFailure { Get-PreviewState $slider } 'not a verified native'
  $range = [pscustomobject]@{ Current = [pscustomobject]@{ Minimum = 0; Maximum = 2; Value = 2; IsReadOnly = $false } }
  $range | Add-Member -MemberType ScriptMethod -Name SetValue -Value { param($value) $this.Current.Value = $value }
  $slider.Range = $range
  Set-PreviewPerformance $slider
  if ($range.Current.Value -ne 0) { throw 'RangeValue preview path did not set Performance.' }
  $range.Current.IsReadOnly = $true
  Expect-PreviewFailure { Set-PreviewPerformance $slider } 'read-only'
  $range.Current.IsReadOnly = $false
  $range.Current.Value = 3
  Expect-PreviewFailure { Get-PreviewState $slider } 'range/readback is invalid'
  $script:advancedSelected = $false
  $script:advancedLegacy = $false
  $script:advancedLegacyState = 0
  $advanced = [pscustomobject]@{}
  $advanced | Add-Member -MemberType ScriptMethod -Name TryGetCurrentPattern -Value {
    param($pattern, $value)
    if ($script:advancedLegacy) { return $false }
    $value.Value = [pscustomobject]@{ Current = [pscustomobject]@{ IsSelected = $script:advancedSelected } }
    return $true
  }
  function Named($type, $names) { $advanced }
  function Get-Legacy($element) { [pscustomobject]@{ Current = [pscustomobject]@{ State = $script:advancedLegacyState } } }
  Expect-PreviewFailure { Assert-AdvancedPreview } 'did not remain selected'
  $script:advancedSelected = $true
  Assert-AdvancedPreview
  $script:advancedLegacy = $true
  Expect-PreviewFailure { Assert-AdvancedPreview } 'did not remain selected'
  $script:advancedLegacyState = 0x10
  Assert-AdvancedPreview
  $persisted = @($ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-PersistedCplSettings'
  }, $true))
  if ($persisted.Count -ne 1) { throw 'Persisted Control Panel readback function is missing.' }
  . ([ScriptBlock]::Create($persisted[0].Extent.Text))
  $gpu = 'NVIDIA Fixture GPU'
  if (-not (Test-ExpectedPhysxGpu 'Fixture GPU') -or -not (Test-ExpectedPhysxGpu 'NVIDIA Fixture GPU')) {
    throw 'Exact PhysX model matching failed with an optional vendor prefix.'
  }
  if ((Test-ExpectedPhysxGpu 'Auto-select') -or (Test-ExpectedPhysxGpu 'CPU') -or (Test-ExpectedPhysxGpu 'NVIDIA Different GPU')) {
    throw 'A nonmatching PhysX processor was accepted.'
  }
  $script:testProcessor = $gpu
  $script:testSavedPosition = 0
  $script:testPages = @()
  function Named($type, $names) {
    if ($type -eq [System.Windows.Automation.ControlType]::RadioButton) { return $advanced }
    [pscustomobject]@{ Name = $names[0] }
  }
  function Select-Element($element) {
    if ($element.Name -notin @('Adjust image settings with preview', 'Configure Surround, PhysX')) { throw 'Final readback tried to change a setting.' }
    $script:testPages += $element.Name
  }
  function Get-PreviewSlider { [pscustomobject]@{} }
  function Get-PreviewState($slider) { [pscustomobject]@{ Minimum = 0; Value = $script:testSavedPosition } }
  function Elements($type) { [pscustomobject]@{} }
  function Selected-Name($combo) { $script:testProcessor }
  function Apply-Changes { throw 'Final readback tried to Apply changes.' }
  function Set-PreviewPerformance($slider) { throw 'Final readback tried to set the slider.' }
  Assert-PersistedCplSettings
  if ($script:testPages.Count -ne 2) { throw 'Final readback did not revisit both preview and PhysX pages.' }
  $script:testSavedPosition = 2
  Expect-PreviewFailure { Assert-PersistedCplSettings } 'Performance slider did not survive'
  $script:testSavedPosition = 0
  $script:testProcessor = 'Auto-select'
  Expect-PreviewFailure { Assert-PersistedCplSettings } 'PhysX GPU selection did not survive'
  Write-Output '[nvidia-cpl] Disabled/patternless read-only preflight, enabled trackbar/RangeValue writes, unsupported/read-only/failed-readback rejection, and advanced-mode UIA/MSAA verification mocks passed.'
  Write-Output '[nvidia-cpl] Persisted preview/PhysX readback changes no settings and rejects Quality/Auto-select.'
}
