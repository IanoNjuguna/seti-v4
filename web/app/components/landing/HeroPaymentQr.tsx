import { QrPlate } from '@/components/qr/QrPlate';
import { HERO_PAYMENT_URL } from './HeroPaymentQr.constants';
import { HERO_QR_COPY } from './HeroPaymentQr.copy';

/**
 * The hero's left column: a LIVE payment link, drawn as the code a merchant prints.
 *
 * It is not an illustration of a payment. The code encodes a real merchant's public
 * payment page, and scanning it opens that page in the real flow, signed out, the way a
 * customer meets a printed sticker.
 *
 * THE CODE IS THE WHOLE BLOCK. Three lines of small print used to hang under it — a
 * caption saying what scanning does, the URL printed in mono, and a warning that `ianllc`
 * is a demonstration merchant. The owner cut all three: the hero is a code and a promise,
 * and a paragraph under the object competes with both. Nothing replaced them and nothing
 * was moved into the right column, because there was nothing true to put there that the
 * picture does not already say.
 *
 * What that costs, recorded here rather than left in a diff: the page no longer tells a
 * visitor that `ianllc` is a demonstration merchant, which was the one sentence on it
 * aimed at a stranger about to pay a demo. The code still opens a real payment page, and
 * its accessible name still says whose it is (`HeroPaymentQr.copy.ts`).
 *
 * IT IS THE APP'S OWN CODE, in the tone this band needs. This used to draw
 * `react-qr-code` black-on-white at level `M` with no mark, which meant the landing page
 * showed a different object from the one `components/qr/QrPlate.tsx` puts on the receive
 * and merchant surfaces. It draws that code now: the Seti mark cut into the well, level
 * `H`, the four-module quiet zone inside the SVG, no plate of its own. The contrast, the
 * well's share of the symbol and the quiet zone are the arithmetic `qr.constants.ts`
 * records and `npm run check:qr-plate` measures.
 *
 * NO WHITE CARD, AND THE INK IS INVERTED. A white plate in the middle of a black band is
 * the loudest object on the page — louder than the promise it is there to serve — so the
 * hero holds the `dark` tone: white modules straight on the band, the white mark with its
 * eyes punched through, and no field of its own. What a reader sees around the code is
 * the page, and the four modules of quiet zone are the page showing through the cut, not
 * a margin somebody chose. It is the same symbol as the sticker a merchant prints, which
 * is the point; the sticker keeps ink on white because paper is white.
 *
 * It is FLUSH LEFT in its column, at one size everywhere: 18rem, capped by the column it
 * is in (`maxWidth: 100%`). That is 285px beside the words at `xl`, where the code owns
 * one grid column of three, and 288px under them below `xl`, where the band stacks — so
 * the object is the same physical size whether it is beside the promise or under it, and
 * no magic number has to match the grid. A fixed 22rem overflowed the three-column track
 * and left a sliver of white on the page's own right edge (#288). The plate carries the
 * hero slot's slow float (`hero-float`), which moves it ±3px about its place; the modules
 * themselves stay square, because a rounded module is a broken module.
 *
 * It is a SERVER component: the plate is the client boundary, because it registers itself
 * for the PNG export and an export is a browser operation. The code still server-renders
 * into the static HTML, so the code, and the exact value it carries, is in the page a
 * crawler or a JS-disabled browser receives.
 */
export function HeroPaymentQr() {
  return (
    <QrPlate
      value={HERO_PAYMENT_URL}
      title={HERO_QR_COPY.title}
      align="start"
      width="18rem"
      tone="dark"
      className="hero-float"
    />
  );
}
