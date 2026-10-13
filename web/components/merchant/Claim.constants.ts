import type { HandleKind } from '@/lib/api';
import type { ClaimCopy } from './ClaimForm.types';

/**
 * Copy for the claim surface, PER KIND.
 *
 * One form serves both a person's username and a business's name — that is the
 * point of one namespace and one claim — so the only thing that differs between
 * the two is what the person is told they are claiming. Keeping that difference
 * in copy, keyed by the same `kind` the signature is scoped by, is what stops the
 * person claiming a username from being shown the word "Business".
 *
 * Plain and specific, per the repo's tone rules: "Sign & claim" is the action, and
 * every error names the cause and the fix rather than saying "invalid".
 *
 * `handleTaken` takes the already-built link LABEL rather than a handle, because
 * the form is handed a label by whichever component knows the kind — the copy must
 * not re-decide which route a handle lives at, or a username's collision would be
 * reported against a `/m/` URL that has nothing to do with it.
 */
const RULE_HINT = "2–64 characters: letters, digits, spaces and . , ' & ( ) - _ +";

export const BUSINESS_CLAIM_COPY: ClaimCopy = {
  title: 'Claim a business name',
  intro:
    'Sign once with the wallet that receives your payments. This attaches the name to that address — nothing is written on chain and it costs no gas.',
  fieldLabel: 'Business name',
  placeholder: 'Java House',
  hint: RULE_HINT,
  submit: 'Sign & claim',
  signing: 'Waiting for your wallet to sign…',
  submitting: 'Saving your claim…',
  resultTitle: 'Claimed',
  again: 'Claim another name',
  verified: 'Verified',
  unverified: 'Not verified',
  errorTitle: 'Name not claimed',
  /** The label above the shareable link a merchant hands to a customer. */
  linkLabel: 'Your link',
  handleLabel: 'Your handle',
  handleKindHint:
    'You choose whether this is a personal username (seti.live/u/) or a business name (seti.live/m/) next.',
  handleChecking: 'Checking whether this link is free…',
  handleFree: 'Free',
  handleTaken: (link: string, holder: string): string =>
    `${link} is already taken by ${holder}. Names that reduce to the same link cannot both be claimed — choose another name.`,
  /** The sticker QR. */
  qrLabel: 'Print this — your sticker',
  qrHint:
    'The code opens your link. No amount is in it, so the customer enters what they are paying.',
  qrDownload: 'Download QR (SVG)',
};

export const PERSON_CLAIM_COPY: ClaimCopy = {
  title: 'Claim your username',
  intro:
    'Sign once with the wallet that receives your payments. This attaches your username to that address — nothing is written on chain and it costs no gas.',
  fieldLabel: 'Username',
  placeholder: 'ian.mwangi',
  hint: RULE_HINT,
  submit: 'Sign & claim',
  signing: 'Waiting for your wallet to sign…',
  submitting: 'Saving your claim…',
  resultTitle: 'Claimed',
  again: 'Claim another username',
  verified: 'Verified',
  unverified: 'Not verified',
  errorTitle: 'Username not claimed',
  linkLabel: 'Your link',
  handleLabel: 'Your handle',
  handleKindHint:
    'You choose whether this is a personal username (seti.live/u/) or a business name (seti.live/m/) next.',
  handleChecking: 'Checking whether this link is free…',
  handleFree: 'Free',
  handleTaken: (link: string, holder: string): string =>
    `${link} is already taken by ${holder}. Names that reduce to the same link cannot both be claimed — choose another name.`,
  qrLabel: 'Your code',
  qrHint: 'The code opens your link, so anyone who scans it can send you money.',
  qrDownload: 'Download QR (SVG)',
};

export const CLAIM_COPY_BY_KIND: Record<HandleKind, ClaimCopy> = {
  person: PERSON_CLAIM_COPY,
  business: BUSINESS_CLAIM_COPY,
};

/** The copy for a kind — one lookup, so no caller picks the wrong one. */
export function claimCopy(kind: HandleKind): ClaimCopy {
  return CLAIM_COPY_BY_KIND[kind];
}

/**
 * The copy for onboarding's NAME step, before the kind is chosen.
 *
 * It has to be kind-neutral, and that is not a compromise: the person has not
 * told us yet whether this is a username or a business name, so promising either
 * link would be promising the wrong one half the time. The handle is shown as a
 * handle, and the two links are named as what comes next.
 */
export const ONBOARDING_NAME_COPY: ClaimCopy = {
  title: 'Claim your Seti name',
  intro:
    'This is the name that gets you paid. Sign once with the wallet that receives your payments — nothing is written on chain and it costs no gas.',
  fieldLabel: 'Your name',
  placeholder: 'ian.mwangi',
  hint: RULE_HINT,
  submit: 'Continue',
  signing: 'Waiting for your wallet to sign…',
  submitting: 'Saving your claim…',
  resultTitle: 'Claimed',
  again: 'Claim another name',
  verified: 'Verified',
  unverified: 'Not verified',
  errorTitle: 'Name not claimed',
  linkLabel: 'Your handle',
  handleLabel: 'Your handle',
  handleKindHint:
    'You choose whether this is a personal username (seti.live/u/) or a business name (seti.live/m/) next.',
  handleChecking: 'Checking whether this handle is free…',
  handleFree: 'Free',
  handleTaken: (link: string, holder: string): string =>
    `${link} is already taken by ${holder}. Names that reduce to the same handle cannot both be claimed — choose another name.`,
  qrLabel: 'Your code',
  qrHint: 'The code opens your link.',
  qrDownload: 'Download QR (SVG)',
};
