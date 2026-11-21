import { decryptBase64AesCbc } from "./aes-cbc";
import { isValidJsonOrM3u, utf8ToBytes } from "./bytes";
import { decryptEnvelope } from "./envelope";

const PRIMARY_KEY = utf8ToBytes("3hHzxYAgSGI8/ham");
const PRIMARY_IV = utf8ToBytes("UqCvkvjecEIz842V");

const DEX_SECONDARY_KEY = utf8ToBytes("MqeYGCT4AYKoHKrT");
const DEX_SECONDARY_IV = utf8ToBytes("oHKrTQuPx8zl8oJ+");

const LEGACY_SECONDARY_KEY = utf8ToBytes("1514925786399479");
const LEGACY_SECONDARY_IV = utf8ToBytes("1696747751010409");

export const CRICIFY_CRYPTO_KEYS = {
  primary: { key: PRIMARY_KEY, iv: PRIMARY_IV },
  dexSecondary: { key: DEX_SECONDARY_KEY, iv: DEX_SECONDARY_IV },
  legacySecondary: { key: LEGACY_SECONDARY_KEY, iv: LEGACY_SECONDARY_IV },
} as const;

export async function decryptCricifyPayload(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isValidJsonOrM3u(trimmed)) return trimmed;

  const attempts: ReadonlyArray<{ key: Uint8Array; iv: Uint8Array }> = [
    { key: PRIMARY_KEY, iv: PRIMARY_IV },
    { key: DEX_SECONDARY_KEY, iv: DEX_SECONDARY_IV },
    { key: LEGACY_SECONDARY_KEY, iv: LEGACY_SECONDARY_IV },
  ];

  for (const attempt of attempts) {
    const dec = await decryptBase64AesCbc(trimmed, attempt.key, attempt.iv);
    if (dec && isValidJsonOrM3u(dec)) {
      return dec;
    }
  }

  const envDec = await decryptEnvelope(trimmed);
  if (envDec && isValidJsonOrM3u(envDec)) {
    return envDec;
  }

  return trimmed;
}
