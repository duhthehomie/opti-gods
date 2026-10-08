fn main() {
    println!("cargo:rerun-if-changed=app.manifest");
    println!("cargo:rerun-if-changed=resources/native-tweak-scripts.json");
    #[cfg(windows)]
    validate_bundled_scripts();

    let windows = tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest"));
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}

#[cfg(windows)]
fn validate_bundled_scripts() {
    // Parse only: never execute registry changes on the build machine.
    let validation = r#"
$ErrorActionPreference = 'Stop'
$scripts = Get-Content -LiteralPath $env:OPTI_BUNDLE_PATH -Raw -Encoding UTF8 | ConvertFrom-Json
$required = @('CodDefenderExclusion','FiveM1650VRAMBudget','FiveM3500PerfPlan','EnableNvidiaMSIPro')
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
Write-Output 'All four reviewed bundled scripts parsed successfully in Windows PowerShell.'
"#;
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("missing Cargo manifest directory");
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", validation])
        .env("OPTI_BUNDLE_PATH", std::path::Path::new(&manifest).join("resources/native-tweak-scripts.json"))
        .output().expect("Windows PowerShell script validation could not start");
    assert!(output.status.success(), "Bundled scripts failed Windows PowerShell validation: {}",
        String::from_utf8_lossy(&output.stderr));
}
