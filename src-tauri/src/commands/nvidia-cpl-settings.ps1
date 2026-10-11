$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName Accessibility
# Windows PowerShell's managed UIA client does not expose the legacy pattern
# class. Use supported MSAA COM APIs. Patternless Static navigation has a
# separate exact-element input fallback; never use hardcoded coordinates.
if (-not ('OptiGods.CplMsaa' -as [type])) {
  Add-Type -ReferencedAssemblies ([Accessibility.IAccessible].Assembly.Location) -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Accessibility;
namespace OptiGods {
  public sealed class CplMsaaInfo {
    public string Name, Value;
    public int Role, State, Left, Top, Width, Height;
  }
  public sealed class CplMsaaControl {
    private readonly IAccessible accessible;
    private readonly object child;
    public CplMsaaControl(IAccessible a, object c) { accessible = a; child = c; }
    public CplMsaaInfo Current {
      get {
        int left, top, width, height;
        accessible.accLocation(out left, out top, out width, out height, child);
        string value = null;
        try { value = accessible.get_accValue(child); } catch (COMException) {}
        return new CplMsaaInfo {
          Name = accessible.get_accName(child), Value = value,
          Role = Convert.ToInt32(accessible.get_accRole(child)),
          State = Convert.ToInt32(accessible.get_accState(child)),
          Left = left, Top = top, Width = width, Height = height
        };
      }
    }
    public void Select(int flags) { accessible.accSelect(flags, child); }
    public void DoDefaultAction() { accessible.accDoDefaultAction(child); }
  }
  public static class CplMsaa {
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }
    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromPoint(Point point,
      [MarshalAs(UnmanagedType.Interface)] out IAccessible accessible,
      [MarshalAs(UnmanagedType.Struct)] out object child);
    public static CplMsaaControl FromPoint(int x, int y) {
      IAccessible accessible;
      object child;
      int hr = AccessibleObjectFromPoint(new Point { X = x, Y = y }, out accessible, out child);
      if (hr < 0 || accessible == null) return null;
      return new CplMsaaControl(accessible, child);
    }
  }
  public static class CplInput {
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput {
      public int X, Y;
      public uint Data, Flags, Time;
      public UIntPtr Extra;
    }
    [StructLayout(LayoutKind.Explicit)]
    private struct InputData { [FieldOffset(0)] public MouseInput Mouse; }
    [StructLayout(LayoutKind.Sequential)]
    private struct Input { public uint Type; public InputData Data; }
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] private static extern bool IsChild(IntPtr parent, IntPtr child);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, Input[] inputs, int size);
    public static void Focus(IntPtr window) {
      if (window == IntPtr.Zero) throw new InvalidOperationException("NVIDIA window handle is missing.");
      if (IsIconic(window)) ShowWindow(window, 9);
      if (!SetForegroundWindow(window) && GetForegroundWindow() != window)
        throw new InvalidOperationException("Windows did not allow NVIDIA Control Panel to become foreground.");
    }
    public static void Click(IntPtr window, IntPtr expectedControl, int x, int y) {
      var point = new Point { X = x, Y = y };
      IntPtr hit = WindowFromPoint(point);
      uint owner, hitOwner;
      GetWindowThreadProcessId(window, out owner);
      GetWindowThreadProcessId(hit, out hitOwner);
      if (owner == 0 || hitOwner != owner || GetAncestor(hit, 2) != window ||
          GetForegroundWindow() != window ||
          (expectedControl != IntPtr.Zero && hit != expectedControl && !IsChild(expectedControl, hit)))
        throw new InvalidOperationException("NVIDIA navigation target is covered or its window identity changed; no click was sent.");
      Point previous;
      bool havePrevious = GetCursorPos(out previous);
      if (!SetCursorPos(x, y)) throw new InvalidOperationException("Windows refused the verified NVIDIA target position.");
      try {
        // Recheck after moving the pointer; do not act on a popup/overlay.
        Point ready;
        if (!GetCursorPos(out ready) || ready.X != x || ready.Y != y ||
            WindowFromPoint(point) != hit || GetForegroundWindow() != window)
          throw new InvalidOperationException("NVIDIA navigation target changed before input; no click was sent.");
        var inputs = new[] {
          new Input { Type = 0, Data = new InputData { Mouse = new MouseInput { Flags = 2 } } },
          new Input { Type = 0, Data = new InputData { Mouse = new MouseInput { Flags = 4 } } }
        };
        uint sent = SendInput(2, inputs, Marshal.SizeOf(typeof(Input)));
        if (sent != 2) {
          if (sent == 1) SendInput(1, new[] { inputs[1] }, Marshal.SizeOf(typeof(Input)));
          throw new InvalidOperationException("Windows refused complete NVIDIA navigation input.");
        }
        System.Threading.Thread.Sleep(75);
      } finally {
        Point current;
        if (havePrevious && GetCursorPos(out current) && current.X == x && current.Y == y)
          SetCursorPos(previous.X, previous.Y);
      }
    }
    public static int InputSize { get { return Marshal.SizeOf(typeof(Input)); } }
  }
}
'@
}
$gpu = $env:OPTI_GPU_NAME
if ([string]::IsNullOrWhiteSpace($gpu)) { throw 'No explicit NVIDIA GPU was supplied.' }
$gpu = ($gpu.Trim() -replace '\s+', ' ')
if ($gpu -notmatch '^NVIDIA\s') { $gpu = "NVIDIA $gpu" }
$scope = [System.Windows.Automation.TreeScope]::Descendants
$all = [System.Windows.Automation.Condition]::TrueCondition
$root = $null

