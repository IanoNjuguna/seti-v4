import { cn } from '@/lib/cn';
import type { SectionEyebrowProps } from './SectionEyebrow.types';

/**
 * The section marker: a short hairline and a word, set in caption size.
 *
 * It replaces the numbered mono eyebrows the page used to carry ("01 — HELLO,
 * WORLD."). Numbering sections 01–04 is punctuation, not information — it
 * implies a sequence the page does not have — and a mono eyebrow over every
 * band is one of the clearest signatures of a generated landing page. One word
 * and a rule says the same thing and reads as a person set it.
 */
export function SectionEyebrow({ label, onDark = false }: SectionEyebrowProps) {
  return (
    <p className="flex items-center gap-3 text-caption font-semibold uppercase tracking-widest">
      <span aria-hidden className={cn('h-px w-6', onDark ? 'bg-hairline-dark' : 'bg-faint')} />
      <span className={onDark ? 'text-on-dark-mute' : 'text-mute'}>{label}</span>
    </p>
  );
}
