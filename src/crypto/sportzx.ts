import { decryptBase64AesCbc } from "./aes-cbc";
import {
  base64ToBytes,
  bytesToUtf8,
  concatBytes,
  constantTimeEqual,
  hexToBytes,
  isValidJsonOrM3u,
  unwrapSingleDataEnvelope,
  utf8ToBytes,
} from "./bytes";

const SXR_CONSTS = new Uint32Array([0x53585233, 0x9e3779b9, 0x7d3ca820, 0xc2b2ae3d]);
const CTX_HASH = hexToBytes("1676ec7db4771b0d826d70369b579684b182d2c0133be041bdd55f5d6d79a98b");
const V3_PEPPER = hexToBytes("b1657de309d6e790607a5c4ee7d1af4853f571857dc965e65cb56743923a4579");
const V3_SXR_LABEL = utf8ToBytes("SXR3/kdf");

const FALLBACK_1_KEY = hexToBytes("385557666474657740366c39354c323d");
const FALLBACK_1_IV = hexToBytes("31695248214b26747a33686225625377");

const FALLBACK_2_KEY = utf8ToBytes("6ayJ7jo@ao#pxVc%");
const FALLBACK_2_IV = utf8ToBytes("HsjJTCA7jJztpL2w");

export const SPORTZX_CRYPTO_KEYS = {
  fallback1: { key: FALLBACK_1_KEY, iv: FALLBACK_1_IV },
  fallback2: { key: FALLBACK_2_KEY, iv: FALLBACK_2_IV },
} as const;

function rotl32(v: number, c: number): number {
  return ((v << c) | (v >>> (32 - c))) >>> 0;
}

function qr(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  let xa = x[a]!;
  let xb = x[b]!;
  let xc = x[c]!;
  let xd = x[d]!;
  xa = (xa + xb) >>> 0;
  xd = rotl32(xd ^ xa, 13);
  xc = (xc + xd) >>> 0;
  xb = rotl32(xb ^ xc, 17);
  xa = (xa + xb) >>> 0;
  xd = rotl32(xd ^ xa, 9);
  xc = (xc + xd) >>> 0;
  xb = rotl32(xb ^ xc, 25);
  x[a] = xa;
  x[b] = xb;
  x[c] = xc;
  x[d] = xd;
}

function sxrPermute(state: Uint32Array): void {
  for (let i = 0; i < 10; i++) {
    qr(state, 0, 4, 8, 12);
    qr(state, 1, 5, 9, 13);
    qr(state, 2, 6, 10, 14);
    qr(state, 3, 7, 11, 15);
    qr(state, 0, 5, 10, 15);
    qr(state, 1, 6, 11, 12);
    qr(state, 2, 7, 8, 13);
    qr(state, 3, 4, 9, 14);
  }
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function writeU32LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >>> 8) & 0xff;
  out[offset + 2] = (value >>> 16) & 0xff;
  out[offset + 3] = (value >>> 24) & 0xff;
}

class SxrSponge {
  private readonly state = new Uint32Array(16);
  private readonly buf = new Uint8Array(32);
  private pos = 0;

  constructor() {
    for (let i = 0; i < 16; i++) {
      this.state[i] = Math.imul(0x9e3779b9, i + 1) >>> 0;
    }
  }

  private absorbBlock(block: Uint8Array): void {
    for (let i = 0; i < 8; i++) {
      this.state[i] = (this.state[i]! ^ readU32LE(block, i * 4)) >>> 0;
    }
    sxrPermute(this.state);
  }

  update(data: Uint8Array): this {
    let offset = 0;
    while (offset < data.length) {
      const take = Math.min(32 - this.pos, data.length - offset);
      this.buf.set(data.subarray(offset, offset + take), this.pos);
      this.pos += take;
      offset += take;
      if (this.pos === 32) {
        this.absorbBlock(this.buf);
        this.pos = 0;
      }
    }
    return this;
  }

  squeeze(outLen: number): Uint8Array {
    this.buf[this.pos] = 0x80;
    for (let i = this.pos + 1; i < 32; i++) {
      this.buf[i] = 0;
    }
    this.absorbBlock(this.buf);
    this.pos = 0;

    const out = new Uint8Array(outLen);
    let written = 0;
    while (written < outLen) {
      const block = new Uint8Array(32);
      for (let i = 0; i < 8; i++) {
        writeU32LE(block, i * 4, this.state[i]!);
      }
      const take = Math.min(32, outLen - written);
      out.set(block.subarray(0, take), written);
      written += take;
      if (written < outLen) {
        sxrPermute(this.state);
      }
    }
    return out;
  }
}

function sxrPrf(key: Uint8Array, label: Uint8Array, outLen: number): Uint8Array {
  return new SxrSponge().update(key).update(label).squeeze(outLen);
}

