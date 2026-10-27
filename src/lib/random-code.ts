/**
 * Random numeric codes for the shared passwords (battle plan pages, Rally Sync
 * rooms): easy to read out in voice chat and to type on a phone. Pure and
 * unit-tested; the random bytes come from the Web Crypto API (browser and
 * Node alike), never Math.random.
 */

export const SUGGESTED_CODE_LENGTH = 6;

type RandomBytes = (bytes: Uint8Array) => Uint8Array;

const secureBytes: RandomBytes = (bytes) => crypto.getRandomValues(bytes);

/**
 * `length` random digits. Bytes of 250 and above are skipped, so every digit
 * is equally likely (256 is not a multiple of 10).
 */
export function randomDigits(length = SUGGESTED_CODE_LENGTH, random: RandomBytes = secureBytes): string {
  let code = "";
  while (code.length < length) {
    for (const byte of random(new Uint8Array(length))) {
      if (byte < 250 && code.length < length) code += String(byte % 10);
    }
  }
  return code;
}
