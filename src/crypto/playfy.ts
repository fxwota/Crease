import { decryptBase64AesCbc } from "./aes-cbc";
import { isValidJsonOrM3u, unwrapSingleDataEnvelope, utf8ToBytes } from "./bytes";

const LORA_SEED = "zH7hY9@lO=8uXk#f%mI/VvJd2G10Z5eU+L6Pi&aEbwA4scBCStQ3KyWqRjDgnoMRP";
const SIG_SEED = "Mc1pOdG+rjLRsO8tlGCxcBFqGIU";

const FNV_PRIME = 0x01000193n;

function s32(v: bigint): bigint {
  return BigInt.asIntN(32, v);
}

function u32(v: bigint): bigint {
  return BigInt.asUintN(32, v);
}

function fnv1a32(input: string, seed: bigint): bigint {
  let h = u32(seed);
  for (let i = 0; i < input.length; i++) {
    h = u32((h ^ BigInt(input.charCodeAt(i) & 0xff)) * FNV_PRIME);
  }
  return h;
}

export function derivePlayFyKey(): string {
  const chars: string[] = [];
  let h = fnv1a32(SIG_SEED, 0x811c9dc5n);
  let j = 0n;

  for (let i = 0; i < 16; i++) {
    const ch = s32(BigInt(SIG_SEED.charCodeAt(i % SIG_SEED.length)));
    const next = u32(s32(ch + j) ^ s32(s32(h) * 31n));
    chars.push(LORA_SEED[Number(next % BigInt(LORA_SEED.length))]!);
    h = next;
    j = u32(j + 13n);
  }

  return chars.join("");
}

export function derivePlayFyIv(): string {
  const chars: string[] = [];
  let h = fnv1a32(SIG_SEED, 0x811c832an);
  let j = 0n;

  for (let i = 0; i < 48; i += 3) {
    const ch = s32(BigInt(SIG_SEED.charCodeAt(i % SIG_SEED.length)));
    const next = u32(s32(ch + j) ^ s32(s32(h) * 29n));
    chars.push(LORA_SEED[Number(next % BigInt(LORA_SEED.length))]!);
    h = next;
    j = u32(j + 7n);
  }

  return chars.join("");
}

const DERIVED_KEY_STR = derivePlayFyKey();
const DERIVED_IV_STR = derivePlayFyIv();

export const PLAYFY_CRYPTO_KEYS = {
  keyString: DERIVED_KEY_STR,
  ivString: DERIVED_IV_STR,
  key: utf8ToBytes(DERIVED_KEY_STR),
  iv: utf8ToBytes(DERIVED_IV_STR),
} as const;

export async function decryptPlayFyPayload(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const candidate = unwrapSingleDataEnvelope(trimmed);
  if (isValidJsonOrM3u(candidate)) return candidate;

  const dec = await decryptBase64AesCbc(candidate, PLAYFY_CRYPTO_KEYS.key, PLAYFY_CRYPTO_KEYS.iv, {
    allowNoPaddingFallback: true,
  });
  if (dec && isValidJsonOrM3u(dec)) {
    return dec;
  }

  return trimmed;
}
