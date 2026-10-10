$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$gpu = $env:OPTI_GPU_NAME
if ([string]::IsNullOrWhiteSpace($gpu)) { throw 'No explicit NVIDIA GPU was supplied.' }
$gpu = ($gpu.Trim() -replace '\s+', ' ')
if ($gpu -notmatch '^NVIDIA\s') { $gpu = "NVIDIA $gpu" }
$scope = [System.Windows.Automation.TreeScope]::Descendants
$all = [System.Windows.Automation.Condition]::TrueCondition
$root = $null

function Elements($type) {
  @($script:root.FindAll($scope, $all) | Where-Object {
    if ($_.Current.IsOffscreen) { return $false }
    if ($_.Current.ControlType -eq $type) { return $true }
    $legacy = $null
    if (-not $_.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacy)) { return $false }
    $roles = @{ Button=43; RadioButton=45; ComboBox=46; Slider=51; ListItem=34 }
    $role = $roles[$type.ProgrammaticName.Split('.')[-1]]
    $null -ne $role -and $legacy.Current.Role -eq $role
  })
}
function Named($type, $names) {
  $until = [DateTime]::UtcNow.AddSeconds(8)
  do {
    # The initial MainWindowHandle can be the splash/loading window. Reacquire
    # the actual window while its navigation provider finishes initializing.
    $process = Get-Process -Name nvcplui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($process) { $script:root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle) }
    $found = @{}
    foreach ($element in $script:root.FindAll($scope, $all)) {
      $legacy = $null
      $hasLegacy = $element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacy)
      $rawName = $element.Current.Name
      if ([string]::IsNullOrWhiteSpace($rawName) -and $hasLegacy) { $rawName = $legacy.Current.Name }
      $name = ($rawName -replace '&', '' -replace '[\u200E\u200F]', '' -replace '\s+', ' ').Trim()
      if ($names -notcontains $name) { continue }
      $candidate = $element
      if ($type -eq [System.Windows.Automation.ControlType]::TreeItem) {
        # Some driver versions expose tree leaves through MSAA rather than
        # UIA TreeItem. Only accept actual outline items, never page headings.
        $tree = $candidate.Current.ControlType -eq $type
        if (-not $tree -and $hasLegacy) {
          $tree = $legacy.Current.Role -eq 36
        }
        if (-not $tree) { continue }
      } elseif ($candidate.Current.ControlType -ne $type) {
        $roles = @{ Button=43; RadioButton=45; ComboBox=46; Slider=51; ListItem=34 }
        $role = $roles[$type.ProgrammaticName.Split('.')[-1]]
        if (-not $hasLegacy -or $null -eq $role -or $legacy.Current.Role -ne $role) { continue }
      }
      $found[($candidate.GetRuntimeId() -join ',')] = $candidate
    }
    $items = @($found.Values)
    if ($items.Count -eq 1) { return $items[0] }
    if ($items.Count -gt 1) { throw "NVIDIA control is ambiguous: $($names -join ' / ')." }
    Start-Sleep -Milliseconds 150
  } while ([DateTime]::UtcNow -lt $until)
  $available = @($script:root.FindAll($scope, $all) | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -Unique -First 25) -join ' | '
  throw "NVIDIA control did not become accessible: $($names -join ' / '). Window: $($script:root.Current.Name). Available controls: $available"
}
function Select-Element($element) {
  $scroll = $null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern, [ref]$scroll)) { $scroll.ScrollIntoView() }
  $pattern = $null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    $pattern.Select()
  } elseif ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    $pattern.Invoke()
  } elseif ($element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$pattern)) {
    if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::TreeItem -or $pattern.Current.Role -eq 36) {
      $pattern.Select(3)
    }
    $pattern.DoDefaultAction()
  } else { throw "NVIDIA control cannot be selected safely: $($element.Current.Name)." }
  Start-Sleep -Milliseconds 250
}
function Apply-Changes {
  $buttons = @(Elements ([System.Windows.Automation.ControlType]::Button) | Where-Object { $_.Current.Name -eq 'Apply' })
  if ($buttons.Count -ne 1) { throw 'NVIDIA Apply button is unavailable or ambiguous.' }
  if ($buttons.Count -eq 1 -and $buttons[0].Current.IsEnabled) {
    Select-Element $buttons[0]
    Start-Sleep -Milliseconds 500
  }
}
function Selected-Name($combo) {
  $pattern = $null
  if ($combo.TryGetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern, [ref]$pattern)) {
    $selection = $pattern.Current.GetSelection()
    if ($selection.Count -eq 1) { return $selection[0].Current.Name }
  }
  if ($combo.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$pattern)) {
    if (-not [string]::IsNullOrWhiteSpace($pattern.Current.Value)) { return $pattern.Current.Value }
  }
  throw 'PhysX processor selection cannot be read back.'
}

$process = Get-Process -Name nvcplui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $process) {
  $paths = @("$env:ProgramFiles\NVIDIA Corporation\Control Panel Client\nvcplui.exe")
  $package = Get-AppxPackage -Name 'NVIDIACorp.NVIDIAControlPanel' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($package) { $paths += (Join-Path $package.InstallLocation 'nvcplui.exe') }
  $path = $paths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $path) { throw 'NVIDIA Control Panel is required to verify PhysX and the preview slider. No full-preset success was recorded.' }
  $signature = Get-AuthenticodeSignature -LiteralPath $path
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'NVIDIA') {
    throw 'NVIDIA Control Panel executable did not pass publisher trust verification.'
  }
  Start-Process -FilePath $path | Out-Null
}
$deadline = [DateTime]::UtcNow.AddSeconds(10)
do {
  $process = Get-Process -Name nvcplui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($process) { $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle) }
  if (-not $root) { Start-Sleep -Milliseconds 100 }
} while (-not $root -and [DateTime]::UtcNow -lt $deadline)
if (-not $root) { throw 'NVIDIA Control Panel did not expose an accessible desktop window.' }

