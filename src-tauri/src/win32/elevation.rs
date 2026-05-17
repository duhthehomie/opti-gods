// Process elevation check via the access-token integrity level.

use anyhow::{anyhow, Result};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::Security::{
    GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

pub fn is_elevated() -> Result<bool> {
    unsafe {
        let process: HANDLE = GetCurrentProcess();
        let mut token: HANDLE = HANDLE::default();
        OpenProcessToken(process, TOKEN_QUERY, &mut token)
            .map_err(|e| anyhow!("OpenProcessToken: {e}"))?;
        let mut elevation = TOKEN_ELEVATION::default();
        let mut size: u32 = 0;
        let result = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut size,
        );
        // Always release the token handle, even on the error path.
        let _ = CloseHandle(token);
        result.map_err(|e| anyhow!("GetTokenInformation: {e}"))?;
        Ok(elevation.TokenIsElevated != 0)
    }
}
