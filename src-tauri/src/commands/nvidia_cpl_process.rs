//! Bounded transport for the reviewed Control Panel script. Never put its
//! multiline source on the Windows command line or accept caller-owned code.
use std::io::{Read, Write};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub const BOOTSTRAP: &str = "$ErrorActionPreference='Stop'; [Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false); $source=[Console]::In.ReadToEnd(); & ([ScriptBlock]::Create($source))";
const MAX_CAPTURE_BYTES: usize = 1024 * 1024;

enum Event {
    Input(std::io::Result<()>),
    Stdout(std::io::Result<Vec<u8>>),
    Stderr(std::io::Result<Vec<u8>>),
}

fn capture(pipe: impl Read) -> std::io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    pipe.take(MAX_CAPTURE_BYTES as u64 + 1).read_to_end(&mut bytes)?;
    if bytes.len() > MAX_CAPTURE_BYTES {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Control Panel output exceeded its safety limit"));
    }
    Ok(bytes)
}

pub fn run(
    command: &mut Command,
    source: &str,
    cancelled: &AtomicBool,
    timeout: Duration,
) -> Result<Output, String> {
    if cancelled.load(Ordering::SeqCst) {
        return Err("NVIDIA Control Panel action was stopped before launch.".into());
    }
    let deadline = Instant::now() + timeout;
    let mut child = command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .spawn().map_err(|error| format!("NVIDIA Control Panel verification could not start: {error}"))?;
    let mut stdin = child.stdin.take().expect("configured stdin pipe");
    let stdout = child.stdout.take().expect("configured stdout pipe");
    let stderr = child.stderr.take().expect("configured stderr pipe");
    let bytes = source.as_bytes().to_vec();
    let (send, receive) = mpsc::channel();
    let out_send = send.clone();
    let err_send = send.clone();
    // Drain both pipes while input is being written and the child is running.
    // A full output pipe must not deadlock the writer or bypass the deadline.
    std::thread::spawn(move || { let _ = out_send.send(Event::Stdout(capture(stdout))); });
    std::thread::spawn(move || { let _ = err_send.send(Event::Stderr(capture(stderr))); });
    std::thread::spawn(move || {
        let result = stdin.write_all(&bytes);
        drop(stdin); // EOF lets the bootstrap parse the complete script once.
        let _ = send.send(Event::Input(result));
    });
    let mut input_result = None;
    let mut stdout_bytes = None;
    let mut stderr_bytes = None;
    let mut status = None;
    let result = (|| {
        loop {
            if cancelled.load(Ordering::SeqCst) || Instant::now() >= deadline {
                return Err("NVIDIA Control Panel verification was stopped or exceeded its deadline. No complete preset success was recorded.".into());
            }
            while let Ok(event) = receive.try_recv() {
                match event {
                    Event::Input(result) => input_result = Some(result),
                    Event::Stdout(result) => stdout_bytes = Some(result.map_err(|error| format!("Control Panel stdout could not be captured: {error}"))?),
                    Event::Stderr(result) => stderr_bytes = Some(result.map_err(|error| format!("Control Panel stderr could not be captured: {error}"))?),
                }
            }
            if status.is_none() { status = child.try_wait().map_err(|error| error.to_string())?; }
            if let (Some(status), Some(input), Some(stdout), Some(stderr)) =
                (status, input_result.as_ref(), stdout_bytes.as_ref(), stderr_bytes.as_ref()) {
                // Keep the actual PowerShell failure output if the child
                // rejected input or exited early. Never infer success from EOF.
                if status.success() {
                    input.as_ref().map_err(|error| format!("Control Panel script could not be delivered: {error}"))?;
                }
                return Ok(Output { status, stdout: stdout.clone(), stderr: stderr.clone() });
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    })();
    if result.is_err() {
        let _ = child.kill();
        let _ = child.wait();
    }
    result
}

#[cfg(all(test, not(windows)))]
mod tests {
    use super::*;

    fn python(code: &str) -> Command {
        let mut command = Command::new("python3");
        command.args(["-c", code]);
        command
    }

    #[test]
    fn short_bootstrap_and_large_utf8_source_round_trip() {
        assert!(BOOTSTRAP.len() < 512);
        assert!(BOOTSTRAP.contains("ReadToEnd"));
        assert!(BOOTSTRAP.contains("UTF8Encoding"));
        let source = "# NVIDIA – café ✓\n".repeat(6000);
        assert!(source.len() > 32767);
        let output = run(&mut python("import sys; sys.stdout.buffer.write(sys.stdin.buffer.read())"),
            &source, &AtomicBool::new(false), Duration::from_secs(4)).unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout, source.as_bytes());
    }

    #[test]
    fn both_output_pipes_are_drained_while_delivering_source() {
        let source = "x".repeat(200000);
        let output = run(&mut python("import sys; sys.stdout.buffer.write(b'o'*300000); sys.stdout.flush(); sys.stderr.buffer.write(b'e'*300000); sys.stderr.flush(); s=sys.stdin.buffer.read(); assert len(s)==200000"),
            &source, &AtomicBool::new(false), Duration::from_secs(4)).unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout, vec![b'o'; 300000]);
        assert_eq!(output.stderr, vec![b'e'; 300000]);
    }

    #[test]
    fn nonzero_exit_preserves_failure_diagnostics() {
        let output = run(&mut python("import sys; sys.stdin.buffer.read(); sys.stderr.write('failed readback'); sys.exit(7)"),
            "reviewed source", &AtomicBool::new(false), Duration::from_secs(4)).unwrap();
        assert_eq!(output.status.code(), Some(7));
        assert_eq!(output.stderr, b"failed readback");
    }

    #[test]
    fn deadline_covers_a_blocked_input_writer() {
        let start = Instant::now();
        let error = run(&mut python("import time; time.sleep(10)"),
            &"x".repeat(200000), &AtomicBool::new(false), Duration::from_millis(150)).unwrap_err();
        assert!(error.contains("deadline"));
        assert!(start.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn cancellation_before_launch_never_spawns() {
        let error = run(&mut Command::new("not-a-real-executable"),
            "source", &AtomicBool::new(true), Duration::from_secs(1)).unwrap_err();
        assert!(error.contains("stopped before launch"));
    }

    #[test]
    fn cancellation_during_execution_is_bounded() {
        let cancelled = std::sync::Arc::new(AtomicBool::new(false));
        let trigger = cancelled.clone();
        let worker = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            trigger.store(true, Ordering::SeqCst);
        });
        let start = Instant::now();
        let error = run(&mut python("import time; time.sleep(10)"),
            "source", &cancelled, Duration::from_secs(4)).unwrap_err();
        worker.join().unwrap();
        assert!(error.contains("stopped"));
        assert!(start.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn oversized_output_is_rejected() {
        let error = run(&mut python("import sys; sys.stdin.buffer.read(); sys.stdout.buffer.write(b'x'*1100000); sys.stdout.flush()"),
            "source", &AtomicBool::new(false), Duration::from_secs(4)).unwrap_err();
        assert!(error.contains("safety limit"));
    }
}
