/** Short PlayStation-style confirmation chime for major optimization actions. */
export function playOptimizationActionSound(): void {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const context = new AudioContextCtor();
    const now = context.currentTime;
    const notes = [
      { frequency: 392, start: 0, duration: 0.1 },
      { frequency: 523.25, start: 0.09, duration: 0.12 },
      { frequency: 783.99, start: 0.2, duration: 0.2 },
    ];
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.08, now + note.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.02);
    }
    window.setTimeout(() => { void context.close(); }, 600);
  } catch {
    // A blocked audio context must not block an optimization action.
  }
}