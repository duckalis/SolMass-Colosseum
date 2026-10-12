// Just enough of Solana's address arithmetic to work out where a wallet keeps a token: base58, and
// the "program derived address" rule behind associated token accounts. Written out here — a
// hundred lines — instead of loading the Solana library for it: that library is megabytes, and in a
// browser it needs a Node `Buffer` stand-in that the game would then have to ship and configure.
// The result is checked against the library itself, address for address, by the project's tests.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** The 32 bytes of a Solana address. Throws on anything that is not one. */
export function addressBytes(address: string): Uint8Array {
  let value = 0n;
  for (const char of address) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new Error(`Not a Solana address: ${address}`);
    value = value * 58n + BigInt(digit);
  }
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  if (value > 0n) throw new Error(`Not a Solana address: ${address}`);
  return bytes;
}

export function addressText(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let text = "";
  while (value > 0n) {
    text = (ALPHABET[Number(value % 58n)] as string) + text;
    value /= 58n;
  }
  // Every leading zero byte is a leading "1".
  for (const byte of bytes) {
    if (byte !== 0) break;
    text = `1${text}`;
  }
  return text;
}

// ── Is this a point of the ed25519 curve? ────────────────────────────────────────────────────
// A derived address must NOT be one: no private key may exist for it.

const P = 2n ** 255n - 19n;
/** The curve's constant d = −121665 / 121666 (mod P). */
const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;

function power(base: bigint, exponent: bigint): bigint {
  let result = 1n;
  let factor = base % P;
  for (let left = exponent; left > 0n; left >>= 1n) {
    if (left & 1n) result = (result * factor) % P;
    factor = (factor * factor) % P;
  }
  return result;
}

function isOnCurve(bytes: Uint8Array): boolean {
  // 255 bits of y, little-endian, and the sign of x in the top bit.
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i] as number);
  const negativeX = y >> 255n === 1n;
  y &= (1n << 255n) - 1n;
  if (y >= P) return false;
  // x² = (y² − 1) / (d·y² + 1); the bytes are a point when that has a square root.
  const y2 = (y * y) % P;
  const x2 = ((y2 - 1n + P) * power((D * y2 + 1n) % P, P - 2n)) % P;
  if (x2 === 0n) return !negativeX;
  return power(x2, (P - 1n) / 2n) === 1n;
}

/**
 * The address a program derives from `seeds`: the SHA-256 of the seeds, a "bump" byte, the program
 * and a fixed marker — with the highest bump (counting down from 255) whose hash is off the curve.
 */
async function programAddress(
  seeds: Uint8Array[],
  program: Uint8Array,
): Promise<Uint8Array> {
  const marker = new TextEncoder().encode("ProgramDerivedAddress");
  // seeds | bump | program | marker
  const bumpAt = seeds.reduce((length, seed) => length + seed.length, 0);
  const input = new Uint8Array(bumpAt + 1 + program.length + marker.length);
  let at = 0;
  for (const seed of seeds) {
    input.set(seed, at);
    at += seed.length;
  }
  input.set(program, bumpAt + 1);
  input.set(marker, bumpAt + 1 + program.length);
  for (let bump = 255; bump >= 0; bump--) {
    input[bumpAt] = bump;
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
    if (!isOnCurve(hash)) return hash;
  }
  throw new Error("No address can be derived from these seeds");
}

/** The program that derives associated token accounts. */
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/**
 * A wallet's associated token account of a mint — where every wallet and exchange keeps a token by
 * default. `tokenProgram` is the program the mint belongs to (the classic one or Token-2022).
 */
export async function associatedTokenAddress(
  owner: string,
  tokenProgram: string,
  mint: string,
): Promise<string> {
  return addressText(
    await programAddress(
      [addressBytes(owner), addressBytes(tokenProgram), addressBytes(mint)],
      addressBytes(ASSOCIATED_TOKEN_PROGRAM),
    ),
  );
}
