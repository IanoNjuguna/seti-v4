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
 * THE EXACT STRING THE QR ENCODES — one constant, and the only place the URL exists.
 *
 * It used to be printed in mono under the code as well, so a person who could not scan
 * could type it. That line is gone with the rest of the small print under the code
 * (#266), so this constant now has exactly one reader: the symbol. Built from
 * `lib/site.ts`, never `window.location`: the page is prerendered, and a code carrying
 * the host that served a preview build would be wrong everywhere else it is displayed.
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
 * the landing page names its network, and since #266 nothing on it says the merchant is
 * a demonstration either. Unset used to mean practice, mirroring
 * `lib/chain/chain.constants.ts`, which is where the chain is still read; the
 * mainnet id was mirrored rather than imported because that module THROWS at
 * import time when the token env vars are unset, and a marketing page must not
 * fail a build over the app's chain config. Flagged in the report — the fix is a
 * page-level statement of the network, not a private flag in the hero.
 */

/**
 * The code's colours and its error-correction level are NOT set here any more.
 *
 * They were a local block (`HERO_QR`, literal black on white at level `M`) while the
 * hero drew its own `react-qr-code`. The hero draws the app's plate now
 * (`components/qr/qr.constants.ts`), so the ink, the level and the quiet zone are that
 * module's to state once — and the mark sitting in the middle of the symbol is why the
 * level is `H` rather than `M`.
 */
