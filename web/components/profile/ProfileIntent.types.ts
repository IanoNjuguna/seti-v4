import type { AccountIntent, HandleIdentity, HandleKind } from '@/lib/api';

export interface ProfileIntentSwitchProps {
  /** The mode the account is acting as. */
  intent: AccountIntent;
  /** The mode being written, or null. */
  switching: AccountIntent | null;
  onSwitch: (intent: AccountIntent) => void;
}

export interface ProfileHandlePanelProps {
  /** Which mode's handle to show. */
  intent: AccountIntent;
  /** The handle the account holds for that mode, or null when it holds none. */
  handle: HandleIdentity | null;
}

/** What the "no name yet" block renders: which mode's claim link to offer. */
export interface ProfileHandleEmptyProps {
  intent: AccountIntent;
}

/** What a claimed handle's state renders — verified, waiting, or under review. */
export interface ProfileHandleStatusProps {
  /** The kind it was claimed as, which decides the words. */
  kind: HandleKind;
  handle: HandleIdentity;
}

export interface UseProfileIntentReturn {
  intent: AccountIntent;
  /** The handle behind a mode, or null. */
  handleFor: (intent: AccountIntent) => HandleIdentity | null;
  switching: AccountIntent | null;
  error: string | null;
  switchTo: (intent: AccountIntent) => Promise<void>;
}
