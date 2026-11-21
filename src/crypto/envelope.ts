import { aesCbcDecrypt, aesCbcEncrypt } from "./aes-cbc";
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./bytes";

/**
 * EnvelopeCrypto: Unwraps CS3 slice-encoded AES-256-CBC / AES-128-CBC payloads.
 * Layout:
 *   [0..10]         part1 of base64 ciphertext
 *   [10..34]        24-char base64 IV (16 bytes)
 *   [34..len-54]    part2 of base64 ciphertext
 *   [len-54..len-10] 44-char base64 Key (32 bytes; or 16 bytes for AES-128)
 *   [len-10..len]   part3 of base64 ciphertext
 */
export async function decryptEnvelope(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("#EXTM3U") ||
    trimmed.startsWith("#EXTINF") ||
    trimmed.startsWith("#KODIPROP") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    return trimmed;
  }

  if (trimmed.length < 79) {
    return trimmed;
  }

  try {
    const part1 = trimmed.slice(0, 10);
    const ivBase64 = trimmed.slice(10, 34);
    const part2 = trimmed.slice(34, trimmed.length - 54);
    const keyBase64 = trimmed.slice(trimmed.length - 54, trimmed.length - 10);
    const part3 = trimmed.slice(trimmed.length - 10);

    const encryptedBase64 = part1 + part2 + part3;
    const ivBytes = base64ToBytes(ivBase64);
    const keyBytes = base64ToBytes(keyBase64);
    const cipherBytes = base64ToBytes(encryptedBase64);

    if (ivBytes.length !== 16 || (keyBytes.length !== 16 && keyBytes.length !== 32)) {
      return trimmed;
    }

    const decrypted = await aesCbcDecrypt(cipherBytes, keyBytes, ivBytes);
    return bytesToUtf8(decrypted).trim();
  } catch {
    return trimmed;
  }
}

export async function encryptEnvelope(
  plaintext: string,
  keyBytes: Uint8Array,
  ivBytes: Uint8Array
): Promise<string> {
  const cipherBytes = await aesCbcEncrypt(utf8ToBytes(plaintext), keyBytes, ivBytes);
  const cipherBase64 = bytesToBase64(cipherBytes);
  const ivBase64 = bytesToBase64(ivBytes);
  const keyBase64 = bytesToBase64(keyBytes);
  if (cipherBase64.length < 20) {
    throw new Error("Ciphertext too short for EnvelopeCrypto layout");
  }
  const part1 = cipherBase64.slice(0, 10);
  const part3 = cipherBase64.slice(cipherBase64.length - 10);
  const part2 = cipherBase64.slice(10, cipherBase64.length - 10);
  return part1 + ivBase64 + part2 + keyBase64 + part3;
}
