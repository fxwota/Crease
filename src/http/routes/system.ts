import { Hono } from "hono";
import { z } from "zod";
import { RAW_CHANGELOG_MD } from "../../config/changelog-raw";
import { APP_NAME, APP_PACKAGE, APP_VERSION, type CreaseEnv } from "../../config/env";
import { filterParsedChangelog, parseChangelogMarkdown } from "../../domain/changelog-parser";
import { SearchQuerySchema } from "../../domain/schemas";
import { searchCricketCatalog } from "../../domain/search";
import { ALL_CRICKET_SERIES } from "../../domain/series";
import { ALL_CRICKET_SQUADS } from "../../domain/teams";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import { getProviderAdapter, PROVIDER_ADAPTERS } from "../../providers/registry";
import { getL1CacheStats } from "../../storage/snapshot-store";
import { checkConditionalNotModified, errorJson, getSafeExecutionCtx, okJson } from "../envelope";

const ChangelogQuerySchema = z.object({
  version: z.string().trim().max(32).optional(),
  type: z
    .enum(["all", "feat", "fix", "security", "perf", "refactor", "test", "docs", "build", "chore", "breaking"])
    .optional(),
  q: z.string().trim().max(120).optional(),
  includeUnreleased: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

const PARSED_CHANGELOG_CACHE = parseChangelogMarkdown(RAW_CHANGELOG_MD);
const CHANGELOG_ETAG = `W/"cl-${APP_VERSION}-${RAW_CHANGELOG_MD.length}-${PARSED_CHANGELOG_CACHE.totalChanges}"`;

export const systemRoutes = new Hono<{ Bindings: CreaseEnv }>();

// GET /api/v1/search
systemRoutes.get("/search", async (c) => {
  const parsed = SearchQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Query parameter 'q' is required", parsed.error.flatten());
  }

  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const results = searchCricketCatalog({
    query: parsed.data.q,
    limit: parsed.data.limit,
    matches: snapshot.matches,
    series: ALL_CRICKET_SERIES,
    teams: ALL_CRICKET_SQUADS,
    channels: snapshot.channels,
  });

  return okJson(c, results, { cache: cacheSource, cacheControl: "public, max-age=15" });
});

// GET /api/v1/providers
systemRoutes.get("/providers", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));

  const providers = PROVIDER_ADAPTERS.map((adapter) => {
    const health = snapshot.providers.find((p) => p.provider === adapter.descriptor.id);
    return {
      id: adapter.descriptor.id,
      displayName: adapter.descriptor.displayName,
      packageName: adapter.descriptor.packageName,
      customScheme: adapter.descriptor.customScheme,
      cryptoPipeline: adapter.descriptor.cryptoPipeline,
      fallbackDomains: adapter.descriptor.fallbackDomains,
      status: health ?? {
        provider: adapter.descriptor.id,
        displayName: adapter.descriptor.displayName,
        cryptoPipeline: adapter.descriptor.cryptoPipeline,
        customScheme: adapter.descriptor.customScheme,
        circuitState: "CLOSED",
        ok: false,
        latencyMs: 0,
        rawEventsFetched: 0,
        cricketEventsKept: 0,
        nonCricketDropped: 0,
        channelsKept: 0,
      },
    };
  });

  return okJson(
    c,
    { total: providers.length, providers },
    { cache: cacheSource, cacheControl: "public, max-age=15" }
  );
});

// GET /api/v1/providers/:providerId
systemRoutes.get("/providers/:providerId", async (c) => {
  const providerId = c.req.param("providerId");
  const adapter = getProviderAdapter(providerId);
  if (!adapter) {
    return errorJson(
      c,
      404,
      "PROVIDER_NOT_FOUND",
      `Unknown CS3 provider '${providerId}'. Valid providers: cricify, sportzx, playfy, sktech, playztv, livxow`
    );
  }

  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const health = snapshot.providers.find((p) => p.provider === adapter.descriptor.id);
  const matches = snapshot.matches.filter((m) => m.providers.includes(adapter.descriptor.id));
  const channels = snapshot.channels.filter((ch) => ch.providers.includes(adapter.descriptor.id));

  return okJson(
    c,
    {
      provider: {
        ...adapter.descriptor,
        status: health ?? null,
        matchCount: matches.length,
        channelCount: channels.length,
      },
      matches,
      channels,
    },
    { cache: cacheSource, cacheControl: "public, max-age=15" }
  );
});

// GET /api/v1/diagnostics
systemRoutes.get("/diagnostics", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  return okJson(
    c,
    {
      generatedAt: snapshot.generatedAt,
      diagnostics: snapshot.diagnostics,
      l1Cache: getL1CacheStats(),
      providers: snapshot.providers,
    },
    { cache: cacheSource, cacheControl: "no-store" }
  );
});

