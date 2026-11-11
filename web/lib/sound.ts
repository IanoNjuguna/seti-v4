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
 * ## The three voices (#546)
 *
 * `settle` marks a figure arriving. The other two mark an OUTCOME, which is a different
 * sentence and so a different figure:
 *
 *  - `swapped` rises a fourth and lands on `settle`'s own dyad, so the sound a customer
 *    already knows from the quote is the last thing they hear when the swap is theirs.
 *    It is longer and a little warmer, because money moved.
 *  - `refused` falls a minor third in a low register. Falling is the whole content:
 *    nothing arrived. It is deliberately soft and short — a swap can fail for reasons
 *    that are not the customer's fault, and a loud alarm would blame them.
 *
 * Silenced by the mute flag, and silent wherever Web Audio is unavailable — never an
 * error, never a dependency. Nothing in any flow may require the sound to have played.
 */

/** Where the mute preference lives. Absent means "not muted". */
const MUTE_KEY = 'seti-sound-muted';

/**
 * One struck note inside a voice.
 *
 * `hz` is written out rather than derived from a note name: this file is read by people
 * adjusting a sound by ear, and a ratio table would be a second thing to get wrong.
 */
interface VoiceNote {
  hz: number;
  /** The note's own level, before the voice's gain. A bed note sits under the melody. */
  level: number;
  /** Seconds after the voice starts, so a two-note figure is one list. */
  at: number;
}

interface Voice {
  /** How long each note rings after it starts. */
  seconds: number;
  /** The one knob for loudness, tuned by ear. */
  gain: number;
  notes: readonly VoiceNote[];
}

/**
 * B5 987.77 · E6 1318.51 · B6 1975.53 · Eb4 311.13 · B3 246.94.
 *
 * The gains have been tuned twice by ear: 0.09 read as a whisper (peak about -19 dBFS)
 * and 0.2 overshot on laptop speakers. Around -15 dBFS is the aim — present when the
 * figure lands, never a notification blast, which is the ceiling for a sound that fires
 * while somebody is typing. A two-note figure overlaps itself, so its gain stays under
 * `settle`'s rather than matching it.
 */
const VOICES = {
  /** A figure has settled. Brief, informational — but audible. */
  settle: {
    seconds: 0.18,
    gain: 0.14,
    notes: [
      { hz: 1318.51, level: 1, at: 0 },
      { hz: 1975.53, level: 0.35, at: 0 },
    ],
  },
  /** A swap was signed, mined and recorded. Rising, and lands on `settle`'s dyad. */
  swapped: {
    seconds: 0.4,
    gain: 0.12,
    notes: [
      { hz: 987.77, level: 0.7, at: 0 },
      { hz: 1318.51, level: 1, at: 0.1 },
      { hz: 1975.53, level: 0.4, at: 0.1 },
    ],
  },
  /** A swap attempt ended without one. Falling, low, and soft. */
  refused: {
    seconds: 0.3,
    gain: 0.16,
    notes: [
      { hz: 311.13, level: 1, at: 0 },
      { hz: 246.94, level: 0.9, at: 0.09 },
    ],
  },
} as const satisfies Record<string, Voice>;

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

    const { seconds, gain, notes } = VOICES[voice];
    const now = context.currentTime;

    for (const note of notes) {
      const start = now + note.at;
      const peak = gain * note.level;

      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, start);
      // 4ms attack: long enough not to click, short enough to feel immediate.
      envelope.gain.linearRampToValueAtTime(peak, start + 0.004);
      // Exponential decay to near-silence. It cannot reach zero (that is a maths error,
      // not a preference), so it lands a hair above it and the note is stopped below.
      envelope.gain.exponentialRampToValueAtTime(peak * 0.001, start + seconds);
      envelope.connect(context.destination);

      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.hz, start);
      oscillator.connect(envelope);
      oscillator.start(start);
      oscillator.stop(start + seconds);
    }
  } catch {
    // Sound is decoration. A failure here must be invisible, not a broken payment.
  }
}
