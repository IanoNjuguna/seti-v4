import type { AccountIntent, HandleIdentity } from '@/lib/api';

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

export interface UseProfileIntentReturn {
  intent: AccountIntent;
  /** The handle behind a mode, or null. */
  handleFor: (intent: AccountIntent) => HandleIdentity | null;
  switching: AccountIntent | null;
  error: string | null;
  switchTo: (intent: AccountIntent) => Promise<void>;
}
