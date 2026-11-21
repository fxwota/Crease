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

const LEGACY_KEY = utf8ToBytes("l2l5kB7xC5qP1rK1");
const LEGACY_IV = utf8ToBytes("p1K5nP7uB8hH1l19");

const V23_KEY = utf8ToBytes("V9LQR42pNKc7smaX");
const V23_IV = utf8ToBytes("d2WT1lR4ckEvUsdk");

const DEX_FALLBACK_KEY = utf8ToBytes("I=4dkwPiOuROD+pD");
const DEX_FALLBACK_IV = utf8ToBytes("ST00ZGt3UGlPdVJP");

const ALPHA_STANDARD = "aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ";
const ALPHA_V25 = "xXyYzZaAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwW";
const ALPHA_FALLBACK_B = "pPqQrRsStTuUvVwWxXyYzZaAbBcCdDeEfFgGhHiIjJkKlLmMnNoO";

// Exact 128-char ASCII Lookup Table D from SKLiveCryptoUtils.kt
const LOOKUP_TABLE_D =
  "\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f" +
  "\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f" +
  " !\"#$%&'()*+,-./" +
  "0123456789:;<=>?" +
  "@EGMNKABUVCDYHLI" +
  "FPOZQSRWTXJ[\\]^_" +
  "`egmnkabuvcdyhli" +
  "fpozqsrwtxj{|}~\x7f";

export const SKTECH_CRYPTO_KEYS = {
  legacy: { key: LEGACY_KEY, iv: LEGACY_IV },
  v23: { key: V23_KEY, iv: V23_IV },
  dexFallback: { key: DEX_FALLBACK_KEY, iv: DEX_FALLBACK_IV },
} as const;

export function applySkTechLookupTableD(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    out += code < 128 ? (LOOKUP_TABLE_D[code] ?? input[i]!) : input[i]!;
  }
  return out;
}

export function invertSkTechLookupTableD(input: string): string {
  const inverse = new Map<number, string>();
  for (let i = 0; i < LOOKUP_TABLE_D.length; i++) {
    inverse.set(LOOKUP_TABLE_D.charCodeAt(i), String.fromCharCode(i));
  }
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    out += inverse.get(ch.charCodeAt(0)) ?? ch;
  }
  return out;
}

export function preprocessSkTechResponse(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length > 64) {
    const prefix = trimmed.slice(0, 64);
    if (/^[0-9a-fA-F]{64}$/.test(prefix) || prefix.startsWith("BA@GBA@GBA@GBA@G")) {
      return trimmed.slice(64).trim();
    }
  }
  return trimmed;
}

async function tryDecryptLegacy(payload: string): Promise<string | null> {
  try {
    const mapped = applySkTechLookupTableD(payload);
    const decodedStr = bytesToUtf8(base64ToBytes(mapped));
    const reversed = decodedStr.split("").reverse().join("");
    const dec = await decryptBase64AesCbc(reversed, LEGACY_KEY, LEGACY_IV);
    return dec && isValidJsonOrM3u(dec) ? dec : null;
  } catch {
    return null;
  }
}

async function tryDecryptV23(payload: string): Promise<string | null> {
  try {
    const rawBytes = base64ToBytes(payload);
    const swapped = swapAdjacentBytePairs(rawBytes);
    const reversed = reverseBytes(swapped);
    const innerBase64 = bytesToUtf8(reversed);
    const dec = await decryptBase64AesCbc(innerBase64, V23_KEY, V23_IV);
    return dec && isValidJsonOrM3u(dec) ? dec : null;
  } catch {
    return null;
  }
}

export async function decryptSkTechPayload(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isValidJsonOrM3u(trimmed)) return trimmed;

  const cleaned = preprocessSkTechResponse(trimmed);
  if (isValidJsonOrM3u(cleaned)) return cleaned;

  // Pass 1: Lookup Table D + Base64 + Reverse + AES-128-CBC (Legacy)
  const p1 = await tryDecryptLegacy(cleaned);
  if (p1) return p1;

  // Pass 2: Outer Base64 unwrap -> Legacy
  try {
    const outer = bytesToUtf8(base64ToBytes(cleaned)).trim();
    const p2 = await tryDecryptLegacy(outer);
    if (p2) return p2;
  } catch {
    // continue
  }

  // Pass 3: V23 (Base64 -> swap adjacent pairs -> reverse bytes -> Base64 -> AES-128-CBC)
  const p3 = await tryDecryptV23(cleaned);
  if (p3) return p3;

  // Pass 4: Direct AES-128-CBC (Legacy Key/IV)
  const p4 = await decryptBase64AesCbc(cleaned, LEGACY_KEY, LEGACY_IV);
  if (p4 && isValidJsonOrM3u(p4)) return p4;

  // Pass 5: Direct AES-128-CBC (Dex Fallback B)
  const p5 = await decryptBase64AesCbc(cleaned, DEX_FALLBACK_KEY, DEX_FALLBACK_IV);
  if (p5 && isValidJsonOrM3u(p5)) return p5;

  // Pass 6: Primary V25 substitution
  try {
    const keyV25 = base64ToBytes("YTBiMWMyZDNlNGY1ZzZoNw==");
    const ivV25 = base64ToBytes("aThqOWsMDFsMm0zbjRvNQ==");
    if (keyV25.length === 16 && ivV25.length === 16) {
      const subbed = substituteAscii(cleaned, ALPHA_V25, ALPHA_STANDARD);
      const p6 = await decryptBase64AesCbc(subbed, keyV25, ivV25);
      if (p6 && isValidJsonOrM3u(p6)) return p6;
    }
  } catch {
    // continue
  }

  // Pass 7: Fallback B substitution
  try {
    const keyFb = base64ToBytes("ZEs3c1A5bVgycVc1ZVI4dA==");
    const ivFb = base64ToBytes("ZkczEo2a0wwelg0Y1YxYg==");
    if (keyFb.length === 16 && ivFb.length === 16) {
      const subbed = substituteAscii(cleaned, ALPHA_FALLBACK_B, ALPHA_STANDARD);
      const p7 = await decryptBase64AesCbc(subbed, keyFb, ivFb);
      if (p7 && isValidJsonOrM3u(p7)) return p7;
    }
  } catch {
    // continue
  }

  return trimmed;
}
