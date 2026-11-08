/**
 * What one key press does to the amount string.
 *
 * The keypad and the text field both write through this, so there is exactly one rule for how an
 * amount is built and it is a pure function: no DOM, no React, no state to arrange. That is also
 * what makes it testable, and the tests are the only reason a `00` cannot be typed, a second
 * decimal point cannot appear, and the third decimal cannot be entered.
 *
 * The rules, and why each one exists:
 *
 *  - **Two decimals.** Every supported asset and every figure the app prints is 2 decimal places
 *    in the customer's currency, so a third is a number the app will round away after the customer
 *    typed it: refuse it at the key rather than silently change their amount later.
 *  - **One decimal point.** A second one is not a number. Pressing it when the string is empty
 *    starts `0.`, because `.5` is a valid amount and a lone `.` is not.
 *  - **No leading zeros.** `07` reads as a different number from `7` to anyone scanning the
 *    screen, and a keypad makes typos like that easy. `0` is replaced by the next digit, except
 *    while it is the integer part of a decimal (`0.`).
 *  - **Nine integer digits.** A cap rather than an overflow: KES amounts at these magnitudes are
 *    already beyond any balance, and a hundred-digit string is a layout bug on every surface that
 *    prints it.
 *  - **Backspace on an empty string stays empty**, so holding it cannot throw.
 */
export function applyKey(amount: string, key: string): string {
  if (key === 'back') return amount.slice(0, -1);

  const [whole, fraction] = amount.split('.');
  const hasPoint = fraction !== undefined;

  if (key === '.') {
    if (hasPoint) return amount;
    return amount === '' ? '0.' : `${amount}.`;
  }

  if (!/^[0-9]$/.test(key)) return amount;

  if (hasPoint) {
    return fraction.length >= 2 ? amount : `${whole}.${fraction}${key}`;
  }

  if (amount === '0') return key;
  if (whole.length >= 9) return amount;
  return `${amount}${key}`;
}
