pub fn allowed(filename: &str) -> bool {
    (filename.starts_with("OptiGods-V5-Tweak-Run-")
        || filename.starts_with("OptiGods-Windows-Repair-Diagnostics-"))
        && filename.ends_with(".txt")
        && filename.len() <= 180
        && !filename.contains("..")
        && filename.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.')
        })
}

#[cfg(test)]
mod tests {
    use super::allowed;

    #[test]
    fn accepts_both_support_report_types() {
        assert!(allowed("OptiGods-Windows-Repair-Diagnostics-2026-10-12T20-30-00-000Z.txt"));
        assert!(allowed("OptiGods-V5-Tweak-Run-2026-10-12T20-30-00-000Z.txt"));
    }

    #[test]
    fn rejects_paths_and_non_report_files() {
        for filename in [
            "../OptiGods-Windows-Repair-Diagnostics-test.txt",
            "C:\\OptiGods-Windows-Repair-Diagnostics-test.txt",
            "OptiGods-Windows-Repair-Diagnostics-..txt",
            "OptiGods-Windows-Repair-Diagnostics-test.txt:stream",
            "OptiGods-Windows-Repair-Diagnostics-test.exe",
            "unrelated.txt",
        ] {
            assert!(!allowed(filename), "Unexpectedly accepted {filename}");
        }
    }
}
