import { base64ToBytes, bytesToUtf8 } from "../crypto/bytes";
import { safeFetchWithRedirects } from "../streaming/ssrf";

const DEFAULT_IP_API = "https://ip-api.streamingucms.com/";

export interface TokenApiInput {
  type?: string;
  link?: string;
  api?: string;
  linkKey?: string;
  ipApi?: string;
  headers?: Record<string, string>;
}

export interface TokenApiResolved {
  url: string;
  headers: Record<string, string>;
}

function getByDotPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function decodeIpApiUrl(raw?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return DEFAULT_IP_API;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("aHR0")) {
    try {
      const decoded = bytesToUtf8(base64ToBytes(trimmed)).trim();
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      // fall through
    }
  }
  return DEFAULT_IP_API;
}

/**
 * Resolves CS3 dynamic token API endpoints (`embed`, `json`, `sp`, `html`, `yt`, `ls`)
 * safely through SSRF-hardened safeFetchWithRedirects.
 */
export async function resolveTokenApiStream(
  input: TokenApiInput,
  timeoutMs = 4500
): Promise<TokenApiResolved | null> {
  const mode = (input.type ?? "").trim().toLowerCase();
  const baseHeaders: Record<string, string> = {
    "User-Agent": "okhttp/4.12.0",
    Accept: "*/*",
    ...(input.headers ?? {}),
  };

  if (mode === "yt" && input.link) {
    const link = input.link.trim();
    if (/^https?:\/\//i.test(link)) {
      return { url: link, headers: baseHeaders };
    }
    return { url: `https://www.youtube.com/watch?v=${encodeURIComponent(link)}`, headers: baseHeaders };
  }

  if (mode === "ls" && input.link) {
    const ipEndpoint = decodeIpApiUrl(input.ipApi);
    let ipQuery = "";
    try {
      const { response } = await safeFetchWithRedirects(ipEndpoint, {
        headers: baseHeaders,
        timeoutMs: Math.min(timeoutMs, 2500),
        maxRedirects: 2,
      });
      if (response.ok) {
        const text = (await response.text()).trim();
        try {
          const parsed = JSON.parse(text) as { ip?: string; query?: string };
          ipQuery = parsed.ip ?? parsed.query ?? "";
        } catch {
          if (/^[0-9a-fA-F.:]+$/.test(text)) ipQuery = text;
        }
      }
    } catch {
      // Optional IP lookup failed; continue with direct link
    }
    const resolved = ipQuery && input.link.includes("{ip}")
      ? input.link.replace(/\{ip\}/g, encodeURIComponent(ipQuery))
      : input.link;
    return { url: resolved, headers: baseHeaders };
  }

  const target = (input.api ?? input.link ?? "").trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return null;
  }

  if (mode === "json" || mode === "sp" || input.linkKey) {
    try {
      const { response } = await safeFetchWithRedirects(target, {
        headers: baseHeaders,
        timeoutMs,
        maxRedirects: 3,
      });
      if (!response.ok) return null;
      const json: unknown = await response.json();
      const candidate = input.linkKey
        ? getByDotPath(json, input.linkKey)
        : getByDotPath(json, "url") ??
          getByDotPath(json, "link") ??
          getByDotPath(json, "stream_url") ??
          getByDotPath(json, "data.url") ??
          getByDotPath(json, "data.link");

      if (typeof candidate === "string" && /^https?:\/\//i.test(candidate.trim())) {
        return { url: candidate.trim(), headers: baseHeaders };
      }
    } catch {
      return null;
    }
  }

  if (mode === "html" || mode === "embed") {
    try {
      const { response } = await safeFetchWithRedirects(target, {
        headers: baseHeaders,
        timeoutMs,
        maxRedirects: 3,
      });
      if (!response.ok) return null;
      const html = await response.text();
      const match = html.match(/https?:\/\/[^"'\\\s<>]+\.(?:m3u8|mpd)(?:\?[^"'\\\s<>]*)?/i);
      if (match?.[0]) {
        return {
          url: match[0].replace(/\\\//g, "/"),
          headers: { ...baseHeaders, Referer: target },
        };
      }
    } catch {
      return null;
    }
  }

  return { url: target, headers: baseHeaders };
}
