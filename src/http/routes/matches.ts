import { Hono } from "hono";
import type { CreaseEnv } from "../../config/env";
import { MatchesQuerySchema, MatchStreamsQuerySchema } from "../../domain/schemas";
import { scoreCricketStream } from "../../domain/stream-ranker";
import { resolveCricketSquad } from "../../domain/teams";
import type { CricketMatch, CricketStream } from "../../domain/types";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import { inspectRemoteManifest } from "../../streaming/prober";
import { buildProxyLink } from "../../streaming/proxy";
import {
  checkConditionalNotModified,
  errorJson,
  getSafeExecutionCtx,
  okJson,
} from "../envelope";

export const matchesRoutes = new Hono<{ Bindings: CreaseEnv }>();

function attachProxyUrls(streams: readonly CricketStream[], origin: string): CricketStream[] {
  return streams.map((s) => {
    const proxyOpts: { referer?: string; origin?: string; userAgent?: string } = {};
    if (s.publicHeaders["Referer"]) proxyOpts.referer = s.publicHeaders["Referer"];
    if (s.publicHeaders["Origin"]) proxyOpts.origin = s.publicHeaders["Origin"];
    if (s.publicHeaders["User-Agent"]) proxyOpts.userAgent = s.publicHeaders["User-Agent"];
    return {
      ...s,
      proxyUrl: buildProxyLink(origin, s.url, proxyOpts),
    };
  });
}

function filterAndSortMatches(
  allMatches: readonly CricketMatch[],
  filters: {
    phase: string;
    format?: string | undefined;
    squadClass?: string | undefined;
    series?: string | undefined;
    team?: string | undefined;
    provider?: string | undefined;
    language?: string | undefined;
    drm?: boolean | undefined;
    featured?: boolean | undefined;
    kind: string;
    q?: string | undefined;
    sort: string;
  }
): CricketMatch[] {
  let list = [...allMatches];

  if (filters.phase !== "all") {
    list = list.filter((m) => m.phase === filters.phase);
  }
  if (filters.kind !== "all") {
    list = list.filter((m) => m.kind === filters.kind);
  }
  if (filters.format) {
    list = list.filter((m) => m.format === filters.format);
  }
  if (filters.squadClass) {
    list = list.filter((m) => m.squadClass === filters.squadClass);
  }
  if (filters.series) {
    const s = filters.series.toLowerCase();
    list = list.filter(
      (m) =>
        m.series.id.toLowerCase() === s ||
        m.series.slug.toLowerCase().includes(s) ||
        m.series.name.toLowerCase().includes(s) ||
        m.series.shortName.toLowerCase().includes(s)
    );
  }
  if (filters.team) {
    const resolved = resolveCricketSquad(filters.team);
    const tLower = filters.team.toLowerCase();
    list = list.filter((m) => {
      const teams = [m.homeTeam, m.awayTeam].filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (resolved && teams.some((t) => t.id === resolved.id)) return true;
      return teams.some(
        (t) =>
          t.id.toLowerCase() === tLower ||
          t.code.toLowerCase() === tLower ||
          t.name.toLowerCase().includes(tLower)
      );
    });
  }
  if (filters.provider) {
    list = list.filter((m) => m.providers.includes(filters.provider as CricketMatch["providers"][number]));
  }
  if (filters.language) {
    const lang = filters.language.toLowerCase();
    list = list.filter((m) => m.languages.some((l) => l.toLowerCase() === lang));
  }
  if (filters.drm !== undefined) {
    list = list.filter((m) => m.hasDrm === filters.drm);
  }
  if (filters.featured !== undefined) {
    list = list.filter((m) => m.featured === filters.featured);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.series.name.toLowerCase().includes(q) ||
        (m.homeTeam?.name.toLowerCase().includes(q) ?? false) ||
        (m.awayTeam?.name.toLowerCase().includes(q) ?? false) ||
        m.broadcasters.some((b) => b.toLowerCase().includes(q))
    );
  }

  if (filters.sort === "featured") {
    list.sort((a, b) => b.featuredScore - a.featuredScore);
  } else if (filters.sort === "streams") {
    list.sort((a, b) => b.streamCount - a.streamCount);
  } else if (filters.sort === "time") {
    list.sort((a, b) => (a.startTimeIso ?? "9999").localeCompare(b.startTimeIso ?? "9999"));
  } else if (filters.sort === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  return list;
}

