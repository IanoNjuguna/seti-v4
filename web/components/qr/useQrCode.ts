import { useMemo } from 'react';
import { buildQrGeometry } from './qr.geometry';
import type { QrGeometry } from './qr.types';

/**
 * The geometry of one payload, computed once per payload.
 *
 * Encoding is pure and synchronous, so this is a `useMemo` rather than state: there is
 * nothing to fetch, nothing to await and no loading state to invent. It is a hook so
 * no component does the arithmetic and so a re-render (a parent's scroll state, a
 * hover) does not re-encode the symbol.
 */
export function useQrCode(value: string): QrGeometry | null {
  return useMemo(() => buildQrGeometry(value), [value]);
}
