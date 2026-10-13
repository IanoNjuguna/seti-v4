/**
 * The app's sound, synthesised rather than shipped.
 *
 * No audio file: an asset would be a binary nobody can review, a licensing question,
 * and a download on a slow connection, for a note that lasts 180 milliseconds. Web
 * Audio can make it exactly, and the recipe stays readable in the repo.
 *
 * The character, and why:
 *
 *  - ONE damped note, not a chime. A notification chime means "something happened
 *    elsewhere"; this sound means "this number is now yours", and belongs to the screen
 *    the customer is looking at.
 *  - A high register at low volume. High frequencies cut through a noisy room without
 *    being loud, which is what makes a tick feel considered rather than alarming.
 *  - A perfect fifth (E6 + a quiet B6). Consonant, and neither major nor minor, so the
 *    note does not editorialise — it must not sound like praise for a payment that
 *    succeeded nor an alarm for one that failed. Celebration belongs to a completed
 *    payment, not to a figure appearing, and would need its own voice.
 *  - Short attack, exponential decay. A hard attack reads as a click; the decay is what
 *    makes it sound like a struck object settling rather than a beep.
 *
 * Silenced by the mute flag, and silent wherever Web Audio is unavailable — never an
 * error, never a dependency. Nothing in any flow may require the sound to have played.
 */

/** Where the mute preference lives. Absent means "not muted". */
const MUTE_KEY = 'seti-sound-muted';

/** E6, with a fifth above it. Ratios, not magic numbers: see the file comment. */
const VOICES = {
  /**
   * A figure has settled. Brief, informational — but audible.
   *
   * The gain is the one knob for loudness and it has been tuned twice by ear: 0.09 read
   * as a whisper (peak about -19 dBFS) and 0.2 overshot on laptop speakers. Around
   * -15 dBFS is the aim — present when the figure lands, never a notification blast,
   * which is the ceiling for a sound that fires while somebody is typing.
   */
  settle: { root: 1318.51, fifth: 1975.53, seconds: 0.18, gain: 0.14 },
} as const;

export type SoundVoice = keyof typeof VOICES;

let context: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    // No storage (private mode, a locked-down browser): unmuted, but nothing is lost.
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // The preference is a nicety; failing to store it must not break the flow.
  }
}

/**
 * Plays one voice. Safe to call anywhere: unsupported, muted, or throwing all end in
 * silence rather than an error the customer would ever see.
 */
export function play(voice: SoundVoice = 'settle'): void {
  if (isMuted()) return;

  try {
    if (typeof window === 'undefined') return;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!Ctor) return;

    // Created on first use, never at import: a context built before the customer has
    // interacted is suspended by every browser's autoplay policy, and a suspended one
    // cannot be resumed outside a gesture.
    context ??= new Ctor();

    if (context.state === 'suspended') {
      // A blocked resume is fine — the note simply does not sound.
      void context.resume();
    }

    const { root, fifth, seconds, gain } = VOICES[voice];
    const now = context.currentTime;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, now);
    // 4ms attack: long enough not to click, short enough to feel immediate.
    envelope.gain.linearRampToValueAtTime(gain, now + 0.004);
    // Exponential decay to near-silence. It cannot reach zero (that is a maths error,
    // not a preference), so it lands a hair above it and the note is stopped below.
    envelope.gain.exponentialRampToValueAtTime(gain * 0.001, now + seconds);
    envelope.connect(context.destination);

    for (const [frequency, level] of [
      [root, 1],
      [fifth, 0.35],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);

      const partial = context.createGain();
      partial.gain.setValueAtTime(level, now);

      oscillator.connect(partial).connect(envelope);
      oscillator.start(now);
      oscillator.stop(now + seconds);
    }
  } catch {
    // Sound is decoration. A failure here must be invisible, not a broken payment.
  }
}
