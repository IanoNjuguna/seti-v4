import { QrPlate } from '@/components/qr/QrPlate';
import { HERO_PAYMENT_URL } from './HeroPaymentQr.constants';
import { HERO_QR_COPY } from './HeroPaymentQr.copy';

/**
 * The hero's left column: a LIVE payment link, drawn as the code a merchant prints.
 *
 * It is not an illustration of a payment. The code encodes a real merchant's public
 * payment page, and scanning it opens that page in the real flow, signed out, the way
 * a customer meets a printed sticker.
 *
 * IT IS THE APP'S OWN CODE, in the tone this band needs. This used to draw
 * `react-qr-code` black-on-white at level `M` with no mark, which meant the landing page
 * showed a different object from the one `components/qr/QrPlate.tsx` puts on the receive
 * and merchant surfaces. It draws that code now: the Seti mark cut into the well, level
 * `H`, the four-module quiet zone inside the SVG, no padding of the plate's own. The
 * contrast, the well's share of the symbol and the quiet zone are the arithmetic
 * `qr.constants.ts` records and `npm run check:qr-plate` measures.
 *
 * NO WHITE CARD, AND THE INK IS INVERTED. A white plate in the middle of a black band is
 * the loudest object on the page — louder than the promise it is there to serve — so the
 * hero holds the `dark` tone: white modules straight on the band, the white mark with
 * its eyes punched through, and no field of its own. What a reader sees around the code
 * is the page, and the four modules of quiet zone are the page showing through the cut,
 * not a margin somebody chose. It is the same symbol as the sticker a merchant prints,
 * which is the point; the sticker keeps ink on white because paper is white.
 *
 * Everything is FLUSH LEFT: the code shares the page's left axis with the nav's wordmark
 * and every section header below it, and the caption and URL under it are left-aligned
 * with it — a centred square above left-aligned text is the mixed edge that makes a band
 * read as two layouts. The figure carries the hero slot's slow float (`hero-float`),
 * which moves the whole block ±3px about its place; the modules themselves stay square,
 * because a rounded module is a broken module.
 *
 * THREE BLOCKS, NOT FOUR: the code, the caption, the printed URL with its warning under
 * it. Each one is directly under the thing it is about, and the gaps say which is which
 * — `gap-6` between blocks, `gap-3` between the URL and the warning, because the warning
 * qualifies the URL and nothing may come between them.
 *
 * THE LINK IS PRINTED, NOT COPYABLE, and that is the owner's call after seeing a control
 * there. The URL stays printed in mono because the picture has to be readable by a person
 * who cannot scan it. The handle is written bare (`ianllc`), no `@`, as everywhere else
 * on the page.
 *
 * THE WARNING IS THE LAST LINE, and it is the one sentence on the page that stops a
 * visitor paying a demonstration merchant. `text-caption` against the caption's
 * `body-sm` — one step down the scale, and the doc's own size for a disclosure — in
 * `font-semibold`, so it is subordinate in size and emphatic in weight rather than
 * competing with the sentence above it. `text-stone` on this canvas measures 6.99:1
 * against `{colors.canvas-dark}`. No `Disclaimer:` label: the sentence already says what
 * it is.
 *
 * It is a SERVER component: the plate is the client boundary, because it registers itself
 * for the PNG export and an export is a browser operation. The code still server-renders
 * into the static HTML, so the code, and the exact value it carries, is in the page a
 * crawler or a JS-disabled browser receives.
 */
export function HeroPaymentQr() {
  return (
    <figure className="flex flex-col items-start gap-6">
      <QrPlate
        value={HERO_PAYMENT_URL}
        title={HERO_QR_COPY.title}
        align="start"
        width="22rem"
        tone="dark"
        className="hero-float"
      />

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
