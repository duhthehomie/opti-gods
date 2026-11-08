//! PresentMon CSV interpretation, independent of Windows for regression tests.
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

pub fn csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut chars = line.trim().chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' if quoted && chars.peek() == Some(&'"') => { field.push('"'); chars.next(); }
            '"' => quoted = !quoted,
            ',' if !quoted => fields.push(std::mem::take(&mut field)),
            _ => field.push(c),
        }
    }
    fields.push(field);
    fields
}

#[derive(Default)]
pub struct FrameWindow {
    columns: Vec<String>,
    // Separate swap chains: summing a launcher/overlay's frames inflates FPS.
    chains: HashMap<(u32, String), VecDeque<(Instant, f64)>>,
}

impl FrameWindow {
    pub fn ingest(&mut self, line: &str) {
        let row = csv_fields(line);
        if row.first().map(String::as_str) == Some("Application") {
            self.columns = row;
            return;
        }
        let column = |name: &str| self.columns.iter().position(|v| v == name).and_then(|i| row.get(i));
        let Some(pid) = column("ProcessID").and_then(|v| v.parse::<u32>().ok()) else { return };
        let Some(ms) = column("MsBetweenPresents").and_then(|v| v.parse::<f64>().ok()) else { return };
        if !ms.is_finite() || ms <= 0.0 || ms > 10000.0 { return; }
        let key = (pid, column("SwapChainAddress").cloned().unwrap_or_default());
        let now = Instant::now();
        // Bound process/swap-chain churn, as well as samples within each chain.
        self.chains.retain(|_, q| q.back().map(|(t, _)| now.duration_since(*t) < Duration::from_secs(3)).unwrap_or(false));
        if !self.chains.contains_key(&key) && self.chains.len() >= 32 { return; }
        let queue = self.chains.entry(key).or_default();
        queue.push_back((now, ms));
        while queue.len() > 4096 || queue.front().map(|(t, _)| now.duration_since(*t) > Duration::from_secs(2)).unwrap_or(false) {
            queue.pop_front();
        }
    }

    pub fn reading(&self, pid: u32) -> Option<(f64, f64)> {
        let now = Instant::now();
        let rows: Vec<_> = self.chains.iter().filter(|((p, _), _)| *p == pid).map(|(_, q)| {
            q.iter().filter(|(t, _)| now.duration_since(*t) < Duration::from_secs(2)).collect::<Vec<_>>()
        }).filter(|q| q.len() >= 2).max_by_key(|q| q.len())?;
        let mean = rows.iter().map(|(_, ms)| ms).sum::<f64>() / rows.len() as f64;
        Some((1000.0 / mean, mean))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn separates_processes_and_swapchains() {
        let mut w = FrameWindow::default();
        w.ingest("Application,ProcessID,SwapChainAddress,MsBetweenPresents");
        for _ in 0..10 { w.ingest("\"FiveM_b3889_GTAProcess.exe\",42,0xa,10"); }
        for _ in 0..3 { w.ingest("FiveM.exe,42,0xb,2"); }
        w.ingest("other.exe,99,0xc,1");
        assert_eq!(w.reading(42), Some((100.0, 10.0)));
        assert_eq!(w.reading(100), None);
    }
    #[test]
    fn rejects_missing_and_invalid_measurements() {
        let mut w = FrameWindow::default();
        w.ingest("Application,ProcessID,MsBetweenPresents");
        for value in ["0", "-1", "NaN", "NA", "inf"] { w.ingest(&format!("FiveM.exe,42,{value}")); }
        assert_eq!(w.reading(42), None);
        assert_eq!(csv_fields("\"a,b\",42,\"x\"\"y\""), vec!["a,b", "42", "x\"y"]);
    }
}
