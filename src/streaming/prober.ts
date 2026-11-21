import { buildPlaybackCompatibility, detectStreamProtocol } from "../domain/stream-ranker";
import type { ManifestInspection } from "../domain/types";
import { buildAllowlistedUpstreamHeaders } from "./headers";
import { inspectManifestText, MAX_MANIFEST_INSPECT_BYTES } from "./manifest-parser";
import { safeFetchWithRedirects, SsrfBlockedError } from "./ssrf";

async function readUpToBytes(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return (await response.text()).slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function inspectRemoteManifest(params: {
  url: string;
  referer?: string;
  origin?: string;
  userAgent?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ManifestInspection> {
  const startedAt = Date.now();
  const hasCustomHeaders = Boolean(params.referer || params.origin || params.userAgent);
  const headerOpts: { referer?: string; origin?: string; userAgent?: string } = {};
  if (params.referer) headerOpts.referer = params.referer;
  if (params.origin) headerOpts.origin = params.origin;
  if (params.userAgent) headerOpts.userAgent = params.userAgent;
  const headers = buildAllowlistedUpstreamHeaders(headerOpts);

  try {
    const safeOpts: {
      headers: Record<string, string>;
      timeoutMs: number;
      maxRedirects: number;
      fetchImpl?: typeof fetch;
    } = {
      headers,
      timeoutMs: params.timeoutMs ?? 5000,
      maxRedirects: 5,
    };
    if (params.fetchImpl) safeOpts.fetchImpl = params.fetchImpl;

    const { response, finalUrl } = await safeFetchWithRedirects(params.url, safeOpts);

    const latencyMs = Math.max(1, Date.now() - startedAt);
    const contentType = response.headers.get("content-type") ?? undefined;

    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // ignore
      }
      const protocol = detectStreamProtocol(finalUrl, contentType);
      const out: ManifestInspection = {
        reachable: false,
        httpStatus: response.status,
        latencyMs,
        protocol,
        isMasterPlaylist: false,
        isLowLatency: false,
        encryption: "UNKNOWN",
        clearKeyKids: [],
        renditions: [],
        audioTracks: [],
        compatibility: buildPlaybackCompatibility({
          protocol,
          encryption: "UNKNOWN",
          hasCustomHeaders,
          isCustomScheme: false,
        }),
        bytesInspected: 0,
        error: `Upstream returned HTTP ${response.status}`,
      };
      if (contentType) out.contentType = contentType;
      return out;
    }

    const bodyText = await readUpToBytes(response, MAX_MANIFEST_INSPECT_BYTES);
    const inspectOpts: {
      text: string;
      url: string;
      httpStatus: number;
      latencyMs: number;
      contentType?: string;
      hasCustomHeaders: boolean;
    } = {
      text: bodyText,
      url: finalUrl,
      httpStatus: response.status,
      latencyMs,
      hasCustomHeaders,
    };
    if (contentType) inspectOpts.contentType = contentType;
    return inspectManifestText(inspectOpts);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      throw err;
    }
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const protocol = detectStreamProtocol(params.url);
    return {
      reachable: false,
      latencyMs,
      protocol,
      isMasterPlaylist: false,
      isLowLatency: false,
      encryption: "UNKNOWN",
      clearKeyKids: [],
      renditions: [],
      audioTracks: [],
      compatibility: buildPlaybackCompatibility({
        protocol,
        encryption: "UNKNOWN",
        hasCustomHeaders,
        isCustomScheme: false,
      }),
      bytesInspected: 0,
      error: err instanceof Error ? err.message : "Manifest probe failed",
    };
  }
}
