import { merchantPaymentUrl } from '@/lib/site';

/**
 * The merchant the hero's code opens, and the exact string it encodes.
 *
 * `ianllc` is a VERIFIED merchant handle, which is the whole reason it is the
 * demo: an unverified or squatted brand would put a "this is not confirmed" state
 * — or someone else's name — behind the page a visitor is invited to open.
 */
export const HERO_MERCHANT_HANDLE = 'ianllc';
export const HERO_MERCHANT_NAME = 'Ianllc';

/**
 * THE EXACT STRING THE QR ENCODES — one constant, used by the code and printed
 * under it, so the picture and the text cannot describe different URLs.
 *
 * Built from `lib/site.ts`, never `window.location`: the page is prerendered, and
 * a code carrying the host that served a preview build would be wrong everywhere
 * else it is displayed.
 */
export const HERO_PAYMENT_URL = merchantPaymentUrl(HERO_MERCHANT_HANDLE);

/**
 * Which sentence renders beside the code — and there is no longer a choice to
 * make, so the flag that made it is gone.
 *
 * `IS_PRACTICE_NETWORK` existed to switch the caption's second line between a
 * practice-network sentence and a mainnet one. The owner deleted that line (it
 * described what the reader can already see), so the flag had no reader left and
 * the two sentences went with it (`HeroPaymentQr.copy.ts`).
 *
 * What it cost, recorded here rather than quietly dropped: the plan was honesty
 * by construction — on the practice network the copy would say so, because "a real
 * payment" beside a page that moves no money is a claim the deployment cannot
 * back. With the sentence gone, that guarantee is enforced by NOTHING: nothing on
 * the landing page names its network. Unset used to mean practice, mirroring
 * `lib/chain/chain.constants.ts`, which is where the chain is still read; the
 * mainnet id was mirrored rather than imported because that module THROWS at
 * import time when the token env vars are unset, and a marketing page must not
 * fail a build over the app's chain config. Flagged in the report — the fix is a
 * page-level statement of the network, not a private flag in the hero.
 */

/**
 * The two colours a QR is READ by, and its error-correction level.
 *
 * Literal `black`/`white`, as in `components/receipt/Receipt.constants.ts`: a
 * QR's colours are a machine-readable contrast spec, not a styling choice, and a
 * brand tint on either one is what stops a code being read. The plate around it
 * IS a surface and does use tokens (`bg-canvas-light`, `rounded-md`).
 */
export const HERO_QR = {
  /**
   * The SVG's own viewBox size, and the size the code RENDERS at — CSS scales
   * the SVG to the plate, and the plate's `p-8` leaves exactly this much room
   * inside its 16.375rem. It used to be 264, which put 264px of code on a
   * desktop and left the hero taller than a laptop's fold; three-quarters of
   * that, 198px, is the same code at 7.9px per module of its 25, which a phone
   * camera resolves comfortably. Keep it in step with the plate: this number is
   * the code's real width, not a hint.
   */
  size: 198,
  level: 'M',
  foreground: 'black',
  background: 'white',
} as const;