// GET /api/v1/stats
systemRoutes.get("/stats", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));

  const byFormat: Record<string, number> = {};
  const bySquadClass: Record<string, number> = {};
  const byPhase: Record<string, number> = {};
  const byProtocol: Record<string, number> = {};
  const byEncryption: Record<string, number> = {};

  for (const m of snapshot.matches) {
    byFormat[m.format] = (byFormat[m.format] ?? 0) + 1;
    bySquadClass[m.squadClass] = (bySquadClass[m.squadClass] ?? 0) + 1;
    byPhase[m.phase] = (byPhase[m.phase] ?? 0) + 1;
    for (const s of m.streams) {
      byProtocol[s.protocol] = (byProtocol[s.protocol] ?? 0) + 1;
      byEncryption[s.encryption] = (byEncryption[s.encryption] ?? 0) + 1;
    }
  }

  return okJson(
    c,
    {
      service: APP_NAME,
      package: APP_PACKAGE,
      version: APP_VERSION,
      runtime: "cloudflare-workers",
      totals: {
        matches: snapshot.matches.length,
        liveMatches: snapshot.matches.filter((m) => m.phase === "live").length,
        upcomingMatches: snapshot.matches.filter((m) => m.phase === "upcoming" || m.phase === "pre_match").length,
        featuredMatches: snapshot.matches.filter((m) => m.featured).length,
        channels: snapshot.channels.length,
        streams: snapshot.diagnostics.totalStreams,
        healthyProviders: snapshot.providers.filter((p) => p.ok).length,
        totalProviders: PROVIDER_ADAPTERS.length,
      },
      breakdowns: {
        byFormat,
        bySquadClass,
        byPhase,
        byProtocol,
        byEncryption,
      },
      l1Cache: getL1CacheStats(),
    },
    { cache: cacheSource, cacheControl: "public, max-age=15" }
  );
});

// GET /api/v1/changelog
systemRoutes.get("/changelog", (c) => {
  const parsedQuery = ChangelogQuerySchema.safeParse(c.req.query());
  if (!parsedQuery.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid changelog filter parameters", parsedQuery.error.flatten());
  }

  const hasFilters = Boolean(
    parsedQuery.data.version ||
      (parsedQuery.data.type && parsedQuery.data.type !== "all") ||
      parsedQuery.data.q ||
      parsedQuery.data.includeUnreleased
  );

  if (!hasFilters) {
    const notMod = checkConditionalNotModified(c, CHANGELOG_ETAG);
    if (notMod) return notMod;
  }

  const payload = hasFilters
    ? filterParsedChangelog(PARSED_CHANGELOG_CACHE, {
        version: parsedQuery.data.version,
        type: parsedQuery.data.type,
        query: parsedQuery.data.q,
        includeUnreleased: parsedQuery.data.includeUnreleased,
      })
    : PARSED_CHANGELOG_CACHE;

  return okJson(
    c,
    {
      ...payload,
      source: "CHANGELOG.md",
      rawUrl: "/changelog.md",
      standard: {
        changelog: "Keep a Changelog 1.1.0",
        versioning: "Semantic Versioning 2.0.0",
        commits: "Conventional Commits 1.0.0",
      },
    },
    hasFilters
      ? { cache: "L1", cacheControl: "public, max-age=300" }
      : { cache: "L1", etag: CHANGELOG_ETAG, cacheControl: "public, max-age=300" }
  );
});

export const healthRoutes = new Hono<{ Bindings: CreaseEnv }>();

// GET /health
healthRoutes.get("/health", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const healthyProviders = snapshot.providers.filter((p) => p.ok).length;

  return okJson(
    c,
    {
      status: snapshot.diagnostics.degraded ? "degraded" : "healthy",
      service: APP_NAME,
      package: APP_PACKAGE,
      version: APP_VERSION,
      runtime: "cloudflare-workers",
      bindings: {
        kvBound: Boolean(c.env?.CREASE_KV),
        cacheApiAvailable: typeof globalThis.caches !== "undefined",
      },
      catalog: {
        generatedAt: snapshot.generatedAt,
        snapshotAgeSec: snapshot.diagnostics.snapshotAgeSec,
        matches: snapshot.matches.length,
        liveMatches: snapshot.matches.filter((m) => m.phase === "live").length,
        channels: snapshot.channels.length,
        healthyProviders,
        totalProviders: PROVIDER_ADAPTERS.length,
      },
      providers: snapshot.providers.map((p) => ({
        provider: p.provider,
        ok: p.ok,
        circuitState: p.circuitState,
        latencyMs: p.latencyMs,
      })),
    },
    { cache: cacheSource, cacheControl: "no-store" }
  );
});
