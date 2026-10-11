//! Failure reporting only. This must never infer success from console text.
pub fn failure_details(stderr: &[String], stdout: &[String], exit_code: Option<i32>) -> String {
    let visible = |line: &&String| !line.contains("__OG_RESULT:");
    let errors = stderr.iter().filter(visible).rev().take(3).collect::<Vec<_>>();
    let output = stdout.iter().filter(visible).rev().take(3).collect::<Vec<_>>();
    let errors = errors.into_iter().rev().map(String::as_str).collect::<Vec<_>>().join(" ");
    let output = output.into_iter().rev().map(String::as_str).collect::<Vec<_>>().join(" ");
    let status = exit_code.map(|code| code.to_string()).unwrap_or_else(|| "unavailable".into());
    let mut details = format!("PowerShell exit code: {status}.");
    if !errors.is_empty() { details.push_str(&format!(" Error output: {errors}")); }
    if !output.is_empty() { details.push_str(&format!(" Last output: {output}")); }
    details
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn success_looking_stdout_does_not_hide_stderr() {
        let detail = failure_details(
            &lines(&["[ERROR] Access denied"]),
            &lines(&["first", "second", "third", "[OK] finished", "__OG_RESULT:FAILED"]),
            Some(1),
        );
        assert!(detail.contains("Error output: [ERROR] Access denied"));
        assert!(detail.contains("[OK] finished"));
        assert!(detail.contains("exit code: 1"));
        assert!(!detail.contains("__OG_RESULT:"));
    }

    #[test]
    fn both_streams_are_bounded_and_keep_their_latest_lines() {
        let detail = failure_details(
            &lines(&["old-error", "e2", "e3", "e4"]),
            &lines(&["old-output", "o2", "o3", "o4"]),
            Some(5),
        );
        assert!(!detail.contains("old-error"));
        assert!(!detail.contains("old-output"));
        assert!(detail.contains("e2 e3 e4"));
        assert!(detail.contains("o2 o3 o4"));
    }

    #[test]
    fn zero_exit_without_a_marker_remains_actionable() {
        assert_eq!(failure_details(&[], &[], Some(0)), "PowerShell exit code: 0.");
    }

    #[test]
    fn missing_exit_code_is_not_reported_as_zero() {
        assert_eq!(failure_details(&[], &[], None), "PowerShell exit code: unavailable.");
    }
}
