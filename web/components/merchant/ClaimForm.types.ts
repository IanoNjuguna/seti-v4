import type { HandleIdentity, HandleKind, HandleStatusPreview } from '@/lib/api';
import type { UseMerchantClaimReturn } from '@/hooks/useMerchantClaim.types';

/**
 * The words the claim form uses, per kind.
 *
 * A shape rather than a class so a caller can hand the form a different voice
 * without editing it — which is exactly what onboarding does for its name step,
 * where the kind is not chosen yet.
 */
export interface ClaimCopy {
  title: string;
  intro: string;
  fieldLabel: string;
  placeholder: string;
  hint: string;
  submit: string;
  signing: string;
  submitting: string;
  resultTitle: string;
  again: string;
  verified: string;
  unverified: string;
  errorTitle: string;
  /** The label above the shareable link. */
  linkLabel: string;
  /** The label above the bare handle, shown before a kind is chosen. */
  handleLabel: string;
  /** Names the two links when the kind is not known yet. */
  handleKindHint: string;
  handleChecking: string;
  handleFree: string;
  /** The collision message; `link` is the already-built label for the kind. */
  handleTaken: (link: string, holder: string) => string;
  qrLabel: string;
  qrHint: string;
  qrDownload: string;
}

/** Replaces the form's own submit control — the onboarding name step continues. */
export interface ClaimFormSubmit {
  label: string;
  onPress: () => void;
  /** Blocks the action while something else it depends on is unfinished. */
  disabled?: boolean;
}

/** The whole claim flow: the form and, once it lands, the result. */
export interface ClaimFormProps {
  claim: UseMerchantClaimReturn;
  /**
   * Which route the handle will live at — `/u/<handle>` for a person,
   * `/m/<handle>` for a business. `null` means the kind is not chosen yet
   * (onboarding's name step), and the form then shows the HANDLE rather than a URL,
   * because either URL would be wrong half the time. Undefined uses `claim.kind`.
   */
  linkKind?: HandleKind | null;
  /** Overrides the kind's own copy. */
  copy?: ClaimCopy;
  /** Replaces the sign-and-claim button. */
  submit?: ClaimFormSubmit;
}

export interface ClaimResultProps {
  claimed: HandleIdentity;
  onAgain: () => void;
}

/**
 * The live handle preview. It takes the typed `name` rather than the computed
 * handle so it builds the shown link with the SAME `handleLink` the result and
 * the QR use — one source for the string a person will print.
 */
export interface MerchantHandlePreviewProps {
  /** The name as typed. */
  name: string;
  /** The backend's verdict for this name's handle, or null while it is unknown. */
  preview: HandleStatusPreview | null;
  /** True while a verdict for the current handle is in flight. */
  loading: boolean;
  /** The route the handle will live at, or null before the kind is chosen. */
  kind: HandleKind | null;
  /** The label the collision message names — a link when the kind is known. */
  copy: ClaimCopy;
}

/** The printable QR of a handle's link. */
export interface MerchantQrProps {
  /** The claimed name; the link is built from it with `handleLink`. */
  name: string;
  /** Decides which route the code opens: `/m/` or `/u/`. */
  kind: HandleKind;
}
