import type { AccountIntent } from '@/lib/api';
import type { OnboardingStep } from './Onboarding.types';

/**
 * The four steps, in order, named once.
 *
 * The order is the whole design: sign in (nothing can be signed without a wallet),
 * claim a name (which is what makes the account usable at all), choose the intent
 * (which decides the kind, and therefore the `purpose` the claim signs for), done.
 */
export const ONBOARDING_STEPS: readonly { id: OnboardingStep; label: string }[] = [
  { id: 'sign-in', label: 'Sign in' },
  { id: 'username', label: 'Claim your name' },
  { id: 'intent', label: 'How you use Seti' },
  { id: 'done', label: 'Done' },
];

/**
 * The two intents, as options.
 *
 * `intent` is the ACCOUNT's mode; the `HANDLE_KIND_FOR_INTENT` map (see
 * `lib/account`) turns it into the kind the handle is claimed as. The wording here
 * is the person's, not the model's — they are choosing how they will use Seti, and
 * the consequence sentence names the link each choice produces.
 */
export const INTENT_OPTIONS: readonly {
  intent: AccountIntent;
  title: string;
  body: string;
  action: string;
}[] = [
  {
    intent: 'personal',
    title: 'Personal',
    body: 'A username people can send money to. Your link is seti.live/u/<your name>.',
    action: 'Claim a username',
  },
  {
    intent: 'business',
    title: 'Business',
    body: 'A name customers can pay. Your link is seti.live/m/<your name>, with a printable QR code.',
    action: 'Claim a business name',
  },
];

export const ONBOARDING_COPY = {
  title: 'Set up your Seti account',
  intro:
    'Your name is how people pay you, so it is required. Four steps, no birth date, no document upload.',
  intentTitle: 'How will you use Seti?',
  intentIntro:
    'This decides whether your name is a username or a business name, and which link it gets. You sign once, and the purpose is part of what your wallet signs.',
  intentReversible:
    'Reversible: you can switch this in Profile whenever you like, and an account can hold both a username and a business name.',
  intentError: 'That name could not be claimed',
  finish: 'Go to Seti',
  finishing: 'Opening Seti…',
  /** Shown when a finished account reaches the wizard — no second name to claim. */
  alreadyTitle: 'You are all set',
  alreadyBody:
    'This account already has a name, so there is nothing to finish. Manage your name and mode in Profile at any time.',
  /** The wallet is signing; the person's only job is to approve it. */
  signing: 'Waiting for your wallet to sign…',
  accountErrorTitle: 'Could not read your account',
  retry: 'Try again',
} as const;
