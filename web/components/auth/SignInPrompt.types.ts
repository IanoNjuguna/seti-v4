/**
 * Which band the prompt sits on. The app has two canvases and no dark-mode
 * pair, so a control that reads on one is nearly invisible on the other —
 * `canvas-light` pages and the `canvas-dark` rail are the two that exist.
 */
export type SignInPromptSurface = 'light' | 'dark';

export interface SignInPromptProps {
  /** The page's or the card's own words — the prompt carries none of its own. */
  title: string;
  /** One sentence, second person, no jargon: what signing in is FOR. */
  body: string;
  surface?: SignInPromptSurface;
}