function Normalize-Name($name) {
  (($name -replace '&', '' -replace '[\u200E\u200F]', '' -replace '\s+', ' ').Trim())
}
function Get-Legacy($element) {
  # Resolve only the accessible child at this element's bounds. Reject an
  # overlay, parent, or unrelated element rather than acting on guessed UI.
  try {
    $bounds = $element.Current.BoundingRectangle
    if ($bounds.IsEmpty -or $bounds.Width -le 0 -or $bounds.Height -le 0) { return $null }
    $x = [int][Math]::Floor($bounds.Left + $bounds.Width / 2)
    $y = [int][Math]::Floor($bounds.Top + $bounds.Height / 2)
    $legacy = [OptiGods.CplMsaa]::FromPoint($x, $y)
    if (-not $legacy) { return $null }
    $info = $legacy.Current
    if (($info.State -band 0x8000) -ne 0 -or $info.Width -le 0 -or $info.Height -le 0) { return $null }
    if ($x -lt $info.Left -or $x -ge ($info.Left + $info.Width) -or $y -lt $info.Top -or $y -ge ($info.Top + $info.Height)) { return $null }
    $name = Normalize-Name $element.Current.Name
    if ($name) {
      if ($name -ne (Normalize-Name $info.Name)) { return $null }
    } elseif ($info.Left -lt ($bounds.Left - 2) -or $info.Top -lt ($bounds.Top - 2) -or ($info.Left + $info.Width) -gt ($bounds.Right + 2) -or ($info.Top + $info.Height) -gt ($bounds.Bottom + 2)) {
      return $null
    }
    return $legacy
  } catch { return $null }
}
function Elements($type) {
  @($script:root.FindAll($scope, $all) | Where-Object {
    if ($_.Current.IsOffscreen) { return $false }
    if ($_.Current.ControlType -eq $type) { return $true }
    $legacy = Get-Legacy $_
    if (-not $legacy) { return $false }
    $roles = @{ Button=43; RadioButton=45; ComboBox=46; Slider=51; ListItem=34 }
    $role = $roles[$type.ProgrammaticName.Split('.')[-1]]
    $null -ne $role -and $legacy.Current.Role -eq $role
  })
}
function Get-ControlParent($element) {
  [System.Windows.Automation.TreeWalker]::RawViewWalker.GetParent($element)
}
function Test-NavigationScope($element) {
  $parent = $element
  for ($depth = 0; $depth -lt 16; $depth++) {
    $parent = Get-ControlParent $parent
    if (-not $parent) { break }
    if ($parent.Current.ControlType -eq [System.Windows.Automation.ControlType]::Tree -or $parent.Current.ClassName -eq 'SysTreeView32' -or (Normalize-Name $parent.Current.Name) -in @('Left View', 'Select a Task...')) {
      return $true
    }
  }
  return $false
}
function Test-StaticNavigation($element) {
  $current = $element.Current
  if ($current.ClassName -ne 'Static' -or $current.ControlType -notin @([System.Windows.Automation.ControlType]::Pane, [System.Windows.Automation.ControlType]::Text)) { return $false }
  if ($current.IsOffscreen -or -not $current.IsEnabled) { return $false }
  if ((Normalize-Name $current.Name) -notin @('Adjust image settings with preview', 'Configure Surround, PhysX', 'Set PhysX configuration', 'Set Multi-GPU and PhysX configuration', 'Set SLI and PhysX configuration')) { return $false }
  $bounds = $current.BoundingRectangle
  if ($bounds.IsEmpty -or $bounds.Width -le 0 -or $bounds.Height -le 0) { return $false }
  Test-NavigationScope $element
}
function Test-NavigationControl($element, $legacy) {
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::TreeItem) { return $true }
  if ($legacy -and $legacy.Current.Role -eq 36) { return $true }
  $action = $null
  $actionable = $element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$action)
  if (-not $actionable) {
    $actionable = $element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$action)
  }
  if (-not $actionable -and $legacy) { $actionable = $legacy.Current.Role -in @(30, 36, 43) }
  if ($actionable) { return (Test-NavigationScope $element) }
  Test-StaticNavigation $element
}
function Focus-ControlPanel {
  [OptiGods.CplInput]::Focus([IntPtr]$script:root.Current.NativeWindowHandle)
}
function Get-ControlAtPoint($x, $y) {
  [System.Windows.Automation.AutomationElement]::FromPoint([System.Windows.Point]::new($x, $y))
}
function Send-ExactNavigationClick($element, $x, $y) {
  [OptiGods.CplInput]::Click([IntPtr]$script:root.Current.NativeWindowHandle, [IntPtr]$element.Current.NativeWindowHandle, $x, $y)
}
function Select-StaticNavigation($element) {
  if (-not (Test-StaticNavigation $element)) { throw 'Patternless NVIDIA control is not an approved visible sidebar entry.' }
  Focus-ControlPanel
  Start-Sleep -Milliseconds 100
  # Re-read after activation, in case restoring/focusing moved the window.
  if (-not (Test-StaticNavigation $element)) { throw 'NVIDIA sidebar entry changed after window activation; no click was sent.' }
  $bounds = $element.Current.BoundingRectangle
  $x = [int][Math]::Floor($bounds.Left + $bounds.Width / 2)
  $y = [int][Math]::Floor($bounds.Top + $bounds.Height / 2)
  $hit = Get-ControlAtPoint $x $y
  if (-not $hit -or ($hit.GetRuntimeId() -join ',') -ne ($element.GetRuntimeId() -join ',')) {
    throw 'NVIDIA sidebar entry is covered or cannot be hit-tested exactly; no click was sent.'
  }
  Send-ExactNavigationClick $element $x $y
}
function Named($type, $names) {
  $until = [DateTime]::UtcNow.AddSeconds(8)
  do {
    # The initial MainWindowHandle can be the splash/loading window. Reacquire
    # the actual window while its navigation provider finishes initializing.
    $process = Get-Process -Name nvcplui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($process) { $script:root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle) }
    $found = @{}
    $matchingControls = @()
    foreach ($element in $script:root.FindAll($scope, $all)) {
      $legacy = Get-Legacy $element
      $hasLegacy = $null -ne $legacy
      $rawName = $element.Current.Name
      if ([string]::IsNullOrWhiteSpace($rawName) -and $hasLegacy) { $rawName = $legacy.Current.Name }
      $name = Normalize-Name $rawName
      if ($names -notcontains $name) { continue }
      $candidate = $element
      $patterns = @($candidate.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName }) -join ','
      $matchingControls += "$name [type=$($candidate.Current.ControlType.ProgrammaticName); class=$($candidate.Current.ClassName); patterns=$patterns; hwnd=$($candidate.Current.NativeWindowHandle); navigationScope=$(Test-NavigationScope $candidate); bounds=$($candidate.Current.BoundingRectangle); legacyRole=$(if ($hasLegacy) { $legacy.Current.Role } else { 'unavailable' })]"
      if ($type -eq [System.Windows.Automation.ControlType]::TreeItem) {
        if (-not (Test-NavigationControl $candidate $legacy)) { continue }
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
  throw "NVIDIA control did not become accessible: $($names -join ' / '). Window: $($script:root.Current.Name). Named matches: $($matchingControls -join ' | '). Available controls: $available"
}
function Select-Element($element) {
  $scroll = $null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern, [ref]$scroll)) { $scroll.ScrollIntoView() }
  $pattern = $null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    $pattern.Select()
  } elseif ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    $pattern.Invoke()
  } elseif (Test-StaticNavigation $element) {
    Select-StaticNavigation $element
  } elseif ($null -ne ($pattern = Get-Legacy $element)) {
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
  $pattern = Get-Legacy $combo
  if ($pattern) {
    if (-not [string]::IsNullOrWhiteSpace($pattern.Current.Value)) { return $pattern.Current.Value }
  }
  throw 'PhysX processor selection cannot be read back.'
}

