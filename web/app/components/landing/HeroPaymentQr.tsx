'use client';

import { QRCode } from '@/components/merchant/qr-code';
import { HERO_PAYMENT_URL, HERO_QR } from './HeroPaymentQr.constants';
import { HERO_QR_COPY } from './HeroPaymentQr.copy';

/**
 * The hero's right half: a LIVE payment link, as a code you can scan.
 *
 * It is not an illustration of a payment. The code encodes a real merchant's
 * public payment page, and scanning it opens that page in the real flow, signed
 * out, the way a customer meets a printed sticker.
 *
 * IT IS THE BAND'S TALLER HALF, AND IT DRIVES THE BAND, centred on its own middle:
 * the plate, the caption, and the link with the warning under it are one group on
 * the column's axis (`md:content-center`, matching the copy half beside it). The
 * two halves are one height, so this half — the taller — has no slack to place and
 * sits at its own content's pace, while the copy half centres inside the height
 * this one sets. Both centres therefore fall on the same line. (The half used to
 * distribute its three blocks between its top and bottom edges; on the taller half
 * that was already a no-op and it is written as centring so the two halves are the
 * same statement.) The plate's band cannot be an equal third of the column and
 * never was: 262px of plate against a 396.6px band is more than a third, and
 * shrinking the code to force equal thirds would trade a working QR for a diagram.
 *
 * THREE BLOCKS, NOT FOUR. The caption under the plate used to carry a second
 * sentence naming the merchant and describing what the code does — "ianllc accepts
 * payments on Seti. You scan the QR code or use the link below to send them
 * money." It described what the reader can already see: the plate above it is
 * visibly a code, and the URL below it is visibly the link. The owner deleted it,
 * so the half reads: the caption, the link, the warning. Nothing replaced it — a
 * shorter sentence would be the same redundancy at a smaller size.
 *
 * WHY A QR: the hero is the page's loudest surface, and a stock object there is a
 * claim nobody can check. This is one they can. It is drawn as vector
 * (`react-qr-code`, already a dependency of the receipt and merchant surfaces),
 * never a committed raster QR: a few hundred pixels of raster would be visibly
 * soft at 198px, and vector stays exact at any size or zoom. The raster one this
 * replaced has been deleted from `public/`, and so has the script that made it.
 *
 * WHAT IT SAYS is the owner's wording verbatim (`HeroPaymentQr.copy.ts`). The
 * caption now names the merchant once, in the sentence that stayed. Note what the
 * page no longer does anywhere: name its network. The plan was for the deleted
 * second sentence to say so, so a testnet page could never read as a real-money
 * claim; that guarantee is now enforced by nothing, and the closing band's testnet
 * line has been deleted too. Flagged in the report, not silently re-added.
 *
 * THE LINK IS PRINTED, NOT COPYABLE, and that is the owner's call after seeing a
 * control there. It was briefly the app's own `CopyRow` (the row the receive
 * halves and Profile use); the control came off again, so this is a plain span
 * with nothing left behind where the button stood — no button, no wrapper of its
 * own, no spacing that belonged to it. The URL stays printed in mono because the
 * picture has to be readable by a person who cannot scan it, and it stays one line
 * of the caption's own type rather than a row. The handle is written bare
 * (`ianllc`), no `@`, as everywhere else in the hero.
 *
 * THE WARNING IS THE LAST LINE, directly under the link, and it is the one
 * sentence on the page that stops a visitor paying a demonstration merchant. It
 * sits below the link because that is the thing it is about: a reader who follows
 * the URL to the end meets the sentence that says do not. It is `text-caption`
 * against the caption's `body-sm` — one step down the scale, and the doc's own
 * size for a disclosure — and `font-semibold`, so it is subordinate in size and
 * emphatic in weight rather than competing with the sentence above it. `text-stone`
 * on this canvas measures 6.99:1 against `{colors.canvas-dark}` — the field's corner
 * washes are gone (`LandingBackdrop`), so the black behind this line is now the only
 * surface it ever meets, and the 5.62:1 reading taken against the field's lightest
 * lift no longer exists. The surface it shares with the page's grain measures 6.08:1
 * on the grain's mean tile and 4.70:1 at its brightest pixels (sampled in the render
 * at 1280x720), which is still AA at this size and weight — and 13px/600 is the
 * shape the doc gives a disclosure. No `Disclaimer:` label: the sentence already
 * says what it is.
 *
 * THE PLATE, at three-quarters. A QR is read as dark modules on a light field, so
 * it sits on a real `canvas-light` surface at the ONE control/surface radius,
 * `rounded-md` (12px), with `p-8` of padding doing two jobs: the slot's internal
 * padding, and the code's quiet zone. The spec wants FOUR modules of clean field,
 * and the shipped payload is a 25-module (version 2) code, so that is 16% of the
 * code's own width — and 32px around a 198px code is exactly 16%, measured in the
 * render rather than assumed. The plate was 22rem with `p-9`/`md:p-11`, which put
 * 264px of code on a desktop and made the hero taller than a laptop's fold; it is
 * now 16.375rem so the code renders at 0.75× of that, 198px, at every width the
 * column allows. 198px of a 25-module code is 7.9px per module — a phone camera
 * resolves that comfortably. The plate carries the slot's slow float
 * (`--duration-float`), which moves it ±3px about its own place and is why the
 * measured centre of this half carries that much tolerance; the QR's own modules
 * stay square, because a rounded module is a broken module.
 *
 * `'use client'` because `react-qr-code` is a CLASS component and RSC renders
 * only functions. It still server-renders into the static HTML, so the code — and
 * the exact value it carries — is in the page a crawler or a JS-disabled browser
 * receives. The label is on the code, not the figure: `role="img"` plus the SVG's
 * own `<title>`, so the caption beside it stays readable as text.
 */
export function HeroPaymentQr() {
  return (
    <figure className="flex flex-col items-center gap-6 md:grid md:content-center md:items-stretch md:gap-y-6">
      <div className="hero-float w-[min(16.375rem,100%)] self-start rounded-md bg-canvas-light p-8">
        <div role="img" aria-label={HERO_QR_COPY.title}>
          <QRCode
            value={HERO_PAYMENT_URL}
            size={HERO_QR.size}
            level={HERO_QR.level}
            fgColor={HERO_QR.foreground}
            bgColor={HERO_QR.background}
            title={HERO_QR_COPY.title}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>

      <figcaption className="max-w-sm self-center text-body-sm text-on-dark-mute">
        <span className="block font-semibold text-on-dark">{HERO_QR_COPY.lead}</span>
      </figcaption>

      {/* The link, and the warning under it. One band, two lines: the warning
          qualifies the link and nothing may come between them, which is why the
          `gap-3` here is tighter than the `gap-y-6` between bands. */}
      <div className="flex max-w-sm flex-col gap-3 self-end text-body-sm text-on-dark-mute">
        <span className="break-all font-mono text-caption">{HERO_PAYMENT_URL}</span>
        <span className="text-caption font-semibold text-stone">{HERO_QR_COPY.disclaimer}</span>
      </div>
    </figure>
  );
}
