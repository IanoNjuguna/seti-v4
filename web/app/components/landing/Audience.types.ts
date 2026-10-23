/**
 * Who the landing page is speaking to.
 *
 * TWO READERS, ONE PRODUCT. A person sends dollars to a name; a business is paid
 * by its name and by the code it prints. Everything the page has in common with
 * itself — the price list, the stack, the demonstration code's warning — is the
 * same for both, so this type never forks a section. It only chooses the words
 * in the places where the two readers genuinely differ:
 *
 *   1. the hero's promise, its sentence and its action,
 *   2. how somebody else's money reaches them (a username and a link, or a
 *      business name and a printable counter code),
 *   3. what the dollars are FOR,
 *   4. the closing action.
 *
 * The value is NEVER inferred from a device, a clock or a default the browser
 * disagrees with. It comes from the URL (`?for=`), which is why a choice
 * survives a reload and can be sent to somebody — see `Audience.constants.ts`.
 */
export type Audience = 'personal' | 'business';

/**
 * A value per audience, keyed by the union itself.
 *
 * Every band's copy file is one of these, which is what makes a missing variant a
 * type error rather than a page that renders nothing for one reader. Written once
 * so the key set cannot be re-typed as `Record<'personal' | 'business', …>` in one
 * place and `Record<string, …>` in another.
 */
export type ByAudience<T> = Record<Audience, T>;


/**
 * The prop every band that changes with the reader takes.
 *
 * One named shape rather than a bare `audience: Audience` on each component, so
 * a new band cannot invent a second spelling of it (or take `for` as a prop
 * name, which is a reserved word in a loop and reads badly in JSX).
 */
export interface AudienceProps {
  /** Which reader this render is for. Resolved once, by the page. */
  audience: Audience;
}

/** One segment of the navbar's selector. */
export interface AudienceOption {
  value: Audience;
  /** What the segment says. The reader's own word for themselves. */
  label: string;
}

/** Props of the navbar's Personal | Business control. */
export interface AudienceSelectorProps {
  /** The reader the page is currently rendering for. Marks the active segment. */
  audience: Audience;
  /**
   * Renders taller segments for the phone menu, where the control is the only
   * way to switch and a thumb is doing the pressing.
   */
  large?: boolean;
}
