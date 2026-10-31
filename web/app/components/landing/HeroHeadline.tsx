import { HERO_COPY } from './HeroCopy.constants';

/**
 * The hero's promise: one line, set at the page's largest display step, in the band's
 * WIDE column — nine of twelve since #288, because the promise got longer and this is
 * the column that had the room.
 *
 * THE LINE IS THE REASON FOR THE BAND'S SHAPE. "Get paid in seconds." measures 772px
 * at the 80px step in Poppins 500 with the display tracking. The old seven-column half
 * is 631px, so the sentence wrapped to two lines there, and two lines of a 22-character
 * promise is a broken measure rather than emphasis. Nine columns is 820px and holds it
 * with 48px to spare. The other three columns hold the code, which was 352px wide when
 * it had a column of its own and is now 285 — the object gave the words their width,
 * which is the right way round: the promise is what a reader who cannot scan a code
 * still reads.
 *
 * It used to take a reader, because the page carried two promises. It carries one now
 * (`HeroCopy.constants.ts`).
 *
 * `text-balance` IS FOR THE PHONE ALONE, and it is a no-op everywhere the line fits. The
 * promise holds ONE line from 640px up (measured at 1440, 1280, 1200, 1100, 1024, 900,
 * 768, 640: one line at every one of them), and breaks at about 480px, where the column
 * is 327-417px and the smallest step is 48px. Left alone it breaks as "Get paid in /
 * seconds." — a one-glyph-word last line, which is the rag `SignInEntryForm` fixed the
 * same way on the front door. Balancing splits it into two near-equal lines.
 *
 * THE LEADING TRIM IS OPTICAL, AND IT IS STILL MEASURED AGAINST THE CODE. The line box
 * of a display step carries leading above the caps, so an `items-start` row would put
 * the headline's box top level with the plate and its CAP about 11px below the plate's
 * top edge — two objects that look staggered while being geometrically aligned.
 * `-0.132em` is the leading `text-display-xl` adds above the cap, so the promise's cap
 * line lands on the plate's edge. The same trim moved a centred group's optical centre
 * in an earlier version of this band; here it is doing the only job it has.
 */
export function HeroHeadline() {
  return (
    <h1 className="entrance text-balance font-brand text-display-xl font-medium text-on-dark md:-mt-[0.132em]">
      {HERO_COPY.headline}
    </h1>
  );
}