// GET /api/v1/matches
matchesRoutes.get("/", async (c) => {
  const parsed = MatchesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid matches query parameters", parsed.error.flatten());
  }

  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const notMod = checkConditionalNotModified(c, snapshot.etag);
  if (notMod) return notMod;

  const q = parsed.data;
  const filtered = filterAndSortMatches(snapshot.matches, q);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / q.limit));
  const origin = new URL(c.req.url).origin;
  const items = filtered.slice((q.page - 1) * q.limit, q.page * q.limit).map((m) => ({
    ...m,
    streams: attachProxyUrls(m.streams, origin),
  }));

  return okJson(
    c,
    { matches: items },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      pagination: { page: q.page, limit: q.limit, total, totalPages },
      cacheControl: "public, max-age=15, stale-while-revalidate=60",
    }
  );
});

// GET /api/v1/matches/live
matchesRoutes.get("/live", async (c) => {
  const parsed = MatchesQuerySchema.safeParse({ ...c.req.query(), phase: "live" });
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid query parameters", parsed.error.flatten());
  }
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const q = parsed.data;
  const filtered = filterAndSortMatches(snapshot.matches, q);
  const origin = new URL(c.req.url).origin;
  const items = filtered.slice((q.page - 1) * q.limit, q.page * q.limit).map((m) => ({
    ...m,
    streams: attachProxyUrls(m.streams, origin),
  }));

  return okJson(
    c,
    { phase: "live", matches: items },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      pagination: {
        page: q.page,
        limit: q.limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / q.limit)),
      },
      cacheControl: "public, max-age=10, stale-while-revalidate=30",
    }
  );
});

// GET /api/v1/matches/upcoming
matchesRoutes.get("/upcoming", async (c) => {
  const parsed = MatchesQuerySchema.safeParse({ ...c.req.query(), phase: "upcoming", sort: "time" });
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid query parameters", parsed.error.flatten());
  }
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const q = parsed.data;
  const filtered = filterAndSortMatches(snapshot.matches, q);
  const origin = new URL(c.req.url).origin;
  const items = filtered.slice((q.page - 1) * q.limit, q.page * q.limit).map((m) => ({
    ...m,
    streams: attachProxyUrls(m.streams, origin),
  }));

  return okJson(
    c,
    { phase: "upcoming", matches: items },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      pagination: {
        page: q.page,
        limit: q.limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / q.limit)),
      },
      cacheControl: "public, max-age=30, stale-while-revalidate=120",
    }
  );
});

// GET /api/v1/matches/featured
matchesRoutes.get("/featured", async (c) => {
  const parsed = MatchesQuerySchema.safeParse({ ...c.req.query(), sort: "featured" });
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid query parameters", parsed.error.flatten());
  }
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const q = parsed.data;
  const featured = filterAndSortMatches(snapshot.matches, { ...q, featured: true });
  const fallback = featured.length > 0 ? featured : filterAndSortMatches(snapshot.matches, q);
  const origin = new URL(c.req.url).origin;
  const items = fallback.slice(0, q.limit).map((m) => ({
    ...m,
    streams: attachProxyUrls(m.streams, origin),
  }));

  return okJson(
    c,
    { matches: items },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      pagination: { page: 1, limit: q.limit, total: fallback.length, totalPages: 1 },
      cacheControl: "public, max-age=15, stale-while-revalidate=60",
    }
  );
});

export function findMatchByIdentifier(
  matches: readonly CricketMatch[],
  id: string
): CricketMatch | undefined {
  const clean = id.trim();
  const lower = clean.toLowerCase();
  return matches.find(
    (m) =>
      m.matchId === clean ||
      m.canonicalKey === lower ||
      Object.values(m.providerEventIds).some((evId) => evId === clean)
  );
}

