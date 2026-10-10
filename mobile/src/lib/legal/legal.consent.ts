import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from './legal.constants';

export interface ConsentRecord {
  /** Version of the summary the user accepted. */
  version: number;
  /** ISO 8601 timestamp of acceptance. */
  acceptedAt: string;
  /** Consent is recorded against the installed app version. */
  appVersion?: string;
}

/**
 * Reads the stored consent record.
 *
 * Returns null when nothing is stored, when the stored JSON is unreadable, or
 * when the stored record is for an older summary version — a material change
 * to the documents forces a fresh acceptance rather than silently reusing the
 * old record.
 */
export async function readConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (
      typeof parsed?.version !== 'number' ||
      typeof parsed?.acceptedAt !== 'string' ||
      parsed.version < CONSENT_VERSION
    ) {
      return null;
    }

    return parsed as ConsentRecord;
  } catch {
    // Corrupt or unreadable storage is treated as "no consent recorded".
    return null;
  }
}

/** Records acceptance of the current summary version. */
export async function writeConsent(
  appVersion?: string
): Promise<ConsentRecord> {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    appVersion,
  };

  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  return record;
}

/** Clears the stored consent record. */
export async function clearConsent(): Promise<void> {
  await AsyncStorage.removeItem(CONSENT_STORAGE_KEY);
}
