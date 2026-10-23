fn main() {
    println!("cargo:rerun-if-changed=app.manifest");
    println!("cargo:rerun-if-changed=resources/native-tweak-scripts.json");
    println!("cargo:rerun-if-changed=src/commands/nvidia-cpl-settings.ps1");
    println!("cargo:rerun-if-changed=src/commands/nvidia_cpl_process.rs");
    println!("cargo:rerun-if-changed=../script/verify-nvidia-cpl.ps1");
    println!("cargo:rerun-if-changed=../script/verify-native-wrapper.ps1");
    println!("cargo:rerun-if-changed=../script/native-wrapper-fixtures.json");
    println!("cargo:rerun-if-changed=sensor-reader/Program.cs");
    println!("cargo:rerun-if-changed=sensor-reader/OptiGods.Sensors.csproj");
    #[cfg(windows)]
    publish_sensor_reader();
    #[cfg(windows)]
    validate_bundled_scripts();
    #[cfg(windows)]
    validate_nvidia_cpl();
    #[cfg(windows)]
    validate_native_outcomes();

    let windows = tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest"));
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}

#[cfg(windows)]
fn validate_native_outcomes() {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("missing Cargo manifest directory");
    let script = std::path::Path::new(&manifest).join("../script/verify-native-wrapper.ps1");
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(script).env_remove("PSModulePath").output()
        .expect("Native outcome validation could not start");
    assert!(output.status.success(), "Native outcome validation failed: {}\n{}",
        String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
}

#[cfg(windows)]
fn validate_nvidia_cpl() {
    // Synthetic transport and mocked UI checks only; no NVIDIA installation
    // or settings writes are needed on the Windows build machine.
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("missing Cargo manifest directory");
    let script = std::path::Path::new(&manifest).join("../script/verify-nvidia-cpl.ps1");
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Sta", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(script).env_remove("PSModulePath").output()
        .expect("NVIDIA Control Panel validation could not start");
    assert!(output.status.success(), "NVIDIA Control Panel validation failed: {}\n{}",
        String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
}

#[cfg(windows)]
fn publish_sensor_reader() {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("missing Cargo manifest directory");
    let base = std::path::Path::new(&manifest);
    let output = base.join("resources/cpu-sensors");
    std::fs::create_dir_all(&output).expect("cannot prepare sensor resources");
    let status = std::process::Command::new("dotnet")
        .args(["publish", "--configuration", "Release", "--output"])
        .arg(&output).arg(base.join("sensor-reader/OptiGods.Sensors.csproj"))
        .status().expect("The Windows build requires the .NET 8 SDK to publish the sensor reader");
    assert!(status.success(), "sensor reader publish failed; refusing an incomplete installer");
    write_sensor_hash(&output).expect("sensor reader integrity manifest generation failed");
}

#[cfg(windows)]
fn write_sensor_hash(output: &std::path::Path) -> std::io::Result<()> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let mut executable = std::fs::File::open(output.join("OptiGods.Sensors.exe"))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 65_536];
    loop {
        let count = executable.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    std::fs::write(output.join("helper.sha256"), format!("{:x}\n", digest.finalize()))
}

#[cfg(windows)]
fn validate_bundled_scripts() {
    // Parse only: never execute registry changes on the build machine.
    let validation = r#"
$ErrorActionPreference = 'Stop'
$scripts = Get-Content -LiteralPath $env:OPTI_BUNDLE_PATH -Raw -Encoding UTF8 | ConvertFrom-Json
$required = @('CodDefenderExclusion','FiveM1650VRAMBudget','FiveM3500PerfPlan','EnableNvidiaMSIPro','DisableCoreParking','Win11ParkingCoreOverride','Win11ProcessorIdleMin','su_chrome','FiveMSteamOverlayOff','Win11Widgets','ProcSvc_cbdhsvc','ProcSvc_OneSyncSvc','ProcSvc_ApplyAll','WinTitusAdobeBlock','WinTitusEdgeRemove','WinTitusServicesManual','DirectXFiveMCacheRefresh')
if (@($scripts.PSObject.Properties).Count -ne $required.Count) { throw 'Unexpected bundled script scope' }
foreach ($id in $required) {
  $source = $scripts.PSObject.Properties[$id].Value
  if (-not $source -or -not $source.Contains('__OG_RESULT:APPLIED') -or -not $source.Contains('__OG_RESULT:SKIPPED')) {
    throw "Missing script or terminal markers: $id"
  }
  $tokens = $null
  $parseErrors = $null
  $null = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$parseErrors)
  if (@($parseErrors).Count -gt 0) {
    throw ("Windows PowerShell parse failed for " + $id + ": " + (($parseErrors | ForEach-Object { $_.Message }) -join '; '))
  }
}
Write-Output "All $($required.Count) reviewed bundled scripts parsed successfully in Windows PowerShell."
"#;
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("missing Cargo manifest directory");
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", validation])
        // PowerShell 7's inherited module path can hide Windows PowerShell's
        // built-in commands. Let Windows PowerShell initialize its own path.
        .env_remove("PSModulePath")
        .env("OPTI_BUNDLE_PATH", std::path::Path::new(&manifest).join("resources/native-tweak-scripts.json"))
        .output().expect("Windows PowerShell script validation could not start");
    assert!(output.status.success(), "Bundled scripts failed Windows PowerShell validation: {}",
        String::from_utf8_lossy(&output.stderr));
}
