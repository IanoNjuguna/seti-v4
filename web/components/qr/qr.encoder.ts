import qrcode from 'qrcode-generator';
import { QR_GEOMETRY } from './qr.constants';
import type { QrModuleMatrix } from './qr.types';

/**
 * The payload as a square matrix of dark/light modules — the whole of QR inside the
 * app, through one import.
 *
 * Everything that draws a code now goes through this: the landing hero, the public pay page, both
 * receive halves, the receipt and the claim sticker (#433). `react-qr-code` cannot style per module,
 * because it emits one hard-edged `<path>` for every dark module, so a rounded module, a rounded
 * finder or a reserved centre behind a mark is not reachable through it. The geometry is ours, and
 * this is the encoder underneath it.
 *
 * Version `0` means "smallest that fits", so the module count follows the payload:
 * 29 modules for `https://seti.live/u/ian`, 33 for a business link, 41 for an
 * EIP-681 address, all at level H. A payload too big for even version 40 returns
 * `null` rather than throwing inside a render — a code that cannot be built draws no
 * code at all, and every surface that wants one also prints the same string as text.
 */
export function encodeQr(value: string): QrModuleMatrix | null {
  try {
    const encoder = qrcode(0, QR_GEOMETRY.level);
    encoder.addData(value);
    encoder.make();

    const count = encoder.getModuleCount();
    const rows: boolean[][] = [];
    for (let row = 0; row < count; row += 1) {
      const modules: boolean[] = [];
      for (let col = 0; col < count; col += 1) modules.push(encoder.isDark(row, col));
      rows.push(modules);
    }
    return rows;
  } catch {
    return null;
  }
}
