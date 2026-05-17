fn main() {
    // Embed app.manifest into the final .exe so Windows reads our
    // `requireAdministrator` UAC level + PerMonitorV2 DPI awareness on
    // launch (instead of running unelevated with system DPI). Tauri 2
    // does NOT do this automatically — without these directives every
    // registry HKLM write would silently fail.
    #[cfg(windows)]
    {
        // embed_resource takes care of generating + compiling a .rc with
        // our manifest at link time. The manifest path is relative to
        // this build.rs file.
        let mut res = winresource::WindowsResource::new();
        res.set_manifest_file("app.manifest");
        res.set("FileDescription", "Opti Gods desktop client");
        res.set("ProductName", "Opti Gods");
        res.set("CompanyName", "leaq");
        res.set("LegalCopyright", "(c) 2026 leaq. All rights reserved.");
        if let Err(err) = res.compile() {
            // Don't hard-fail the non-Windows host build; the Windows CI
            // job will surface any real error.
            eprintln!("cargo:warning=winresource compile failed: {err}");
        }
    }

    tauri_build::build()
}
