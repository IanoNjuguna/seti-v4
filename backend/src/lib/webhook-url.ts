/**
 * What counts as a URL we are willing to POST to.
 *
 * One rule, one place: a charge's `webhookUrl` and a merchant app's `webhookUrl` are
 * the same promise to the same kind of receiver, so a second copy of this check is a
 * second chance for one of them to accept `http://` on the public internet.
 *
 * https only, with one exception — `http://localhost` and `127.0.0.1` outside
 * production — because a local receiver is how the feature is tested and there is no
 * secret on that hop that a loopback does not already carry. In production the rule is
 * absolute: a merchant's webhook carries a txHash and an amount, and sending it in
 * clear over the public internet is not a trade this product makes.
 */
export type WebhookUrlVerdict = { kind: 'none' } | { kind: 'url'; url: string } | { kind: 'invalid' };

export function usableWebhookUrl(raw: string | undefined | null): WebhookUrlVerdict {
  if (raw === undefined || raw === null) return { kind: 'none' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'invalid' };
  }

  if (url.protocol === 'https:') return { kind: 'url', url: url.toString() };

  const loopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol === 'http:' && loopback && process.env.NODE_ENV !== 'production') {
    return { kind: 'url', url: url.toString() };
  }

  return { kind: 'invalid' };
}
