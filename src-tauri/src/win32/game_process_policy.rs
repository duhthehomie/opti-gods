/// FiveM uses versioned game executables; launchers are not the game workload.
pub fn is_protected_game_family(name: &str, whitelist: &[&str]) -> bool {
    let lower = name.to_ascii_lowercase();
    whitelist.iter().any(|candidate| candidate.eq_ignore_ascii_case(name))
        || lower == "fivem.exe"
        || (lower.starts_with("fivem_") && lower.ends_with(".exe"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn versioned_fivem_and_helpers_are_never_background_targets() {
        for name in ["FiveM_b3258_GTAProcess.exe", "FiveM_b3407_GTAProcess.exe",
            "FiveM_GTAProcess.exe", "FIVEM.EXE", "FiveM_ChromeBrowser.exe", "FiveM_ROSLauncher.exe"] {
            assert!(is_protected_game_family(name, &[]), "{name}");
        }
    }
    #[test]
    fn respects_other_games_without_treating_every_process_as_a_game() {
        assert!(is_protected_game_family("CS2.EXE", &["cs2.exe"]));
        assert!(!is_protected_game_family("chrome.exe", &["cs2.exe"]));
    }
}
