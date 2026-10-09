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
    $_.Current.ControlType -eq $type -and -not $_.Current.IsOffscreen
  })
}
function Named($type, $names) {
  $items = @(Elements $type | Where-Object { $names -contains $_.Current.Name })
  if ($items.Count -ne 1) { throw "NVIDIA Control Panel control is unavailable or ambiguous: $($names -join ' / ')." }
  $items[0]
}
function Select-Element($element) {
  $pattern = $null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    $pattern.Select()
  } elseif ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    $pattern.Invoke()
  } else { throw "NVIDIA control cannot be selected safely: $($element.Current.Name)." }
  Start-Sleep -Milliseconds 250
}
function Apply-Changes {
  $buttons = @(Elements ([System.Windows.Automation.ControlType]::Button) | Where-Object { $_.Current.Name -eq 'Apply' })
  if ($buttons.Count -ne 1) { throw 'NVIDIA Apply button is unavailable or ambiguous.' }
  if ($buttons.Count -eq 1 -and $buttons[0].Current.IsEnabled) {
    $buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Start-Sleep -Milliseconds 500
  }
}
function Selected-Name($combo) {
  $selection = $combo.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern).Current.GetSelection()
  if ($selection.Count -ne 1) { throw 'PhysX processor selection cannot be read back.' }
  $selection[0].Current.Name
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
  $combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand()
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
