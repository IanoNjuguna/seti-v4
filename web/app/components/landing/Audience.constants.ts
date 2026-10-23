import type { Audience, AudienceOption } from './Audience.types';

/**
 * The reader's choice lives in the URL, not in React state.
 *
 * `?for=business` is the ONLY way business copy is reachable: it survives a
 * reload, it can be pasted into a message, it can be bookmarked, and the server
 * renders the variant the URL names, so the first paint is already correct and
 * there is no hydration mismatch to have (nothing here reads `window` or
 * `new Date()` — the page reads this param on the server and passes the answer
 * down as a prop).
 *
 * A query parameter rather than a path segment (`/business`) because the two
 * audiences are two readings of ONE page: the sections, their ids, the ⌘K
 * palette and every anchor are shared, so a second path would be a second page
 * to keep in step. `/app/merchant` already reads `?kind=` for the same reason,
 * and it is the same shape of choice.
 */
export const AUDIENCE_QUERY_KEY = 'for';

/**
 * Personal is the default, and it is also the fallback.
 *
 * The default is the person because there are more of them and because a page
 * that says "pay by name" is true for a merchant too — a merchant reading the
 * personal page is not misled, while a customer reading the merchant page is
 * asked to take an action that is not theirs ("Get paid.").
 *
 * The fallback matters as much: `?for=`, `?for=Business`, `?for=customer` and a
 * typo all land on personal rather than on an error or on a blank page. A
 * marketing page must render something true for any URL it is handed.
 */
export const DEFAULT_AUDIENCE: Audience = 'personal';

/** The two segments, in the order they are shown. */
export const AUDIENCE_OPTIONS: readonly AudienceOption[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
];

/**
 * The control's accessible name. The segments say "Personal" and "Business" and
 * nothing says what they choose, so the group carries the question — the same
 * wording minisend.xyz uses for its own two-segment nav control.
 */
export const AUDIENCE_GROUP_LABEL = 'Choose Personal or Business';


/**
 * The URL for one audience.
 *
 * Personal is the bare path: the default does not need to be spelled in a URL a
 * merchant might print or a person might paste, and a link that omits it and
 * still lands on personal is worth more than a link that cannot rot. Business
 * carries its param, because that is the whole point of it.
 */
export function audienceHref(audience: Audience): string {
  return audience === DEFAULT_AUDIENCE
    ? '/'
    : `/?${AUDIENCE_QUERY_KEY}=${audience}`;
}

/**
 * The audience a raw query value names.
 *
 * Takes what `searchParams` actually holds: a value may be absent, a string, or
 * an array when the query repeats a key. Only the exact business value selects
 * business; everything else is the default, because guessing from a near miss is
 * how a page promises a reader something it is not showing them.
 */
export function parseAudience(
  value: string | string[] | undefined | null
): Audience {
  const first = Array.isArray(value) ? value[0] : value;
  return first === 'business' ? 'business' : DEFAULT_AUDIENCE;
}