// GET /api/v1/matches/:matchId
matchesRoutes.get("/:matchId", async (c) => {
  const matchId = c.req.param("matchId");
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const match = findMatchByIdentifier(snapshot.matches, matchId);

  if (!match) {
    return errorJson(c, 404, "MATCH_NOT_FOUND", `No cricket match found matching '${matchId}'`);
  }

  const origin = new URL(c.req.url).origin;
  return okJson(
    c,
    {
      match: {
        ...match,
        streams: attachProxyUrls(match.streams, origin),
      },
    },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      cacheControl: "public, max-age=15, stale-while-revalidate=60",
    }
  );
});

// GET /api/v1/matches/:matchId/streams
matchesRoutes.get("/:matchId/streams", async (c) => {
  const matchId = c.req.param("matchId");
  const parsed = MatchStreamsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid stream filter parameters", parsed.error.flatten());
  }

  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const match = findMatchByIdentifier(snapshot.matches, matchId);
  if (!match) {
    return errorJson(c, 404, "MATCH_NOT_FOUND", `No cricket match found matching '${matchId}'`);
  }

  const q = parsed.data;
  const origin = new URL(c.req.url).origin;
  let streams = attachProxyUrls(match.streams, origin);

  if (q.protocol) streams = streams.filter((s) => s.protocol === q.protocol);
  if (q.quality) {
    const qual = q.quality.toLowerCase();
    streams = streams.filter((s) => s.quality.toLowerCase() === qual);
  }
  if (q.language) {
    const lang = q.language.toLowerCase();
    streams = streams.filter((s) => s.language.toLowerCase() === lang);
  }
  if (q.provider) {
    const prov = q.provider.toLowerCase();
    streams = streams.filter((s) => s.provider === prov);
  }

  // Optional bounded canary manifest probing (max 3 streams per request to respect CF subrequest budget)
  if (q.probe) {
    const probed = await Promise.all(
      streams.slice(0, 3).map(async (s) => {
        if (!/^https?:\/\//i.test(s.url)) return s;
        try {
          const inspectInput: { url: string; referer?: string; origin?: string; userAgent?: string; timeoutMs: number } = {
            url: s.url,
            timeoutMs: 3000,
          };
          if (s.publicHeaders["Referer"]) inspectInput.referer = s.publicHeaders["Referer"];
          if (s.publicHeaders["Origin"]) inspectInput.origin = s.publicHeaders["Origin"];
          if (s.publicHeaders["User-Agent"]) inspectInput.userAgent = s.publicHeaders["User-Agent"];
          const inspection = await inspectRemoteManifest(inspectInput);
          const scoreOpts: {
            provider: typeof s.provider;
            protocol: typeof inspection.protocol;
            resolutionHeight?: number;
            encryption: typeof inspection.encryption;
            language: string;
            feedType: typeof s.feedType;
            probedReachable: boolean;
          } = {
            provider: s.provider,
            protocol: inspection.protocol,
            encryption: inspection.encryption,
            language: s.language,
            feedType: s.feedType,
            probedReachable: inspection.reachable,
          };
          if (s.resolutionHeight !== undefined) scoreOpts.resolutionHeight = s.resolutionHeight;

          return {
            ...s,
            probed: inspection,
            compatibility: inspection.compatibility,
            rankScore: scoreCricketStream(scoreOpts),
          };
        } catch {
          return s;
        }
      })
    );
    streams = [...probed, ...streams.slice(3)].sort((a, b) => b.rankScore - a.rankScore);
  }

  return okJson(
    c,
    {
      matchId: match.matchId,
      title: match.title,
      phase: match.phase,
      format: match.format,
      totalStreams: streams.length,
      streams,
    },
    {
      cache: q.probe ? "BYPASS" : cacheSource,
      cacheControl: q.probe ? "no-store" : "public, max-age=15",
    }
  );
});
