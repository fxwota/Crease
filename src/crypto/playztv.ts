import { decryptBase64AesCbc } from "./aes-cbc";
import {
  base64ToBytes,
  bytesToUtf8,
  isValidJsonOrM3u,
  reverseBytes,
  substituteAscii,
  swapAdjacentBytePairs,
  utf8ToBytes,
} from "./bytes";

const NATIVE_KEY = utf8ToBytes("cz14RStkN01PVE5w");
const NATIVE_IV = utf8ToBytes("WTlEvckd2UR41sdk");

const PRIMARY_KEY = utf8ToBytes("b/1jml5nk4x5k7pN");
const PRIMARY_IV = utf8ToBytes("14nMk8mN5Kl5KL7l");

const FALLBACK_KEY = utf8ToBytes("m5Kl5nk4xK1kN7pN");
const FALLBACK_IV = utf8ToBytes("k5K4nM8mKlNL7l15");

const ALPHA_FROM = "aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ";
const ALPHA_TO = "fFgGjJkKaApPbBmMoOzZeEnNcCdDrRqQtTvVuUxXhHiIwWyYlLsS";

export const PLAYZTV_CRYPTO_KEYS = {
  native: { key: NATIVE_KEY, iv: NATIVE_IV },
  primary: { key: PRIMARY_KEY, iv: PRIMARY_IV },
  fallback: { key: FALLBACK_KEY, iv: FALLBACK_IV },
  alphaFrom: ALPHA_FROM,
  alphaTo: ALPHA_TO,
} as const;

export async function decryptPlayZtvPayload(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isValidJsonOrM3u(trimmed)) return trimmed;

  // Pass 1: Native libplayztv.so (Base64 -> reverse bytes -> swap adjacent pairs -> Base64 -> AES-128-CBC)
  try {
    const rawBytes = base64ToBytes(trimmed);
    const reversed = reverseBytes(rawBytes);
    const swapped = swapAdjacentBytePairs(reversed);
    const innerBase64 = bytesToUtf8(swapped);
    const p1 = await decryptBase64AesCbc(innerBase64, NATIVE_KEY, NATIVE_IV);
    if (p1 && isValidJsonOrM3u(p1)) return p1;
  } catch {
    // continue
  }

  // Pass 2: Primary substitution + AES-128-CBC
  const subbed = substituteAscii(trimmed, ALPHA_FROM, ALPHA_TO);
  const p2 = await decryptBase64AesCbc(subbed, PRIMARY_KEY, PRIMARY_IV);
  if (p2 && isValidJsonOrM3u(p2)) return p2;

  // Pass 3: Fallback direct AES-128-CBC
  const p3 = await decryptBase64AesCbc(trimmed, FALLBACK_KEY, FALLBACK_IV);
  if (p3 && isValidJsonOrM3u(p3)) return p3;

  return trimmed;
}
