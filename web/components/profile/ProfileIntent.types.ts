import type { AccountIntent } from '@/lib/api';

export interface ProfileIntentSwitchProps {
  /** The mode the account is acting as. */
  intent: AccountIntent;
  /** The mode being written, or null. */
  switching: AccountIntent | null;
  onSwitch: (intent: AccountIntent) => void;
}

export interface UseProfileIntentReturn {
  intent: AccountIntent;
  switching: AccountIntent | null;
  error: string | null;
  switchTo: (intent: AccountIntent) => Promise<void>;
}
