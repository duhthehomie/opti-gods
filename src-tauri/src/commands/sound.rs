// Success chime played by Windows itself.
//
// The WebView blocks Web Audio until the page receives a click. Tweak runs
// often finish on a freshly loaded Applied Tweaks page, so the browser chime
// was silently muted. PlaySoundW has no such restriction.

#[cfg(windows)]
fn chime_wav() -> &'static [u8] {
    static WAV: std::sync::OnceLock<Vec<u8>> = std::sync::OnceLock::new();
    WAV.get_or_init(|| {
        const RATE: u32 = 22_050;
        const LENGTH_S: f32 = 0.45;
        // Same three-note chime as the web version (G4, C5, G5).
        const NOTES: [(f32, f32, f32); 3] = [(392.0, 0.0, 0.10), (523.25, 0.09, 0.12), (783.99, 0.20, 0.20)];
        let total = (RATE as f32 * LENGTH_S) as usize;
        let mut samples = vec![0f32; total];
        for (frequency, start, duration) in NOTES {
            let first = (start * RATE as f32) as usize;
            let count = (duration * RATE as f32) as usize;
            for i in 0..count {
                let Some(slot) = samples.get_mut(first + i) else { break };
                let t = i as f32 / RATE as f32;
                let attack = (t / 0.01).min(1.0);
                let decay = (0.0001f32 / 0.12).powf((t - 0.01).max(0.0) / (duration - 0.01));
                let square = if (t * frequency).fract() < 0.5 { 1.0 } else { -1.0 };
                *slot += square * 0.12 * attack * decay;
            }
        }
        let data_len = (total * 2) as u32;
        let mut wav = Vec::with_capacity(44 + data_len as usize);
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&1u16.to_le_bytes()); // mono
        wav.extend_from_slice(&RATE.to_le_bytes());
        wav.extend_from_slice(&(RATE * 2).to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_len.to_le_bytes());
        for sample in samples {
            wav.extend_from_slice(&((sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16).to_le_bytes());
        }
        wav
    })
}

#[tauri::command]
pub fn play_success_sound() -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::HMODULE;
        use windows::Win32::Media::Audio::{PlaySoundW, SND_ASYNC, SND_MEMORY, SND_NODEFAULT};
        let wav = chime_wav();
        let played = unsafe {
            PlaySoundW(PCWSTR(wav.as_ptr() as *const u16), HMODULE::default(), SND_MEMORY | SND_ASYNC | SND_NODEFAULT)
        };
        if played.as_bool() { Ok(()) } else { Err("Windows could not play the success sound.".into()) }
    }
    #[cfg(not(windows))]
    { Ok(()) }
}
