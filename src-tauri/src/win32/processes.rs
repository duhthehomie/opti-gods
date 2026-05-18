// Process enumeration + priority/affinity overrides used by the
// ProBalance replacement (`commands::process_lasso`).

use anyhow::{Context, Result};
use std::collections::HashSet;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    GetCurrentProcessId, OpenProcess, SetPriorityClass, SetProcessAffinityMask,
    BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS, PROCESS_MODE_BACKGROUND_BEGIN,
    PROCESS_QUERY_INFORMATION, PROCESS_SET_INFORMATION,
};

// Per-game ProBalance rule. The renderer can override defaults via
// `commands::process_lasso::set_rules`. Keeps the priority class, the
// affinity mask (None = all cores), and the IO priority hint together so
// `apply_pro_balance` doesn't have to special-case anything per game.
#[derive(Clone, Debug)]
pub struct ProBalanceRule {
    pub exe: String,
    pub priority: PriorityHint,
    pub affinity: Option<usize>,
    pub io_priority: IoPriorityHint,
}

#[derive(Copy, Clone, Debug)]
pub enum PriorityHint {
    Idle,
    BelowNormal,
    Normal,
    AboveNormal,
    High,
}

#[derive(Copy, Clone, Debug)]
pub enum IoPriorityHint {
    VeryLow,
    Low,
    Normal,
    High,
}

// NtSetInformationProcess(ProcessIoPriority) — undocumented but stable
// since Vista. Powers the "I/O priority: Low" toggle in Task Manager and
// is exactly what Process Lasso uses to throttle background disk reads
// while a game is running. Loaded dynamically so the binary still links
// when ntdll.dll isn't on the import table at compile time.
#[allow(non_snake_case)]
unsafe fn set_io_priority(handle: HANDLE, io: IoPriorityHint) -> bool {
    use std::ffi::CString;
    use std::sync::OnceLock;
    use windows::Win32::Foundation::FARPROC;
    use windows::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};
    use windows::core::PCSTR;

    type NtSetInformationProcessFn = unsafe extern "system" fn(
        HANDLE,
        u32,        // PROCESS_INFORMATION_CLASS — ProcessIoPriority = 0x21
        *const u32, // ProcessInformation (IO_PRIORITY_HINT enum value)
        u32,        // ProcessInformationLength (4)
    ) -> i32;      // NTSTATUS — 0 on success

    static CACHED: OnceLock<Option<NtSetInformationProcessFn>> = OnceLock::new();
    let proc = *CACHED.get_or_init(|| {
        let dll = CString::new("ntdll.dll").ok()?;
        let name = CString::new("NtSetInformationProcess").ok()?;
        let h = GetModuleHandleA(PCSTR(dll.as_ptr() as *const u8)).ok()?;
        let p: FARPROC = GetProcAddress(h, PCSTR(name.as_ptr() as *const u8));
        p.map(|f| std::mem::transmute::<_, NtSetInformationProcessFn>(f))
    });
    let Some(nt_set) = proc else { return false };
    let level: u32 = match io {
        IoPriorityHint::VeryLow => 0,
        IoPriorityHint::Low => 1,
        IoPriorityHint::Normal => 2,
        IoPriorityHint::High => 3,
    };
    nt_set(handle, 0x21, &level as *const u32, 4) == 0
}

/// Enumerates running processes and returns the first whitelisted .exe name we find.
pub fn find_running(whitelist: &[&str]) -> Option<String> {
    let names = enumerate().ok()?;
    let lower: HashSet<String> = whitelist.iter().map(|s| s.to_ascii_lowercase()).collect();
    names
        .into_iter()
        .find(|(name, _pid)| lower.contains(&name.to_ascii_lowercase()))
        .map(|(name, _)| name)
}

pub fn enumerate() -> Result<Vec<(String, u32)>> {
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .context("CreateToolhelp32Snapshot")?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut out = Vec::new();
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                // szExeFile is a fixed [u16; 260] block. Find the null terminator.
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                out.push((name, entry.th32ProcessID));
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
        Ok(out)
    }
}

/// Boosts the running game to HIGH priority, pins it to all CPU cores, and
/// demotes every other userland process to BELOW_NORMAL + background-IO
/// priority class (which also throttles disk + memory priority via
/// PROCESS_MODE_BACKGROUND_BEGIN). This is the same heuristic Process
/// Lasso's ProBalance uses — short, additive, idempotent.
pub fn apply_pro_balance(game_exe: &str, whitelist: &[&str]) -> Result<()> {
    let processes = enumerate()?;
    let lower_whitelist: HashSet<String> =
        whitelist.iter().map(|s| s.to_ascii_lowercase()).collect();
    let game_lower = game_exe.to_ascii_lowercase();
    let our_pid = unsafe { GetCurrentProcessId() };
    let core_count = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as u32;
    // Mask of every logical core — used to pin the game wide-open.
    let full_affinity: usize = if core_count >= usize::BITS as u32 {
        usize::MAX
    } else {
        (1usize << core_count) - 1
    };

    for (name, pid) in processes {
        // Skip System (4), Idle (0), our own process, and any whitelisted
        // game launcher that isn't the active game.
        if pid < 8 || pid == our_pid {
            continue;
        }
        let lower = name.to_ascii_lowercase();
        let is_active_game = lower == game_lower;
        let is_other_game = lower_whitelist.contains(&lower) && !is_active_game;
        if is_other_game {
            continue;
        }
        unsafe {
            let handle: HANDLE = match OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_SET_INFORMATION,
                false,
                pid,
            ) {
                Ok(h) => h,
                Err(_) => continue, // protected / system process, skip silently
            };
            if is_active_game {
                // Boost the game: HIGH priority + every available core +
                // High IO priority so disk reads aren't fighting background apps.
                let _ = SetPriorityClass(handle, HIGH_PRIORITY_CLASS);
                let _ = SetProcessAffinityMask(handle, full_affinity);
                let _ = set_io_priority(handle, IoPriorityHint::High);
            } else {
                // Demote every other userland process. PROCESS_MODE_BACKGROUND_BEGIN
                // sets BOTH CPU priority to IDLE *and* I/O + memory priority to
                // very-low — exactly the ProBalance behaviour. Falls back to
                // BELOW_NORMAL if BACKGROUND_BEGIN isn't accepted (e.g. on a
                // process not owned by us).
                let bg = SetPriorityClass(handle, PROCESS_MODE_BACKGROUND_BEGIN);
                if bg.is_err() {
                    let _ = SetPriorityClass(handle, BELOW_NORMAL_PRIORITY_CLASS);
                    // BACKGROUND_BEGIN wasn't accepted (e.g. cross-session
                    // process). Fall back to an explicit Low IO priority
                    // via NtSetInformationProcess so disk-heavy background
                    // apps still get throttled while the game runs.
                    let _ = set_io_priority(handle, IoPriorityHint::Low);
                }
            }
            let _ = CloseHandle(handle);
        }
    }
    Ok(())
}
