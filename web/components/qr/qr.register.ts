import type { QrRegistration } from './qr.types';

/**
 * The one place a mounted code can be found from outside its own subtree.
 *
 * The download control is deliberately NOT inside the plate: it used to sit between
 * the code and the name, and the name is what the code stands for, so the half places
 * the control with the other actions. That puts the control beside the plate rather
 * than inside it, and a ref cannot cross that gap.
 *
 * So the plate registers what it drew, keyed by the payload it carries — the payload
 * is the only thing that identifies a code. `readQrCode()` with no key answers only
 * when there is exactly ONE code mounted, which is every surface today (the receive
 * page draws one half at a time). On a page with two codes the answer is `null`: the
 * caller has to name its payload. Failing is deliberate — guessing the most recently
 * mounted code would export somebody else's payment link, and a wrong link silently
 * downloaded is worse than a control that refuses.
 *
 * Client-only state, in the module scope: registration happens in an effect, so the
 * server never writes to it and one request cannot leak a code into another.
 */
const mounted = new Map<string, QrRegistration>();

/** Mount a code. Returns its own unmount, so the effect stays a one-liner. */
export function registerQrCode(value: string, registration: QrRegistration): () => void {
  mounted.set(value, registration);

  return () => {
    if (mounted.get(value) === registration) mounted.delete(value);
  };
}

/** The code carrying `value`, or the only mounted code when no key is given. */
export function readQrCode(value?: string): QrRegistration | null {
  if (value !== undefined) return mounted.get(value) ?? null;

  const codes = [...mounted.values()];
  return codes.length === 1 ? codes[0] : null;
}
