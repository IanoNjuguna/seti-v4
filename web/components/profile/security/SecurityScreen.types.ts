import type { SIGN_IN_METHOD_COPY } from './SecurityScreen.constants';

export type SignInMethodKey = keyof typeof SIGN_IN_METHOD_COPY;

/**
 * What the screen knows, in one object.
 *
 * `signIn` is a KEY rather than a finished sentence so the copy stays in the constants
 * file; `methodCount` is derived from the account itself, never from a stored flag,
 * because a flag can disagree with the account it describes.
 */
export interface UseSecurityReturn {
  signIn: SignInMethodKey;
  methodCount: number;
  hasSecondFactor: boolean;
}
