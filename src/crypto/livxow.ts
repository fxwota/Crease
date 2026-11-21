import { decryptBase64AesCbc } from "./aes-cbc";
import { isValidJsonOrM3u, substituteAscii, utf8ToBytes } from "./bytes";

const PRIMARY_KEY = utf8ToBytes("M8mkKlNL75K4nl15");
const PRIMARY_IV = utf8ToBytes("kN7m5Kl1pN5nk4xK");

const FALLBACK_KEY = utf8ToBytes("L7l15M8mkKlN75K4");
const FALLBACK_IV = utf8ToBytes("xK1kN7m5Kl1pN5nk");

const ALPHA_FROM = "fFgGjJkKaApPbBmMoOzZeEnNcCdDrRqQtTvVuUxXhHiIwWyYlLsS";
const ALPHA_TO = "aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ";

export const LIVXOW_CRYPTO_KEYS = {
  primary: { key: PRIMARY_KEY, iv: PRIMARY_IV },
  fallback: { key: FALLBACK_KEY, iv: FALLBACK_IV },
  alphaFrom: ALPHA_FROM,
  alphaTo: ALPHA_TO,
} as const;

export async function decryptLivXowPayload(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isValidJsonOrM3u(trimmed)) return trimmed;

  // Pass 1: Substitution + AES-128-CBC
  const subbed = substituteAscii(trimmed, ALPHA_FROM, ALPHA_TO);
  const p1 = await decryptBase64AesCbc(subbed, PRIMARY_KEY, PRIMARY_IV);
  if (p1 && isValidJsonOrM3u(p1)) return p1;

  // Pass 2: Fallback direct AES-128-CBC
  const p2 = await decryptBase64AesCbc(trimmed, FALLBACK_KEY, FALLBACK_IV);
  if (p2 && isValidJsonOrM3u(p2)) return p2;

  return trimmed;
}
