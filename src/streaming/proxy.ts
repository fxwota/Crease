import type { CreaseEnv } from "../config/env";
import { getProviderByCustomScheme } from "../providers/registry";
import {
  buildAllowlistedUpstreamHeaders,
  inheritSignedCdnQueryParams,
  stripSensitiveResponseHeaders,
} from "./headers";
import { safeFetchWithRedirects, SsrfBlockedError } from "./ssrf";

export interface ProxyRequestInput {
  targetUrl: string;
  fallbackUrl?: string;
  quality?: string;
  referer?: string;
  origin?: string;
  userAgent?: string;
  range?: string;
  proxyOrigin: string;
  env: CreaseEnv | undefined;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function buildProxyLink(
  proxyOrigin: string,
  targetUrl: string,
  opts?: { referer?: string; origin?: string; userAgent?: string; quality?: string }
): string {
  const params = new URLSearchParams();
  params.set("url", targetUrl);
  if (opts?.referer) params.set("referer", opts.referer);
  if (opts?.origin) params.set("origin", opts.origin);
  if (opts?.userAgent) params.set("ua", opts.userAgent);
  if (opts?.quality) params.set("quality", opts.quality);
  return `${proxyOrigin}/api/v1/proxy?${params.toString()}`;
}

function parseRequestedHeight(quality?: string): number | null {
  if (!quality) return null;
  const lower = quality.trim().toLowerCase();
  if (lower === "auto" || lower === "best") return null;
  if (lower === "4k" || lower === "uhd") return 2160;
  if (lower === "fhd") return 1080;
  if (lower === "hd") return 720;
  if (lower === "sd") return 480;
  if (lower === "low") return 360;
  const num = Number.parseInt(lower.replace(/p$/i, ""), 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function rewriteHlsPlaylistForProxy(params: {
  playlistText: string;
  baseUrl: string;
  proxyOrigin: string;
  referer?: string;
  origin?: string;
  userAgent?: string;
  quality?: string;
}): string {
  const targetHeight = parseRequestedHeight(params.quality);
  const lines = params.playlistText.split(/\r?\n/);

  const proxyOpts: { referer?: string; origin?: string; userAgent?: string } = {};
  if (params.referer) proxyOpts.referer = params.referer;
  if (params.origin) proxyOpts.origin = params.origin;
  if (params.userAgent) proxyOpts.userAgent = params.userAgent;

  const rewriteUri = (rawUri: string): string => {
    const inherited = inheritSignedCdnQueryParams(params.baseUrl, rawUri.trim());
    return buildProxyLink(params.proxyOrigin, inherited, proxyOpts);
  };

  // Optional HLS master variant quality filter
  if (targetHeight !== null && params.playlistText.includes("#EXT-X-STREAM-INF:")) {
    interface Variant {
      infLine: string;
      uriLine: string;
      height: number;
    }
    const headerLines: string[] = [];
    const variants: Variant[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim().startsWith("#EXT-X-STREAM-INF:")) {
        const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
        const height = resMatch?.[1] ? Number.parseInt(resMatch[1], 10) : 720;
        const uriLine = (lines[i + 1] ?? "").trim();
        if (uriLine && !uriLine.startsWith("#")) {
          variants.push({ infLine: line, uriLine, height });
          i++;
          continue;
        }
      }
      headerLines.push(line);
    }

    if (variants.length > 0) {
      let best = variants[0]!;
      let bestDiff = Math.abs(best.height - targetHeight);
      for (const v of variants) {
        const diff = Math.abs(v.height - targetHeight);
        if (diff < bestDiff) {
          best = v;
          bestDiff = diff;
        }
      }

      const rewrittenHeader = headerLines.map((l) => rewriteInlineUris(l, rewriteUri));
      return [...rewrittenHeader, best.infLine, rewriteUri(best.uriLine)].join("\n");
    }
  }

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return rewriteInlineUris(line, rewriteUri);
      }
      return rewriteUri(trimmed);
    })
    .join("\n");
}

function rewriteInlineUris(line: string, rewriter: (uri: string) => string): string {
  return line.replace(/URI="([^"]+)"/gi, (_full, uri: string) => `URI="${rewriter(uri)}"`);
}

export function filterDashMpdByQuality(mpdText: string, quality?: string): string {
  const targetHeight = parseRequestedHeight(quality);
  if (targetHeight === null) return mpdText;

  const repPattern = /<Representation\b[^>]*height="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/Representation>)/gi;
  const reps = [...mpdText.matchAll(repPattern)];
  if (reps.length <= 1) return mpdText;

  let bestHeight = Number.parseInt(reps[0]![1]!, 10);
  let bestDiff = Math.abs(bestHeight - targetHeight);
  for (const m of reps) {
    const h = Number.parseInt(m[1]!, 10);
    const diff = Math.abs(h - targetHeight);
    if (diff < bestDiff) {
      bestHeight = h;
      bestDiff = diff;
    }
  }

  return mpdText.replace(repPattern, (full, hStr: string) => {
    const h = Number.parseInt(hStr, 10);
    return h === bestHeight ? full : "";
  });
}

