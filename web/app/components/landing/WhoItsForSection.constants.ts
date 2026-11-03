import type { WhoItsForCopy } from './WhoItsForSection.types';

/**
 * Who the product is for, in the reader's own terms.
 *
 * THIS BAND IS THE PAGE'S MISSING ANSWER, and it is the reason it sits directly under
 * `how` (see the page's own docblock for the order). Everything above it explains a
 * mechanic to somebody who has already decided the mechanic matters; a visitor from a
 * shared link arrives with a prior question (is this for a shop like mine, or for shops
 * at all) and nothing on the page named an answer until this band. It answers it by
 * naming three kinds of seller rather than by describing a market: a reader finds
 * themselves in one of the three lines or they do not.
 *
 * THE THREE ARE THE PRODUCT'S OWN CASES AND NOTHING WIDER. A counter, a link and a
 * payment that arrives from outside Kenya are the three shapes a Seti payment actually
 * takes (a printed code or a name at the counter, `seti.live/m/<handle>` sent as a link,
 * and dollars that land in the seller's own balance instead of being converted on the
 * way). The third line is the only one that talks about shillings, and it says what the
 * balance does, not what the product can convert: there is no off-ramp in v1 and the
 * FAQ says so in as many words.
 *
 * THE COPY IS THE OWNER'S, REPRODUCED. Short sentences, second person, "dollars" and
 * never "stablecoins". Do not reword a line to make it scan better; if a line needs to
 * change it comes back dictated.
 */
export const WHO_ITS_FOR_COPY: WhoItsForCopy = {
  eyebrow: 'Who it is for',
  heading: 'Three kinds of seller.',
  items: [
    {
      title: 'Shops and traders',
      body: 'A customer at the counter pays by your name or your code, and the dollars land in your balance.',
    },
    {
      title: 'Online sellers',
      body: 'Send one link. The buyer pays from their own balance, wherever they are.',
    },
    {
      title: 'Paid from abroad',
      body: 'You want the money to stay in dollars instead of being turned into shillings on the way.',
    },
  ],
};