function Get-NvidiaStoreTarget($package) {
  if ($package.Name -ne 'NVIDIACorp.NVIDIAControlPanel' -or $package.PackageFamilyName -notmatch '^NVIDIACorp\.NVIDIAControlPanel_[A-Za-z0-9]+$') {
    throw 'NVIDIA Control Panel package identity is invalid.'
  }
  $manifest = Get-AppxPackageManifest -Package $package.PackageFullName -ErrorAction Stop
  $apps = @($manifest.Package.Applications.Application | Where-Object {
    $_.Executable -match '(^|[\\/])nvcplui\.exe$'
  })
  if ($apps.Count -ne 1 -or $apps[0].Id -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
    throw 'The registered NVIDIA Control Panel application is unavailable or ambiguous.'
  }
  $location = [IO.Path]::GetFullPath($package.InstallLocation).TrimEnd('\') + '\'
  $executable = [IO.Path]::GetFullPath((Join-Path $location $apps[0].Executable))
  if (-not $executable.StartsWith($location, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'NVIDIA Control Panel executable is outside its registered package.'
  }
  [pscustomobject]@{
    Executable = $executable
    AppId = "$($package.PackageFamilyName)!$($apps[0].Id)"
  }
}
function Assert-NvidiaPublisher($path) {
  if (-not (Test-Path -LiteralPath $path)) { throw 'The registered NVIDIA Control Panel executable is missing.' }
  $signature = Get-AuthenticodeSignature -LiteralPath $path
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'NVIDIA') {
    throw 'NVIDIA Control Panel executable did not pass publisher trust verification.'
  }
}
function Start-NvidiaControlPanel {
  $package = Get-AppxPackage -Name 'NVIDIACorp.NVIDIAControlPanel' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($package) {
    $target = Get-NvidiaStoreTarget $package
    Assert-NvidiaPublisher $target.Executable
    # Store/DCH apps must be activated through their registered identity.
    # Direct CreateProcess on the protected WindowsApps EXE can be denied,
    # especially from the elevated optimizer. Explorer delegates to the shell.
    $script:launchMode = "registered Store app $($target.AppId)"
    try {
      Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList @("shell:AppsFolder\$($target.AppId)") -ErrorAction Stop | Out-Null
    } catch {
      throw "Windows could not activate NVIDIA Control Panel through its registered Store entry: $($_.Exception.Message). Open NVIDIA Control Panel from Start, then retry. No preset success was recorded."
    }
    return
  }
  $path = Join-Path $env:ProgramFiles 'NVIDIA Corporation\Control Panel Client\nvcplui.exe'
  if (-not (Test-Path -LiteralPath $path)) {
    throw 'NVIDIA Control Panel is required to verify PhysX and the preview slider. Open it from Start, then retry. No full-preset success was recorded.'
  }
  Assert-NvidiaPublisher $path
  $script:launchMode = 'signed desktop executable'
  try {
    Start-Process -FilePath $path -WorkingDirectory (Split-Path -Parent $path) -ErrorAction Stop | Out-Null
  } catch {
    throw "Windows could not launch the desktop NVIDIA Control Panel: $($_.Exception.Message). Open NVIDIA Control Panel from Start, then retry. No preset success was recorded."
  }
}

$launchMode = 'already-open Control Panel'
$existingPanelIds = @(Get-Process -Name nvcplui -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
function Close-OwnedControlPanel {
  # Never close a panel that the user already had open, or hide a failed run.
  if ($launchMode -eq 'already-open Control Panel') { return }
  if ($process -and $process.Id -notin $existingPanelIds) {
    try { $null = $process.CloseMainWindow() } catch { Write-Warning 'Preset verification succeeded, but the opened Control Panel window could not be closed.' }
  }
}
$process = Get-Process -Name nvcplui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $process) {
  Start-NvidiaControlPanel
}
$deadline = [DateTime]::UtcNow.AddSeconds(15)
do {
  $process = Get-Process -Name nvcplui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($process) { $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle) }
  if (-not $root) { Start-Sleep -Milliseconds 100 }
} while (-not $root -and [DateTime]::UtcNow -lt $deadline)
if (-not $root) { throw "NVIDIA Control Panel did not expose an accessible desktop window within 15 seconds (launch: $launchMode). Open NVIDIA Control Panel from Start, then retry. No preset success was recorded." }

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
  Close-OwnedControlPanel
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
  } elseif ($null -ne ($expansion = Get-Legacy $combo)) {
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
Close-OwnedControlPanel
