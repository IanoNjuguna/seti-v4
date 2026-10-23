'use client';

import { QRCode } from '@/components/merchant/qr-code';
import { HERO_PAYMENT_URL, HERO_QR } from './HeroPaymentQr.constants';
import { HERO_QR_COPY } from './HeroPaymentQr.copy';

/**
 * The hero's centre column: a LIVE payment link, as a code you can scan.
 *
 * It is not an illustration of a payment. The code encodes a real merchant's
 * public payment page, and scanning it opens that page in the real flow, signed
 * out, the way a customer meets a printed sticker. That is also why it is the
 * right object for the middle of the band: cash.app puts its product screen
 * there, and the honest equivalent for this product is the thing a customer
 * actually meets, at the size they meet it.
 *
 * THE OBJECT OF THE COMPOSITION, so it is centred in its own column and it is the
 * column that sets the band's height. It used to be the taller of two halves,
 * centred on its column's middle; the difference now is that the two text columns
 * beside it sit at its FOOT (`md:items-end` in `HeroSection`) rather than at their
 * own middles, so the code rises above them the way the reference's phone does.
 *
 * THREE BLOCKS, NOT FOUR: the plate, the caption, the link with its warning under
 * it. Each one is directly under the thing it is about, and the gaps say which is
 * which — `gap-6` between blocks, `gap-3` between the link and the warning,
 * because the warning qualifies the link and nothing may come between them.
 *
 * WHY A QR: a stock object at the page's loudest surface is a claim nobody can
 * check. This is one they can. It is drawn as vector (`react-qr-code`, already a
 * dependency of the receipt and merchant surfaces), never a committed raster QR: a
 * few hundred pixels of raster would be visibly soft at 198px, and vector stays
 * exact at any size or zoom.
 *
 * THE LINK IS PRINTED, NOT COPYABLE, and that is the owner's call after seeing a
 * control there. The URL stays printed in mono because the picture has to be
 * readable by a person who cannot scan it. The handle is written bare (`ianllc`),
 * no `@`, as everywhere else in the hero.
 *
 * THE WARNING IS THE LAST LINE, and it is the one sentence on the page that stops
 * a visitor paying a demonstration merchant. `text-caption` against the caption's
 * `body-sm` — one step down the scale, and the doc's own size for a disclosure —
 * in `font-semibold`, so it is subordinate in size and emphatic in weight rather
 * than competing with the sentence above it. `text-stone` on this canvas measures
 * 6.99:1 against `{colors.canvas-dark}`; the field's corner washes are gone
 * (`LandingBackdrop`), so the black behind this line is the only surface it ever
 * meets. No `Disclaimer:` label: the sentence already says what it is.
 *
 * THE PLATE, at four-fifths of the column. A QR is read as dark modules on a light
 * field, so it sits on a real `canvas-light` surface at the ONE control/surface
 * radius, `rounded-md` (12px), with `p-10` of padding doing two jobs: the plate's
 * internal padding, and the code's quiet zone. The spec wants FOUR modules of clean
 * field, and the shipped payload is a 25-module (version 2) code: 40px of padding
 * around a 240px code is 4.17 modules, which is the padding this size requires —
 * the earlier 32px was four modules around a 198px code, and scaling the plate up
 * without scaling the padding would have quietly spent the quiet zone (the same
 * trap `components/qr/qr.constants.ts` records for the receive plate). The plate
 * carries the slot's slow float (`--duration-float`), which moves it ±3px about
 * its own place; the QR's own modules stay square, because a rounded module is a
 * broken module.
 *
 * THE PLATE GREW because the caption under it was breaking mid-sentence: at 262px
 * the figure wrapped "to ianllc" onto a line of its own and put the URL and the
 * warning in the same narrow gutter, so the centre column read as three columns of
 * small print. At 320px each of the three blocks is a line or two at its natural
 * width, and the code is closer to the share of the band the reference's object
 * takes (437px of a 1344px band; this is 320 of 1152, and the code inside it is
 * 240px — bigger than the 198 it was).
 *
 * `'use client'` because `react-qr-code` is a CLASS component and RSC renders only
 * functions. It still server-renders into the static HTML, so the code, and the
 * exact value it carries, is in the page a crawler or a JS-disabled browser
 * receives.
 */
export function HeroPaymentQr() {
  return (
    <figure className="mx-auto flex w-[min(20rem,100%)] flex-col gap-6">
      <div className="hero-float rounded-md bg-canvas-light p-10">
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

      <figcaption className="text-body-sm text-on-dark-mute">
        <span className="block font-semibold text-on-dark">{HERO_QR_COPY.lead}</span>
      </figcaption>

      <div className="flex flex-col gap-3 text-body-sm text-on-dark-mute">
        <span className="break-all font-mono text-caption">{HERO_PAYMENT_URL}</span>
        <span className="text-caption font-semibold text-stone">{HERO_QR_COPY.disclaimer}</span>
      </div>
    </figure>
  );
}
