import { describe, expect, it } from "vitest";
import {
  aesCbcEncrypt,
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  CRICIFY_CRYPTO_KEYS,
  decryptCricifyPayload,
  decryptEnvelope,
  decryptLivXowPayload,
  decryptPlayFyPayload,
  decryptPlayZtvPayload,
  decryptSkTechPayload,
  decryptSportzxPayload,
  decryptSportzxV3Bytes,
  derivePlayFyIv,
  derivePlayFyKey,
  encryptEnvelope,
  encryptSportzxV3Bytes,
  invertSkTechLookupTableD,
  LIVXOW_CRYPTO_KEYS,
  PLAYFY_CRYPTO_KEYS,
  PLAYZTV_CRYPTO_KEYS,
  reverseBytes,
  SKTECH_CRYPTO_KEYS,
  SPORTZX_CRYPTO_KEYS,
  substituteAscii,
  swapAdjacentBytePairs,
  utf8ToBytes,
} from "../../src/crypto";

describe("Crease Pure-Edge Crypto Engine — Golden Vector Suite", () => {
  const sampleCricketJson = JSON.stringify([
    { title: "India vs Australia 2nd T20I", tournament: "Border-Gavaskar T20I", status: "LIVE" },
  ]);

  it("EnvelopeCrypto: round-trips AES-256-CBC and AES-128-CBC and passes plaintext through", async () => {
    expect(await decryptEnvelope("#EXTM3U\n#EXTINF:-1,Willow Cricket")).toContain("#EXTM3U");
    expect(await decryptEnvelope('{"ok":true}')).toBe('{"ok":true}');

    const key256 = utf8ToBytes("0123456789abcdef0123456789abcdef");
    const iv16 = utf8ToBytes("fedcba9876543210");
    const wrapped = await encryptEnvelope(sampleCricketJson, key256, iv16);
    expect(wrapped.length).toBeGreaterThanOrEqual(79);
    expect(await decryptEnvelope(wrapped)).toBe(sampleCricketJson);
  });

  it("Cricify: decrypts Primary, Dex-Secondary, Legacy-Secondary, and EnvelopeCrypto tiers", async () => {
    for (const tier of [
      CRICIFY_CRYPTO_KEYS.primary,
      CRICIFY_CRYPTO_KEYS.dexSecondary,
      CRICIFY_CRYPTO_KEYS.legacySecondary,
    ]) {
      const ct = await aesCbcEncrypt(utf8ToBytes(sampleCricketJson), tier.key, tier.iv);
      const dec = await decryptCricifyPayload(bytesToBase64(ct));
      expect(dec).toBe(sampleCricketJson);
    }

    const envCt = await encryptEnvelope(
      sampleCricketJson,
      utf8ToBytes("0123456789abcdef0123456789abcdef"),
      utf8ToBytes("abcdef0123456789")
    );
    expect(await decryptCricifyPayload(envCt)).toBe(sampleCricketJson);
  });

  it("Sportzx: decrypts SXR3 sponge (both Dex tag-at-end and Legacy tag-before-ct), rejects tampered MAC, and handles AES fallbacks", async () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const nonce = new Uint8Array([21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

    const dexPacket = encryptSportzxV3Bytes(sampleCricketJson, salt, nonce, "dex");
    expect(decryptSportzxV3Bytes(dexPacket)).toBe(sampleCricketJson);
    expect(await decryptSportzxPayload(JSON.stringify({ data: bytesToBase64(dexPacket) }))).toBe(
      sampleCricketJson
    );

    const legacyPacket = encryptSportzxV3Bytes(sampleCricketJson, salt, nonce, "legacy");
    expect(decryptSportzxV3Bytes(legacyPacket)).toBe(sampleCricketJson);

    // Tampered MAC must fail verification
    const tampered = new Uint8Array(dexPacket);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    expect(decryptSportzxV3Bytes(tampered)).toBeNull();

    // AES fallbacks
    for (const fb of [SPORTZX_CRYPTO_KEYS.fallback1, SPORTZX_CRYPTO_KEYS.fallback2]) {
      const ct = await aesCbcEncrypt(utf8ToBytes(sampleCricketJson), fb.key, fb.iv);
      expect(await decryptSportzxPayload(bytesToBase64(ct))).toBe(sampleCricketJson);
    }
  });

  it("PlayFy: derives exact Dalvik 32-bit FNV-1a key/IV and decrypts PKCS#7 & NoPadding payloads", async () => {
    // Exact Golden Vectors verified against PlayFy Dalvik bytecode
    expect(derivePlayFyKey()).toBe("BR4weRP=5A/Y&8%5");
    expect(derivePlayFyIv()).toBe("Va+XYCKnkinUMDvk");

    const ct = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      PLAYFY_CRYPTO_KEYS.key,
      PLAYFY_CRYPTO_KEYS.iv
    );
    expect(await decryptPlayFyPayload(JSON.stringify({ data: bytesToBase64(ct) }))).toBe(
      sampleCricketJson
    );

    // Zero-padded 16-byte aligned plaintext (triggers pure-TS AES-128-CBC NoPadding fallback)
    const exact16 = '{"ok":"cricket"}'; // 16 bytes exact -> take first 16B ciphertext block (no PKCS#7 padding block!)
    const fullWithPad = await aesCbcEncrypt(
      utf8ToBytes(exact16),
      PLAYFY_CRYPTO_KEYS.key,
      PLAYFY_CRYPTO_KEYS.iv
    );
    const noPaddingCipherBlock = fullWithPad.subarray(0, 16);
    expect(await decryptPlayFyPayload(bytesToBase64(noPaddingCipherBlock))).toBe(exact16);
  });

  it("SKTech: strips 64-char hex header and decrypts Lookup Table D, V23 byte-pair swap, and direct fallbacks", async () => {
    // Legacy Lookup Table D pipeline
    const legacyCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      SKTECH_CRYPTO_KEYS.legacy.key,
      SKTECH_CRYPTO_KEYS.legacy.iv
    );
    const reversedB64 = bytesToBase64(legacyCt).split("").reverse().join("");
    const outerB64 = bytesToBase64(utf8ToBytes(reversedB64));
    const tableEncoded = invertSkTechLookupTableD(outerB64);
    const withHexPrefix = "a".repeat(64) + tableEncoded;
    expect(await decryptSkTechPayload(withHexPrefix)).toBe(sampleCricketJson);

    // V23 pipeline: Base64(swap(reverse(utf8(b64(aes)))))
    const v23Ct = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      SKTECH_CRYPTO_KEYS.v23.key,
      SKTECH_CRYPTO_KEYS.v23.iv
    );
    const innerBytes = utf8ToBytes(bytesToBase64(v23Ct));
    const v23Wire = bytesToBase64(swapAdjacentBytePairs(reverseBytes(innerBytes)));
    expect(await decryptSkTechPayload(v23Wire)).toBe(sampleCricketJson);

    // Direct Dex Fallback B
    const dexCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      SKTECH_CRYPTO_KEYS.dexFallback.key,
      SKTECH_CRYPTO_KEYS.dexFallback.iv
    );
    expect(await decryptSkTechPayload(bytesToBase64(dexCt))).toBe(sampleCricketJson);
  });

  it("PlayZTV: decrypts libplayztv.so reverse/pair-swap, substitution, and fallback AES tiers", async () => {
    // Native libplayztv.so tier
    const nativeCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      PLAYZTV_CRYPTO_KEYS.native.key,
      PLAYZTV_CRYPTO_KEYS.native.iv
    );
    const innerBytes = utf8ToBytes(bytesToBase64(nativeCt));
    const wireBytes = reverseBytes(swapAdjacentBytePairs(innerBytes));
    expect(await decryptPlayZtvPayload(bytesToBase64(wireBytes))).toBe(sampleCricketJson);

    // Primary substitution tier
    const primCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      PLAYZTV_CRYPTO_KEYS.primary.key,
      PLAYZTV_CRYPTO_KEYS.primary.iv
    );
    const subWire = substituteAscii(
      bytesToBase64(primCt),
      PLAYZTV_CRYPTO_KEYS.alphaTo,
      PLAYZTV_CRYPTO_KEYS.alphaFrom
    );
    expect(await decryptPlayZtvPayload(subWire)).toBe(sampleCricketJson);

    // Fallback tier
    const fbCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      PLAYZTV_CRYPTO_KEYS.fallback.key,
      PLAYZTV_CRYPTO_KEYS.fallback.iv
    );
    expect(await decryptPlayZtvPayload(bytesToBase64(fbCt))).toBe(sampleCricketJson);
  });

  it("LivXow: decrypts primary substitution and fallback AES tiers plus base64 round-trip", async () => {
    const primCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      LIVXOW_CRYPTO_KEYS.primary.key,
      LIVXOW_CRYPTO_KEYS.primary.iv
    );
    const subWire = substituteAscii(
      bytesToBase64(primCt),
      LIVXOW_CRYPTO_KEYS.alphaTo,
      LIVXOW_CRYPTO_KEYS.alphaFrom
    );
    expect(await decryptLivXowPayload(subWire)).toBe(sampleCricketJson);

    const fbCt = await aesCbcEncrypt(
      utf8ToBytes(sampleCricketJson),
      LIVXOW_CRYPTO_KEYS.fallback.key,
      LIVXOW_CRYPTO_KEYS.fallback.iv
    );
    expect(await decryptLivXowPayload(bytesToBase64(fbCt))).toBe(sampleCricketJson);
    expect(bytesToUtf8(base64ToBytes(bytesToBase64(utf8ToBytes("pro/cricket.txt"))))).toBe(
      "pro/cricket.txt"
    );
  });
});
