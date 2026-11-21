export interface SsrfValidationResult {
  safe: boolean;
  reason?: string;
  normalizedUrl?: string;
}

const BLOCKED_HOSTNAMES = new Set<string>([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "169.254.169.254",
  "100.100.100.200",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".arpa",
  ".home.arpa",
];

function parseIpv4Part(part: string): number | null {
  if (!part) return null;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    const val = Number.parseInt(part.slice(2), 16);
    return Number.isFinite(val) ? val : null;
  }
  if (/^0[0-7]+$/.test(part)) {
    const val = Number.parseInt(part, 8);
    return Number.isFinite(val) ? val : null;
  }
  if (/^\d+$/.test(part)) {
    const val = Number.parseInt(part, 10);
    return Number.isFinite(val) ? val : null;
  }
  return null;
}

/**
 * Parses standard dotted-quad, octal, hex, decimal-integer, and shorthand IPv4 literals
 * into a 32-bit unsigned integer so alternate IP encodings cannot bypass SSRF rules.
 */
export function parseIpv4Literal(hostname: string): number | null {
  const clean = hostname.replace(/\.$/, "");
  if (!clean) return null;

  const parts = clean.split(".");
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const part of parts) {
    const parsed = parseIpv4Part(part);
    if (parsed === null || parsed < 0) return null;
    nums.push(parsed);
  }

  if (nums.length === 1) {
    const v = nums[0]!;
    return v <= 0xffffffff ? v >>> 0 : null;
  }
  if (nums.length === 2) {
    const [a, b] = nums as [number, number];
    if (a > 0xff || b > 0xffffff) return null;
    return (((a << 24) >>> 0) | b) >>> 0;
  }
  if (nums.length === 3) {
    const [a, b, c] = nums as [number, number, number];
    if (a > 0xff || b > 0xff || c > 0xffff) return null;
    return (((a << 24) >>> 0) | (b << 16) | c) >>> 0;
  }
  const [a, b, c, d] = nums as [number, number, number, number];
  if (a > 0xff || b > 0xff || c > 0xff || d > 0xff) return null;
  return (((a << 24) >>> 0) | (b << 16) | (c << 8) | d) >>> 0;
}

export function isReservedIpv4Int(ip: number): boolean {
  const a = (ip >>> 24) & 0xff;
  const b = (ip >>> 16) & 0xff;
  const c = (ip >>> 8) & 0xff;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8 RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved
  return false;
}

function isReservedIpv6(rawHost: string): boolean {
  const stripped = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1).toLowerCase()
    : rawHost.toLowerCase();

  // Strip zone ID if present (e.g. fe80::1%eth0)
  const host = stripped.split("%")[0] ?? "";
  if (!host.includes(":")) return false;

  if (host === "::" || host === "::1" || /^0*:0*:0*:0*:0*:0*:0*:[01]$/.test(host)) {
    return true;
  }

  // IPv4-mapped IPv6 in dotted form (::ffff:127.0.0.1) or hex form (::ffff:7f00:0001)
  const mappedDotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedDotted?.[1]) {
    const ipv4 = parseIpv4Literal(mappedDotted[1]);
    return ipv4 === null ? true : isReservedIpv4Int(ipv4);
  }
  const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHex?.[1] && mappedHex[2]) {
    const hi = Number.parseInt(mappedHex[1], 16);
    const lo = Number.parseInt(mappedHex[2], 16);
    const ipv4 = (((hi << 16) >>> 0) | lo) >>> 0;
    return isReservedIpv4Int(ipv4);
  }

  // 6to4 (2002::/16) embedding an IPv4 address
  const sixToFour = host.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})/i);
  if (sixToFour?.[1] && sixToFour[2]) {
    const hi = Number.parseInt(sixToFour[1], 16);
    const lo = Number.parseInt(sixToFour[2], 16);
    const ipv4 = (((hi << 16) >>> 0) | lo) >>> 0;
    if (isReservedIpv4Int(ipv4)) return true;
  }

  // First hextet checks: fc00::/7 (ULA), fe80::/10 (link-local), fec0::/10 (site-local), ff00::/8 (multicast)
  const firstSegment = host.split(":")[0] ?? "";
  if (firstSegment) {
    const first = Number.parseInt(firstSegment, 16);
    if (Number.isFinite(first)) {
      if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
      if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
      if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
      if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    }
  }

  // Reject unspecified or loopback-prefixed ::0:x
  if (host.startsWith("0000:0000:0000:0000:0000:ffff:")) return true;

  return false;
}

