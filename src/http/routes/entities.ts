import { Hono } from "hono";
import type { CreaseEnv } from "../../config/env";
import { SeriesQuerySchema, TeamsQuerySchema } from "../../domain/schemas";
import { ALL_CRICKET_SERIES, getSeriesById } from "../../domain/series";
import { ALL_CRICKET_SQUADS, getSquadById, resolveCricketSquad } from "../../domain/teams";
import type { MatchFormat } from "../../domain/types";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import {
  checkConditionalNotModified,
  errorJson,
  getSafeExecutionCtx,
  okJson,
} from "../envelope";

export const entitiesRoutes = new Hono<{ Bindings: CreaseEnv }>();

const ALL_FORMATS: readonly MatchFormat[] = [
  "TEST",
  "ODI",
  "T20I",
  "T20",
  "T10",
  "HUNDRED",
  "LIST_A",
  "FIRST_CLASS",
  "OTHER",
];

// GET /api/v1/series
entitiesRoutes.get("/series", async (c) => {
  const parsed = SeriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid series query", parsed.error.flatten());
  }
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));

  const seriesMap = new Map(ALL_CRICKET_SERIES.map((s) => [s.id, { ...s, matchCount: 0, liveCount: 0 }]));
  for (const m of snapshot.matches) {
    const existing = seriesMap.get(m.series.id) ?? { ...m.series, matchCount: 0, liveCount: 0 };
    existing.matchCount++;
    if (m.phase === "live") existing.liveCount++;
    seriesMap.set(m.series.id, existing);
  }

  let list = [...seriesMap.values()];
  const q = parsed.data;
  if (q.format) list = list.filter((s) => s.defaultFormat === q.format);
  if (q.active) list = list.filter((s) => s.matchCount > 0);
  if (q.q) {
    const needle = q.q.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.shortName.toLowerCase().includes(needle) ||
        s.slug.includes(needle)
    );
  }

  list.sort((a, b) => b.liveCount - a.liveCount || b.matchCount - a.matchCount || a.name.localeCompare(b.name));

  return okJson(
    c,
    { total: list.length, series: list },
    { cache: cacheSource, etag: snapshot.etag, cacheControl: "public, max-age=30" }
  );
});

// GET /api/v1/series/:seriesId
entitiesRoutes.get("/series/:seriesId", async (c) => {
  const seriesId = c.req.param("seriesId");
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));

  const matches = snapshot.matches.filter(
    (m) =>
      m.series.id.toLowerCase() === seriesId.toLowerCase() ||
      m.series.slug.toLowerCase() === seriesId.toLowerCase() ||
      m.series.shortName.toLowerCase() === seriesId.toLowerCase()
  );

  const series = getSeriesById(seriesId) ?? matches[0]?.series;
  if (!series) {
    return errorJson(c, 404, "SERIES_NOT_FOUND", `No cricket series found matching '${seriesId}'`);
  }

  const teamMap = new Map<string, NonNullable<(typeof matches)[number]["homeTeam"]>>();
  for (const m of matches) {
    if (m.homeTeam) teamMap.set(m.homeTeam.id, m.homeTeam);
    if (m.awayTeam) teamMap.set(m.awayTeam.id, m.awayTeam);
  }

  return okJson(
    c,
    {
      series,
      teams: [...teamMap.values()],
      matchCount: matches.length,
      liveCount: matches.filter((m) => m.phase === "live").length,
      matches,
    },
    { cache: cacheSource, cacheControl: "public, max-age=30" }
  );
});

// GET /api/v1/teams
entitiesRoutes.get("/teams", async (c) => {
  const parsed = TeamsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid teams query", parsed.error.flatten());
  }
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));

  const activeCounts = new Map<string, { matches: number; live: number }>();
  for (const m of snapshot.matches) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (!t) continue;
      const cur = activeCounts.get(t.id) ?? { matches: 0, live: 0 };
      cur.matches++;
      if (m.phase === "live") cur.live++;
      activeCounts.set(t.id, cur);
    }
  }

  let list = ALL_CRICKET_SQUADS.map((s) => {
    const counts = activeCounts.get(s.id) ?? { matches: 0, live: 0 };
    return { ...s, matchCount: counts.matches, liveCount: counts.live };
  });

  const q = parsed.data;
  if (q.squadClass) list = list.filter((t) => t.squadClass === q.squadClass);
  if (q.series) {
    const s = q.series.toLowerCase();
    list = list.filter((t) => (t.leagueId ?? "").toLowerCase() === s);
  }
  if (q.active) list = list.filter((t) => t.matchCount > 0);
  if (q.q) {
    const needle = q.q.toLowerCase();
    list = list.filter(
      (t) =>
        t.id.toLowerCase().includes(needle) ||
        t.code.toLowerCase().includes(needle) ||
        t.name.toLowerCase().includes(needle) ||
        t.aliases.some((a) => a.includes(needle))
    );
  }

  list.sort((a, b) => b.liveCount - a.liveCount || b.matchCount - a.matchCount || a.name.localeCompare(b.name));
  const sliced = list.slice(0, q.limit);

  return okJson(
    c,
    { total: list.length, teams: sliced },
    { cache: cacheSource, etag: snapshot.etag, cacheControl: "public, max-age=60" }
  );
});

// GET /api/v1/teams/:teamId
entitiesRoutes.get("/teams/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  const squad = getSquadById(teamId) ?? resolveCricketSquad(teamId);
  if (!squad) {
    return errorJson(c, 404, "TEAM_NOT_FOUND", `No cricket squad found matching '${teamId}'`);
  }

  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const matches = snapshot.matches.filter(
    (m) => m.homeTeam?.id === squad.id || m.awayTeam?.id === squad.id
  );

  return okJson(
    c,
    {
      team: squad,
      matchCount: matches.length,
      liveCount: matches.filter((m) => m.phase === "live").length,
      matches,
    },
    { cache: cacheSource, cacheControl: "public, max-age=30" }
  );
});

// GET /api/v1/formats
entitiesRoutes.get("/formats", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const formats = ALL_FORMATS.map((fmt) => {
    const matches = snapshot.matches.filter((m) => m.format === fmt);
    return {
      format: fmt,
      totalMatches: matches.length,
      liveMatches: matches.filter((m) => m.phase === "live").length,
      upcomingMatches: matches.filter((m) => m.phase === "upcoming" || m.phase === "pre_match").length,
    };
  });

  return okJson(
    c,
    { formats },
    { cache: cacheSource, etag: snapshot.etag, cacheControl: "public, max-age=30" }
  );
});

// GET /api/v1/catalog
entitiesRoutes.get("/catalog", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const notMod = checkConditionalNotModified(c, snapshot.etag);
  if (notMod) return notMod;

  return okJson(
    c,
    {
      generatedAt: snapshot.generatedAt,
      diagnostics: snapshot.diagnostics,
      counts: {
        matches: snapshot.matches.length,
        liveMatches: snapshot.matches.filter((m) => m.phase === "live").length,
        upcomingMatches: snapshot.matches.filter((m) => m.phase === "upcoming" || m.phase === "pre_match").length,
        channels: snapshot.channels.length,
      },
      matches: snapshot.matches,
      channels: snapshot.channels,
    },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      cacheControl: "public, max-age=15, stale-while-revalidate=60",
    }
  );
});