function sxrStreamXor(
  data: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  initialCounter: number
): Uint8Array {
  const out = new Uint8Array(data.length);
  const blockBytes = new Uint8Array(64);
  let counter = initialCounter >>> 0;

  for (let offset = 0; offset < data.length; offset += 64) {
    const init = new Uint32Array(16);
    init[0] = SXR_CONSTS[0]!;
    init[1] = SXR_CONSTS[1]!;
    init[2] = SXR_CONSTS[2]!;
    init[3] = SXR_CONSTS[3]!;
    for (let i = 0; i < 8; i++) {
      init[4 + i] = readU32LE(key, i * 4);
    }
    init[12] = counter;
    init[13] = readU32LE(nonce, 0);
    init[14] = readU32LE(nonce, 4);
    init[15] = readU32LE(nonce, 8);

    const working = new Uint32Array(init);
    sxrPermute(working);

    for (let i = 0; i < 16; i++) {
      writeU32LE(blockBytes, i * 4, (working[i]! + init[i]!) >>> 0);
    }

    const take = Math.min(64, data.length - offset);
    for (let i = 0; i < take; i++) {
      out[offset + i] = data[offset + i]! ^ blockBytes[i]!;
    }
    counter = (counter + 1) >>> 0;
  }

  return out;
}

function deriveV3Keys(salt: Uint8Array): { streamKey: Uint8Array; macKey: Uint8Array } {
  const prk = new SxrSponge()
    .update(V3_SXR_LABEL)
    .update(CTX_HASH)
    .update(V3_PEPPER)
    .update(salt)
    .squeeze(32);
  const streamKey = sxrPrf(prk, new Uint8Array([1]), 32);
  const macKey = sxrPrf(prk, new Uint8Array([2]), 32);
  return { streamKey, macKey };
}

export function decryptSportzxV3Bytes(raw: Uint8Array): string | null {
  if (raw.length < 45 || raw[0] !== 0x03) {
    return null;
  }
  const header = raw.subarray(0, 29);
  const salt = raw.subarray(1, 17);
  const nonce = raw.subarray(17, 29);
  const { streamKey, macKey } = deriveV3Keys(salt);

  // Layout A (Production Dalvik classes.dex): 0x03 || salt[16] || nonce[12] || ct || tag[16], counter=0
  const ctDex = raw.subarray(29, raw.length - 16);
  const tagDex = raw.subarray(raw.length - 16);
  const expectedDex = new SxrSponge()
    .update(macKey)
    .update(header)
    .update(ctDex)
    .update(macKey)
    .squeeze(16);
  if (constantTimeEqual(tagDex, expectedDex)) {
    return bytesToUtf8(sxrStreamXor(ctDex, streamKey, nonce, 0)).trim();
  }

  // Layout B (Legacy / synthetic layout): 0x03 || salt[16] || nonce[12] || tag[16] || ct, counter=1
  const tagLegacy = raw.subarray(29, 45);
  const ctLegacy = raw.subarray(45);
  const expectedLegacy = new SxrSponge()
    .update(macKey)
    .update(header)
    .update(ctLegacy)
    .squeeze(16);
  if (constantTimeEqual(tagLegacy, expectedLegacy)) {
    return bytesToUtf8(sxrStreamXor(ctLegacy, streamKey, nonce, 1)).trim();
  }

  return null;
}

export function encryptSportzxV3Bytes(
  plaintext: string,
  salt: Uint8Array,
  nonce: Uint8Array,
  layout: "dex" | "legacy" = "dex"
): Uint8Array {
  if (salt.length !== 16 || nonce.length !== 12) {
    throw new Error("Sportzx V3 requires 16-byte salt and 12-byte nonce");
  }
  const header = concatBytes(new Uint8Array([0x03]), salt, nonce);
  const { streamKey, macKey } = deriveV3Keys(salt);
  const ptBytes = utf8ToBytes(plaintext);

  if (layout === "dex") {
    const ct = sxrStreamXor(ptBytes, streamKey, nonce, 0);
    const tag = new SxrSponge().update(macKey).update(header).update(ct).update(macKey).squeeze(16);
    return concatBytes(header, ct, tag);
  }

  const ct = sxrStreamXor(ptBytes, streamKey, nonce, 1);
  const tag = new SxrSponge().update(macKey).update(header).update(ct).squeeze(16);
  return concatBytes(header, tag, ct);
}

export async function decryptSportzxPayload(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const candidate = unwrapSingleDataEnvelope(trimmed);
  if (isValidJsonOrM3u(candidate)) return candidate;

  try {
    const decoded = base64ToBytes(candidate);
    const v3 = decryptSportzxV3Bytes(decoded);
    if (v3 && isValidJsonOrM3u(v3)) {
      return v3;
    }
  } catch {
    // Fall through to AES fallbacks
  }

  for (const attempt of [
    { key: FALLBACK_1_KEY, iv: FALLBACK_1_IV },
    { key: FALLBACK_2_KEY, iv: FALLBACK_2_IV },
  ]) {
    const dec = await decryptBase64AesCbc(candidate, attempt.key, attempt.iv);
    if (dec && isValidJsonOrM3u(dec)) {
      return dec;
    }
  }

  return trimmed;
}
