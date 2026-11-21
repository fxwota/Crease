import { Hono } from "hono";
import type { CreaseEnv } from "../../config/env";
import { ChannelsQuerySchema } from "../../domain/schemas";
import {
  extractBroadcastersFromSnapshot,
  generateCricketM3u8Playlist,
} from "../../ingestion/catalog-builder";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import { buildProxyLink } from "../../streaming/proxy";
import { errorJson, getSafeExecutionCtx, okJson } from "../envelope";

export const channelsRoutes = new Hono<{ Bindings: CreaseEnv }>();

// GET /api/v1/channels
channelsRoutes.get("/channels", async (c) => {
  const parsed = ChannelsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid channels query", parsed.error.flatten());
  }
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const q = parsed.data;

  let list = snapshot.channels;
  if (q.category) {
    const cat = q.category.toLowerCase();
    list = list.filter((ch) => ch.category.toLowerCase().includes(cat));
  }
  if (q.provider) {
    list = list.filter((ch) => ch.providers.includes(q.provider as (typeof ch.providers)[number]));
  }
  if (q.q) {
    const needle = q.q.toLowerCase();
    list = list.filter(
      (ch) =>
        ch.name.toLowerCase().includes(needle) ||
        ch.category.toLowerCase().includes(needle) ||
        (ch.broadcaster?.toLowerCase().includes(needle) ?? false)
    );
  }

  const origin = new URL(c.req.url).origin;
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / q.limit));
  const items = list.slice((q.page - 1) * q.limit, q.page * q.limit).map((ch) => ({
    ...ch,
    streams: ch.streams.map((s) => ({
      ...s,
      proxyUrl: buildProxyLink(origin, s.url),
    })),
  }));

  return okJson(
    c,
    { channels: items },
    {
      cache: cacheSource,
      etag: snapshot.etag,
      pagination: { page: q.page, limit: q.limit, total, totalPages },
      cacheControl: "public, max-age=30",
    }
  );
});

// GET /api/v1/channels/categories
channelsRoutes.get("/channels/categories", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const map = new Map<string, { category: string; count: number; hdCount: number; providers: Set<string> }>();

  for (const ch of snapshot.channels) {
    const cur = map.get(ch.category) ?? {
      category: ch.category,
      count: 0,
      hdCount: 0,
      providers: new Set<string>(),
    };
    cur.count++;
    if (ch.isHd) cur.hdCount++;
    for (const p of ch.providers) cur.providers.add(p);
    map.set(ch.category, cur);
  }

  const categories = [...map.values()]
    .map((x) => ({
      category: x.category,
      count: x.count,
      hdCount: x.hdCount,
      providers: [...x.providers],
    }))
    .sort((a, b) => b.count - a.count);

  return okJson(
    c,
    { total: categories.length, categories },
    { cache: cacheSource, cacheControl: "public, max-age=60" }
  );
});

// GET /api/v1/channels/:channelId
channelsRoutes.get("/channels/:channelId", async (c) => {
  const channelId = c.req.param("channelId");
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const channel = snapshot.channels.find((ch) => ch.channelId === channelId);
  if (!channel) {
    return errorJson(c, 404, "CHANNEL_NOT_FOUND", `No cricket channel found with ID '${channelId}'`);
  }

  const origin = new URL(c.req.url).origin;
  return okJson(
    c,
    {
      channel: {
        ...channel,
        streams: channel.streams.map((s) => ({
          ...s,
          proxyUrl: buildProxyLink(origin, s.url),
        })),
      },
    },
    { cache: cacheSource, cacheControl: "public, max-age=30" }
  );
});

// GET /api/v1/broadcasters
channelsRoutes.get("/broadcasters", async (c) => {
  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const broadcasters = extractBroadcastersFromSnapshot(snapshot);

  return okJson(
    c,
    { total: broadcasters.length, broadcasters },
    { cache: cacheSource, etag: snapshot.etag, cacheControl: "public, max-age=30" }
  );
});

// GET /api/v1/playlist.m3u
channelsRoutes.get("/playlist.m3u", async (c) => {
  const { snapshot } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const origin = new URL(c.req.url).origin;
  const formatFilter = c.req.query("format")?.trim().toUpperCase();
  const useProxy = c.req.query("proxy") !== "false";

  const playlistOpts: {
    snapshot: typeof snapshot;
    proxyOrigin: string;
    formatFilter?: string;
    useProxy: boolean;
  } = {
    snapshot,
    proxyOrigin: origin,
    useProxy,
  };
  if (formatFilter) playlistOpts.formatFilter = formatFilter;

  const m3u = generateCricketM3u8Playlist(playlistOpts);

  return new Response(m3u, {
    status: 200,
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": 'inline; filename="crease-cricket.m3u8"',
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
