/**
 * `qrcode-generator` ships no declarations, and this is the whole surface the app
 * uses: four methods and a constructor.
 *
 * Declared here rather than cast at the import, so the renderer gets real types and
 * there is no `as unknown as` for a later reader to trust blindly. It sits beside
 * `qr.encoder.ts`, the one module that imports it.
 */
declare module 'qrcode-generator' {
  export interface QrEncoder {
    /** Append the payload. Called once: this renderer encodes one string per code. */
    addData(data: string): void;
    /** Build the matrix. Throws when the payload cannot fit the level. */
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }

  /** `0` asks the library for the smallest version the payload fits. */
  export default function qrcode(
    typeNumber: number,
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
  ): QrEncoder;
}
