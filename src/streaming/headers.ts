const SENSITIVE_HEADER_KEYS = new Set<string>([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "x-secret",
]);

const ALLOWED_PROXY_FORWARD_HEADERS = new Set<string>([
  "user-agent",
  "referer",
  "origin",
  "range",
  "accept",
  "accept-language",
]);

export const SIGNED_CDN_QUERY_PARAMS = new Set<string>([
  "hdnts",
  "hdnea",
  "token",
  "access_token",
  "sig",
  "signature",
  "hmac",
  "auth",
  "policy",
  "key-pair-id",
  "expires",
  "exp",
  "st",
  "e",
  "md5",
  "hash",
  "wmsauthsign",
]);

export interface SanitizedHeaderResult {
  publicHeaders: Record<string, string>;
  hasRedactedAuth: boolean;
}

/**
 * Strips all credential/session headers (Authorization, Cookie, Set-Cookie, X-Api-Key, etc.)
 * before exposing stream headers in public JSON responses.
 */
export function redactSensitiveHeadersForPublicJson(
  rawHeaders: Record<string, string> | undefined
): SanitizedHeaderResult {
  const publicHeaders: Record<string, string> = {};
  let hasRedactedAuth = false;

  if (!rawHeaders) {
    return { publicHeaders, hasRedactedAuth };
  }

  for (const [key, value] of Object.entries(rawHeaders)) {
    const cleanKey = key.trim();
    const lower = cleanKey.toLowerCase();
    const cleanVal = value.trim();
    if (!cleanKey || !cleanVal) continue;

    if (SENSITIVE_HEADER_KEYS.has(lower) || lower.includes("token") || lower.includes("secret")) {
      hasRedactedAuth = true;
      continue;
    }

    if (ALLOWED_PROXY_FORWARD_HEADERS.has(lower)) {
      publicHeaders[cleanKey] = cleanVal;
    }
  }

  return { publicHeaders, hasRedactedAuth };
}

/**
 * Builds outbound upstream headers using a strict allowlist (never blindly forwarding client cookies/auth).
 */
export function buildAllowlistedUpstreamHeaders(input: {
  referer?: string;
  origin?: string;
  userAgent?: string;
  range?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": input.userAgent?.trim() || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "*/*",
  };

  if (input.referer?.trim()) {
    headers["Referer"] = input.referer.trim();
  }
  if (input.origin?.trim()) {
    headers["Origin"] = input.origin.trim();
  } else if (input.referer?.trim()) {
    try {
      headers["Origin"] = new URL(input.referer.trim()).origin;
    } catch {
      // ignore invalid referer
    }
  }
  if (input.range?.trim()) {
    headers["Range"] = input.range.trim();
  }

  return headers;
}

/**
 * Inherits signed CDN query tokens (Akamai hdnts/hdnea, CloudFront Policy/Signature/Key-Pair-Id,
 * Wowza wmsAuthSign, etc.) from a parent manifest URL onto a resolved child playlist/segment URL
 * when the child URL does not already carry that parameter.
 */
export function inheritSignedCdnQueryParams(parentUrl: string, childUrl: string): string {
  try {
    const parent = new URL(parentUrl);
    const child = new URL(childUrl, parent);

    for (const [k, v] of parent.searchParams.entries()) {
      if (SIGNED_CDN_QUERY_PARAMS.has(k.toLowerCase()) && !child.searchParams.has(k)) {
        child.searchParams.set(k, v);
      }
    }
    return child.toString();
  } catch {
    return childUrl;
  }
}

export function stripSensitiveResponseHeaders(upstream: Headers): Headers {
  const clean = new Headers();
  upstream.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      SENSITIVE_HEADER_KEYS.has(lower) ||
      lower === "transfer-encoding" ||
      lower === "connection" ||
      lower === "content-encoding" ||
      lower === "content-length"
    ) {
      return;
    }
    clean.set(key, value);
  });
  return clean;
}
