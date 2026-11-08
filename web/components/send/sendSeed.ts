/**
 * What `/app/send`'s URL is allowed to seed (#99).
 *
 * Exactly one thing: who the money is going to. A link that names a payee saves
 * the customer a lookup, and the amount is still the only thing left to type.
 *
 * The AMOUNT is deliberately not here, and this function is why that is structural
 * rather than a convention: `?amount=` on a send link is dropped by this whitelist,
 * so no URL (a retry link, a repeat link, a shared link somebody edited) can put
 * a figure into the amount field that the customer did not choose. The issue's rule
 * is "never prefill an amount the user did not choose", and a field the URL cannot
 * reach is a field that cannot be prefilled by one.
 */
export interface SendSeed {
  /** The recipient named by the link, verbatim, or null when it named none. */
  linked: string | null;
  /**
   * The claim the link names, if it names one (#465).
   *
   * This is the ONE exception to "a link cannot seed an amount", and it is not a hole in the rule.
   * `?amount=` is dropped because a figure in a URL is a figure the customer never chose. `?claim=`
   * carries an opaque id, and the amount comes back from `GET /public/requests/:id`: a record the
   * person who is owed wrote down, which the payer can still edit before signing.
   */
  claim: string | null;
}

/**
 * Read the seed from the live query.
 *
 * `to` is the current parameter and `handle` is the old pay link's spelling; both
 * still resolve. A blank value is null rather than an empty string, so a link that
 * names nobody is a link that names nobody, and the flow asks its question instead
 * of mounting an amount step for a recipient that is not there.
 */
export function sendSeed(params: URLSearchParams): SendSeed {
  const named = params.get('to') ?? params.get('handle');
  const linked = named?.trim();
  const claim = params.get('claim')?.trim();

  return {
    linked: linked ? linked : null,
    claim: claim ? claim : null,
  };
}