$previewPage = Named ([System.Windows.Automation.ControlType]::TreeItem) @('Adjust image settings with preview')
$physxNames = @('Configure Surround, PhysX', 'Set PhysX configuration', 'Set Multi-GPU and PhysX configuration', 'Set SLI and PhysX configuration')
$physxPage = Named ([System.Windows.Automation.ControlType]::TreeItem) $physxNames
if ($env:OPTI_CPL_PREFLIGHT -eq '1') {
  Select-Element $previewPage
  $null = Named ([System.Windows.Automation.ControlType]::RadioButton) @('Use the advanced 3D image settings')
  $preflightSliders = @(Elements ([System.Windows.Automation.ControlType]::Slider))
  if ($preflightSliders.Count -ne 1) { throw 'Preview slider is not safely accessible; the global profile has not been changed.' }
  $null = $preflightSliders[0].GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern)
  Select-Element $physxPage
  $preflightCombos = @(Elements ([System.Windows.Automation.ControlType]::ComboBox))
  if ($preflightCombos.Count -ne 1) { throw 'PhysX dropdown is not safely accessible; the global profile has not been changed.' }
  $null = Selected-Name $preflightCombos[0]
  Write-Output 'NVIDIA Control Panel navigation verified.'
  return
}
Select-Element (Named ([System.Windows.Automation.ControlType]::TreeItem) @('Adjust image settings with preview'))
$preferences = @(Elements ([System.Windows.Automation.ControlType]::RadioButton) | Where-Object { $_.Current.Name -like 'Use my preference emphasizing*' })
if ($preferences.Count -ne 1) { throw 'The preview preference control is unavailable or ambiguous.' }
$preference = $preferences[0]
Select-Element $preference
$sliders = @(Elements ([System.Windows.Automation.ControlType]::Slider))
if ($sliders.Count -ne 1) { throw 'The preview Performance slider cannot be identified safely.' }
$range = $sliders[0].GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern)
$range.SetValue($range.Current.Minimum)
Apply-Changes
# Retain the explicit Manage 3D preset, rather than letting the simple preview
# preference override it. The remembered slider stays at Performance.
Select-Element (Named ([System.Windows.Automation.ControlType]::RadioButton) @('Use the advanced 3D image settings'))
Apply-Changes
$range = $sliders[0].GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern)
if ($range.Current.Value -ne $range.Current.Minimum) { throw 'Preview Performance slider did not persist. No full-preset success was recorded.' }

Select-Element (Named ([System.Windows.Automation.ControlType]::TreeItem) @('Configure Surround, PhysX', 'Set PhysX configuration', 'Set Multi-GPU and PhysX configuration', 'Set SLI and PhysX configuration'))
$combos = @(Elements ([System.Windows.Automation.ControlType]::ComboBox))
if ($combos.Count -ne 1) { throw 'The PhysX processor dropdown cannot be identified safely.' }
$combo = $combos[0]
if ((Selected-Name $combo) -ne $gpu) {
  $expansion = $null
  if ($combo.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$expansion)) {
    $expansion.Expand()
  } elseif ($combo.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$expansion)) {
    $expansion.DoDefaultAction()
  } else { throw 'PhysX dropdown cannot be opened safely.' }
  Start-Sleep -Milliseconds 200
  $desktop = [System.Windows.Automation.AutomationElement]::RootElement
  $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem)
  $items = @($desktop.FindAll($scope, $condition) | Where-Object { $_.Current.Name -eq $gpu -and -not $_.Current.IsOffscreen })
  if ($items.Count -ne 1) { throw 'The exact PhysX GPU is unavailable or ambiguous. Auto-select was not accepted as success.' }
  Select-Element $items[0]
  Apply-Changes
}
if ((Selected-Name $combo) -ne $gpu) { throw 'PhysX processor did not read back as the exact NVIDIA GPU.' }
Select-Element (Named ([System.Windows.Automation.ControlType]::TreeItem) @('Adjust image settings with preview'))
$sliders = @(Elements ([System.Windows.Automation.ControlType]::Slider))
if ($sliders.Count -ne 1) { throw 'The persisted preview slider is unavailable.' }
$range = $sliders[0].GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern)
if ($range.Current.Value -ne $range.Current.Minimum) { throw 'The remembered Performance slider did not survive page reload.' }
Select-Element (Named ([System.Windows.Automation.ControlType]::TreeItem) @('Configure Surround, PhysX', 'Set PhysX configuration', 'Set Multi-GPU and PhysX configuration', 'Set SLI and PhysX configuration'))
$combos = @(Elements ([System.Windows.Automation.ControlType]::ComboBox))
if ($combos.Count -ne 1 -or (Selected-Name $combos[0]) -ne $gpu) { throw 'PhysX GPU selection did not survive page reload.' }
Write-Output 'PhysX GPU and preview Performance verified.'
