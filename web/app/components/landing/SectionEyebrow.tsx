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
 *
 * IT CAN BE THE BAND'S HEADING (`as="h2"`), and that is what it is on the three bands
 * whose display heading was deleted (#288). `SectionHeader` asks for that when it is
 * given no title: the marker is the only name the band has left, so it carries the h2
 * rather than leaving the band with no heading at all in the outline. The class list is
 * identical either way — this is a change of ELEMENT, not of type, so the render is
 * unchanged and only a screen reader and a crawler can tell.
 */
export function SectionEyebrow({ label, onDark = false, as: Tag = 'p' }: SectionEyebrowProps) {
  return (
    <Tag className="flex items-center gap-3 text-caption font-semibold uppercase tracking-widest">
      <span aria-hidden className={cn('h-px w-6', onDark ? 'bg-hairline-dark' : 'bg-faint')} />
      <span className={onDark ? 'text-on-dark-mute' : 'text-mute'}>{label}</span>
    </Tag>
  );
}
