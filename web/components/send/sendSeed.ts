/**
 * What `/app/send`'s URL is allowed to seed (#99, #447).
 *
 * Two things, and both are about WHO, never about HOW MUCH: the payee a link names, and the claim a
 * link settles. The amount is still the only thing left to type.
 *
 * The AMOUNT is deliberately not here, and this function is why that is structural rather than a
 * convention: `?amount=` on a send link is dropped by this whitelist, so no URL (a retry link, a repeat
 * link, a shared link somebody edited) can put a figure into the amount field that the customer did not
 * choose. The issue's rule is "never prefill an amount the user did not choose", and a field the URL
 * cannot reach is a field that cannot be prefilled by one.
 *
 * `claim` does not weaken that rule. It is an opaque id, not a figure: the number a claim states lives
 * in a row the SERVER reads, together with whether it is still payable and who is paid. A link can name
 * a claim; only the claim can name an amount.
 */
export interface SendSeed {
  /** The recipient named by the link, verbatim, or null when it named none. */
  linked: string | null;
  /** The claim this link settles, when the link carries one. An id, never a figure. */
  claim: string | null;
}

/**
 * Read the seed from the live query.
 *
 * `to` is the current parameter and `handle` is the old pay link's spelling; both still resolve. A blank
 * value is null rather than an empty string, so a link that names nobody is a link that names nobody,
 * and the flow asks its question instead of mounting an amount step for a recipient that is not there.
 *
 * `claim` is checked as a SHAPE only, because whether it names a payable claim is the server's answer
 * and a second opinion here would be a second rule.
 */
export function sendSeed(params: URLSearchParams): SendSeed {
  const named = params.get('to') ?? params.get('handle');
  const linked = named?.trim();
  const claim = params.get('claim')?.trim();

  return {
    linked: linked ? linked : null,
    claim: claim && /^[0-9a-f]{6,32}$/i.test(claim) ? claim : null,
  };
}
