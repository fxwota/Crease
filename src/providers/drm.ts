import { base64ToBytes, bytesToBase64Url, bytesToHex, hexToBytes } from "../crypto/bytes";
import type { ClearKeyConfig } from "../domain/types";
import { safeFetchWithRedirects } from "../streaming/ssrf";

export function normalizeHexKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // UUID or 32-char hex
  const hexOnly = trimmed.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(hexOnly)) {
    return hexOnly.toLowerCase();
  }

  // Base64 or Base64URL encoding of 16 bytes
  try {
    const bytes = base64ToBytes(trimmed);
    if (bytes.length === 16) {
      return bytesToHex(bytes);
    }
  } catch {
    // not base64
  }

  return null;
}

export function hexToBase64UrlKey(hex: string): string {
  return bytesToBase64Url(hexToBytes(hex));
}

/**
 * Parses ClearKey inputs in any CS3/Kodi format:
 * - `kid:key` (hex, UUID, or Base64URL)
 * - W3C ClearKey JSON `{ "keys": [{ "kty": "oct", "kid": "...", "k": "..." }] }`
 * - Flat multi-KID JSON map `{ "<kid>": "<key>", ... }`
 * - ClearKey license URL `https://...`
 */
export function parseClearKeySpec(rawSpec: string | undefined): ClearKeyConfig | undefined {
  if (!rawSpec) return undefined;
  const trimmed = rawSpec.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return { kid: "", key: "", licenseUrl: trimmed };
  }

  // JSON forms (W3C JWK set or flat map)
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const keysMap: Record<string, string> = {};

        if (Array.isArray(obj["keys"])) {
          for (const item of obj["keys"]) {
            if (!item || typeof item !== "object") continue;
            const entry = item as Record<string, unknown>;
            const kid = typeof entry["kid"] === "string" ? normalizeHexKey(entry["kid"]) : null;
            const key = typeof entry["k"] === "string" ? normalizeHexKey(entry["k"]) : null;
            if (kid && key) keysMap[kid] = key;
          }
        } else {
          for (const [rawKid, rawKey] of Object.entries(obj)) {
            if (typeof rawKey !== "string") continue;
            const kid = normalizeHexKey(rawKid);
            const key = normalizeHexKey(rawKey);
            if (kid && key) keysMap[kid] = key;
          }
        }

        const firstEntry = Object.entries(keysMap)[0];
        if (firstEntry) {
          return {
            kid: firstEntry[0],
            key: firstEntry[1],
            keysMap,
          };
        }
      }
    } catch {
      return undefined;
    }
  }

  // Colon-delimited `kid:key` (or comma-separated multiple pairs)
  const pairs = trimmed.split(/[\s,;]+/).filter(Boolean);
  const keysMap: Record<string, string> = {};
  for (const pair of pairs) {
    const colon = pair.indexOf(":");
    if (colon <= 0) continue;
    const kid = normalizeHexKey(pair.slice(0, colon));
    const key = normalizeHexKey(pair.slice(colon + 1));
    if (kid && key) keysMap[kid] = key;
  }

  const first = Object.entries(keysMap)[0];
  if (!first) return undefined;
  return {
    kid: first[0],
    key: first[1],
    keysMap,
  };
}

/**
 * Resolves W3C ClearKey license POST against an external ClearKey server given extracted MPD KIDs.
 */
export async function resolveDynamicClearKeyLicense(
  licenseUrl: string,
  kidsHex: readonly string[],
  timeoutMs = 3500
): Promise<ClearKeyConfig | undefined> {
  if (!kidsHex.length) return undefined;
  const kidsB64 = kidsHex
    .map((k) => normalizeHexKey(k))
    .filter((k): k is string => k !== null)
    .map(hexToBase64UrlKey);
  if (!kidsB64.length) return undefined;

  try {
    const { response } = await safeFetchWithRedirects(licenseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ kids: kidsB64, type: "temporary" }),
      timeoutMs,
      maxRedirects: 2,
    });
    if (!response.ok) return undefined;
    const body = await response.text();
    const parsed = parseClearKeySpec(body);
    if (parsed) {
      return { ...parsed, licenseUrl };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
