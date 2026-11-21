import { Hono } from "hono";
import type { CreaseEnv } from "../../config/env";
import { InspectStreamQuerySchema, ProxyQuerySchema } from "../../domain/schemas";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import { inspectRemoteManifest } from "../../streaming/prober";
import { buildProxyLink, handleEdgeStreamProxy } from "../../streaming/proxy";
import { SsrfBlockedError } from "../../streaming/ssrf";
import { errorJson, getSafeExecutionCtx, okJson } from "../envelope";
import { findMatchByIdentifier } from "./matches";

export const streamsRoutes = new Hono<{ Bindings: CreaseEnv }>();

// GET /api/v1/streams/inspect
streamsRoutes.get("/streams/inspect", async (c) => {
  const parsed = InspectStreamQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Valid 'url' query parameter is required", parsed.error.flatten());
  }

  try {
    const opts: { url: string; referer?: string; origin?: string; userAgent?: string } = {
      url: parsed.data.url,
    };
    if (parsed.data.referer) opts.referer = parsed.data.referer;
    if (parsed.data.origin) opts.origin = parsed.data.origin;
    if (parsed.data.userAgent) opts.userAgent = parsed.data.userAgent;

    const inspection = await inspectRemoteManifest(opts);
    return okJson(c, { url: parsed.data.url, inspection }, { cache: "BYPASS", cacheControl: "no-store" });
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return errorJson(c, 403, "SSRF_BLOCKED", err.message);
    }
    return errorJson(c, 502, "UPSTREAM_UNAVAILABLE", err instanceof Error ? err.message : "Inspection failed");
  }
});

// GET /api/v1/streams/:matchId
streamsRoutes.get("/streams/:matchId", async (c) => {
  const matchId = c.req.param("matchId");
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const match = findMatchByIdentifier(snapshot.matches, matchId);

  if (!match) {
    return errorJson(c, 404, "MATCH_NOT_FOUND", `No cricket match found matching '${matchId}'`);
  }

  const origin = new URL(c.req.url).origin;
  const streams = match.streams.map((s) => ({
    ...s,
    proxyUrl: buildProxyLink(origin, s.url),
  }));

  return okJson(
    c,
    {
      matchId: match.matchId,
      title: match.title,
      phase: match.phase,
      format: match.format,
      squadClass: match.squadClass,
      totalStreams: streams.length,
      streams,
    },
    { cache: cacheSource, cacheControl: "public, max-age=15" }
  );
});

// OPTIONS /api/v1/proxy
streamsRoutes.options("/proxy", () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Accept, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
});

// GET /api/v1/proxy
streamsRoutes.get("/proxy", async (c) => {
  const parsed = ProxyQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Valid 'url' query parameter is required", parsed.error.flatten());
  }

  const origin = new URL(c.req.url).origin;
  const range = c.req.header("range");

  try {
    const proxyInput: Parameters<typeof handleEdgeStreamProxy>[0] = {
      targetUrl: parsed.data.url,
      proxyOrigin: origin,
      env: c.env,
    };
    if (parsed.data.fallback) proxyInput.fallbackUrl = parsed.data.fallback;
    if (parsed.data.quality) proxyInput.quality = parsed.data.quality;
    if (parsed.data.referer) proxyInput.referer = parsed.data.referer;
    if (parsed.data.origin) proxyInput.origin = parsed.data.origin;
    if (parsed.data.ua) proxyInput.userAgent = parsed.data.ua;
    if (range) proxyInput.range = range;

    return await handleEdgeStreamProxy(proxyInput);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return errorJson(c, 403, "SSRF_BLOCKED", err.message);
    }
    return errorJson(
      c,
      502,
      "UPSTREAM_UNAVAILABLE",
      err instanceof Error ? err.message : "Unable to proxy target stream"
    );
  }
});