export function validateUpstreamUrl(rawUrl: string): SsrfValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 4096) {
    return { safe: false, reason: "URL is empty or exceeds maximum length" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: "Malformed URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Disallowed URL scheme '${parsed.protocol}'` };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: "Embedded credentials in URL are prohibited" };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) {
    return { safe: false, reason: "URL missing hostname" };
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { safe: false, reason: `Blocked internal hostname '${host}'` };
  }

  for (const suffix of BLOCKED_SUFFIXES) {
    if (host.endsWith(suffix)) {
      return { safe: false, reason: `Blocked internal domain suffix '${suffix}'` };
    }
  }

  // Check IPv6 literal
  if (host.includes(":") || (host.startsWith("[") && host.endsWith("]"))) {
    if (isReservedIpv6(host)) {
      return { safe: false, reason: `Blocked private/reserved IPv6 address '${host}'` };
    }
    return { safe: true, normalizedUrl: parsed.toString() };
  }

  // Check standard & alternate IPv4 literals (decimal, octal, hex, shorthand)
  const ipv4 = parseIpv4Literal(host);
  if (ipv4 !== null) {
    if (isReservedIpv4Int(ipv4)) {
      return { safe: false, reason: `Blocked private/reserved IPv4 address '${host}'` };
    }
    return { safe: true, normalizedUrl: parsed.toString() };
  }

  // Require at least one dot for public DNS hostnames
  if (!host.includes(".")) {
    return { safe: false, reason: `Blocked single-label internal hostname '${host}'` };
  }

  return { safe: true, normalizedUrl: parsed.toString() };
}

export function isSafeUpstreamUrl(rawUrl: string): boolean {
  return validateUpstreamUrl(rawUrl).safe;
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
}

export interface SafeFetchResult {
  response: Response;
  finalUrl: string;
  redirectCount: number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Executes an SSRF-hardened fetch that manually validates every 3xx redirect hop
 * against validateUpstreamUrl() before following it.
 */
export async function safeFetchWithRedirects(
  initialUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const maxRedirects = Math.max(0, Math.min(8, options.maxRedirects ?? 5));
  const timeoutMs = Math.max(500, Math.min(15_000, options.timeoutMs ?? 6000));
  const fetcher = options.fetchImpl ?? fetch;

  let currentUrl = initialUrl;
  let redirectCount = 0;

  while (true) {
    const verdict = validateUpstreamUrl(currentUrl);
    if (!verdict.safe || !verdict.normalizedUrl) {
      throw new SsrfBlockedError(verdict.reason ?? "Blocked unsafe upstream URL");
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (options.headers) init.headers = options.headers;
    if (options.body !== undefined) init.body = options.body;

    const res = await fetcher(verdict.normalizedUrl, init);

    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        return { response: res, finalUrl: verdict.normalizedUrl, redirectCount };
      }
      if (redirectCount >= maxRedirects) {
        throw new Error(`Exceeded maximum redirect hops (${maxRedirects})`);
      }
      let nextUrl: string;
      try {
        nextUrl = new URL(location, verdict.normalizedUrl).toString();
      } catch {
        throw new SsrfBlockedError("Malformed redirect Location header");
      }
      // Drain/cancel redirect body before following
      try {
        await res.body?.cancel();
      } catch {
        // ignore cancel failure
      }
      currentUrl = nextUrl;
      redirectCount++;
      continue;
    }

    return { response: res, finalUrl: verdict.normalizedUrl, redirectCount };
  }
}

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}
