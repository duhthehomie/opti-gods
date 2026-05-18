fn main() {
    #[cfg(windows)]
    {
        // Embed app.manifest using MSVC linker directives so the .exe requests
        // requireAdministrator UAC + PerMonitorV2 DPI at launch.
        // We deliberately avoid winresource here — it auto-injects a VERSIONINFO
        // resource from Cargo.toml which duplicates the one tauri-build already
        // emits, causing fatal linker error LNK1123.
        let manifest = std::fs::canonicalize("app.manifest")
            .expect("src-tauri/app.manifest not found");
        println!("cargo:rustc-link-arg-bins=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg-bins=/MANIFESTINPUT:{}", manifest.display());
    }

    tauri_build::build()
}