async function resolveIfCustomScheme(
  rawUrl: string,
  env: CreaseEnv | undefined,
  timeoutMs: number
): Promise<{ url: string; headers: Record<string, string> }> {
  const adapter = getProviderByCustomScheme(rawUrl);
  if (!adapter) {
    return { url: rawUrl, headers: {} };
  }
  const streams = await adapter.resolveCustomScheme(rawUrl, env, timeoutMs);
  const firstHttp = streams.find((s) => /^https?:\/\//i.test(s.url));
  if (!firstHttp) {
    throw new Error(`Unable to resolve custom scheme '${adapter.descriptor.customScheme}' to a playable HTTP stream`);
  }
  return {
    url: firstHttp.url,
    headers: firstHttp.headers ?? {},
  };
}

export async function handleEdgeStreamProxy(input: ProxyRequestInput): Promise<Response> {
  const timeoutMs = input.timeoutMs ?? 6000;
  const targets = [input.targetUrl, ...(input.fallbackUrl ? [input.fallbackUrl] : [])];
  let lastError: Error | null = null;

  for (const rawTarget of targets) {
    try {
      const resolved = await resolveIfCustomScheme(rawTarget, input.env, timeoutMs);
      const effectiveReferer = input.referer ?? resolved.headers["Referer"];
      const effectiveOrigin = input.origin ?? resolved.headers["Origin"];
      const effectiveUa = input.userAgent ?? resolved.headers["User-Agent"];

      const headerInput: { referer?: string; origin?: string; userAgent?: string; range?: string } = {};
      if (effectiveReferer) headerInput.referer = effectiveReferer;
      if (effectiveOrigin) headerInput.origin = effectiveOrigin;
      if (effectiveUa) headerInput.userAgent = effectiveUa;
      if (input.range) headerInput.range = input.range;
      const upstreamHeaders = buildAllowlistedUpstreamHeaders(headerInput);

      const safeOpts: {
        headers: Record<string, string>;
        timeoutMs: number;
        maxRedirects: number;
        fetchImpl?: typeof fetch;
      } = {
        headers: upstreamHeaders,
        timeoutMs,
        maxRedirects: 5,
      };
      if (input.fetchImpl) safeOpts.fetchImpl = input.fetchImpl;

      const { response, finalUrl } = await safeFetchWithRedirects(resolved.url, safeOpts);

      if (!response.ok && targets.length > 1) {
        await response.body?.cancel().catch(() => {});
        lastError = new Error(`Upstream HTTP ${response.status}`);
        continue;
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      const isHls =
        finalUrl.toLowerCase().includes(".m3u8") ||
        contentType.includes("mpegurl") ||
        contentType.includes("vnd.apple.mpegurl");
      const isDash =
        finalUrl.toLowerCase().includes(".mpd") || contentType.includes("dash+xml");

      const outHeaders = stripSensitiveResponseHeaders(response.headers);
      outHeaders.set("Access-Control-Allow-Origin", "*");
      outHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      outHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type");
      outHeaders.set("X-Content-Type-Options", "nosniff");

      if (isHls) {
        const text = await response.text();
        const rewriteOpts: {
          playlistText: string;
          baseUrl: string;
          proxyOrigin: string;
          referer?: string;
          origin?: string;
          userAgent?: string;
          quality?: string;
        } = {
          playlistText: text,
          baseUrl: finalUrl,
          proxyOrigin: input.proxyOrigin,
        };
        if (effectiveReferer) rewriteOpts.referer = effectiveReferer;
        if (effectiveOrigin) rewriteOpts.origin = effectiveOrigin;
        if (effectiveUa) rewriteOpts.userAgent = effectiveUa;
        if (input.quality) rewriteOpts.quality = input.quality;

        const rewritten = rewriteHlsPlaylistForProxy(rewriteOpts);
        outHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        outHeaders.set("Cache-Control", "public, max-age=4");
        return new Response(rewritten, { status: response.status, headers: outHeaders });
      }

      if (isDash) {
        const text = await response.text();
        const filtered = filterDashMpdByQuality(text, input.quality);
        outHeaders.set("Content-Type", "application/dash+xml; charset=utf-8");
        outHeaders.set("Cache-Control", "public, max-age=4");
        return new Response(filtered, { status: response.status, headers: outHeaders });
      }

      // Binary media segments stream directly through without buffering in Worker memory
      outHeaders.set("Cache-Control", "public, max-age=30");
      return new Response(response.body, { status: response.status, headers: outHeaders });
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error("Upstream proxy request failed");
    }
  }

  throw lastError ?? new Error("Proxy request failed");
}
