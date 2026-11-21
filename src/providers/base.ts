import { safeFetchWithRedirects } from "../streaming/ssrf";

export function sanitizeField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined" || trimmed === "N/A") {
    return undefined;
  }
  return trimmed;
}

export function sanitizeUrl(value: unknown): string | undefined {
  const s = sanitizeField(value);
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  return undefined;
}

/**
 * Parses heterogeneous CS3 provider date/time formats:
 * - Unix seconds / milliseconds epochs
 * - ISO-8601 strings
 * - DD/MM/YYYY + HH:mm(:ss) or DD-MM-YYYY + HH:mm(:ss)
 * - YYYY-MM-DD HH:mm:ss
 */
export function parseProviderDateTime(
  rawDate?: unknown,
  rawTime?: unknown
): string | undefined {
  if (typeof rawDate === "number" && Number.isFinite(rawDate)) {
    const ms = rawDate > 1e12 ? rawDate : rawDate > 1e9 ? rawDate * 1000 : NaN;
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }

  const dateStr = sanitizeField(rawDate) ?? "";
  const timeStr = sanitizeField(rawTime) ?? "";

  if (!dateStr && !timeStr) return undefined;

  // Numeric epoch string
  if (/^\d{10,13}$/.test(dateStr)) {
    const n = Number.parseInt(dateStr, 10);
    const ms = dateStr.length === 13 ? n : n * 1000;
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }

  const combined = timeStr && !dateStr.includes(":") ? `${dateStr} ${timeStr}`.trim() : dateStr || timeStr;

  // DD/MM/YYYY or DD-MM-YYYY with optional HH:mm(:ss) (AM/PM)
  const dmy = combined.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i
  );
  if (dmy) {
    const day = Number.parseInt(dmy[1]!, 10);
    const month = Number.parseInt(dmy[2]!, 10);
    const year = Number.parseInt(dmy[3]!, 10);
    let hour = dmy[4] ? Number.parseInt(dmy[4], 10) : 0;
    const min = dmy[5] ? Number.parseInt(dmy[5], 10) : 0;
    const sec = dmy[6] ? Number.parseInt(dmy[6], 10) : 0;
    const ampm = dmy[7]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dt = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
      if (!Number.isNaN(dt.getTime())) return dt.toISOString();
    }
  }

  // Standard ISO or YYYY-MM-DD HH:mm:ss
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(combined)
    ? `${combined.replace(" ", "T")}Z`
    : combined;
  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return undefined;
}

/**
 * Splits CS3/ExoPlayer pipe-header URLs (`https://cdn.example/live.m3u8|Referer=https://x&User-Agent=UA`).
 * Also normalizes over-encoded `%2F` path segments without corrupting query strings.
 */
export function parsePipeHeadersUrl(raw: string): {
  url: string;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const trimmed = raw.trim();
  const pipeIdx = trimmed.indexOf("|");
  let baseUrl = pipeIdx >= 0 ? trimmed.slice(0, pipeIdx).trim() : trimmed;
  const headerPart = pipeIdx >= 0 ? trimmed.slice(pipeIdx + 1).trim() : "";

  // Fix %2F in URL path if accidentally encoded
  if (/^https?:\/\//i.test(baseUrl)) {
    const qIdx = baseUrl.indexOf("?");
    const pathPart = qIdx >= 0 ? baseUrl.slice(0, qIdx) : baseUrl;
    const queryPart = qIdx >= 0 ? baseUrl.slice(qIdx) : "";
    if (pathPart.includes("%2F") || pathPart.includes("%2f")) {
      baseUrl = pathPart.replace(/%2[fF]/g, "/") + queryPart;
    }
  }

  if (headerPart) {
    const pairs = headerPart.split("&");
    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const k = decodeSafe(pair.slice(0, eq).trim());
      const v = decodeSafe(pair.slice(eq + 1).trim());
      if (k && v) {
        headers[normalizeHeaderName(k)] = v;
      }
    }
  }

  return { url: baseUrl, headers };
}

function decodeSafe(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function normalizeHeaderName(key: string): string {
  const lower = key.toLowerCase();
  if (lower === "user-agent" || lower === "ua" || lower === "useragent") return "User-Agent";
  if (lower === "referer" || lower === "referrer") return "Referer";
  if (lower === "origin") return "Origin";
  if (lower === "cookie") return "Cookie";
  if (lower === "authorization") return "Authorization";
  return key;
}

/**
 * Unwraps nested stringified JSON envelopes used by SKTech, PlayZTV, and LivXow:
 * e.g. `[{"event":"{\"title\":\"...\"}"}]`, `[{"cat":"..."}]`, `[{"channel":"..."}]`.
 */
export function unwrapNestedRecords(
  parsed: unknown,
  wrapperKeys: readonly string[] = ["event", "cat", "channel", "data", "item"]
): Record<string, unknown>[] {
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? extractFirstArray(parsed as Record<string, unknown>)
      : [];

  const out: Record<string, unknown>[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    let unwrapped: Record<string, unknown> | null = null;
    for (const wk of wrapperKeys) {
      const val = rec[wk];
      if (typeof val === "string" && (val.trim().startsWith("{") || val.trim().startsWith("["))) {
        try {
          const inner: unknown = JSON.parse(val);
          if (inner && typeof inner === "object" && !Array.isArray(inner)) {
            unwrapped = inner as Record<string, unknown>;
            break;
          }
        } catch {
          // keep original record
        }
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        unwrapped = val as Record<string, unknown>;
        break;
      }
    }
    out.push(unwrapped ?? rec);
  }
  return out;
}

function extractFirstArray(obj: Record<string, unknown>): unknown[] {
  for (const key of ["events", "matches", "channels", "categories", "data", "items", "list"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

/**
 * Non-self-sabotaging candidate fetcher:
 * Never aborts or pre-probes with HEAD; fetches candidate domain + path directly,
 * applies the provider's decryption cascade, and stops on first valid payload.
 */
export async function fetchDecryptedFromCandidates(params: {
  domains: readonly string[];
  paths: readonly string[];
  userAgent: string;
  timeoutMs: number;
  decrypt: (raw: string) => Promise<string>;
  validate?: (decrypted: string) => boolean;
}): Promise<{ domain: string; path: string; text: string } | null> {
  const uniqueDomains = [...new Set(params.domains.map((d) => d.replace(/\/+$/, "")).filter(Boolean))];
  const validator =
    params.validate ??
    ((txt: string) => {
      const t = txt.trim();
      return t.startsWith("{") || t.startsWith("[") || t.startsWith("#EXTM3U") || t.startsWith("#EXTINF");
    });

  for (const domain of uniqueDomains) {
    for (const path of params.paths) {
      const targetUrl = path.startsWith("http") ? path : `${domain}${path.startsWith("/") ? path : `/${path}`}`;
      try {
        const { response } = await safeFetchWithRedirects(targetUrl, {
          headers: {
            "User-Agent": params.userAgent,
            Accept: "*/*",
          },
          timeoutMs: params.timeoutMs,
          maxRedirects: 3,
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          continue;
        }
        const raw = await response.text();
        if (!raw.trim()) continue;
        const decrypted = await params.decrypt(raw);
        if (validator(decrypted)) {
          return { domain, path, text: decrypted };
        }
      } catch {
        // Failover cleanly to next candidate
      }
    }
  }
  return null;
}
