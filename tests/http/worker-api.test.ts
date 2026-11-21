import { beforeEach, describe, expect, it } from "vitest";
import type { CreaseEnv } from "../../src/config/env";
import { createCreaseApp } from "../../src/index";
import { buildCricketCatalogSnapshot } from "../../src/ingestion/catalog-builder";
import { clearSnapshotStoreForTests, writeCatalogSnapshot } from "../../src/storage/snapshot-store";

const app = createCreaseApp();

const mockCtx = {
  waitUntil(_p: Promise<unknown>): void {},
  passThroughOnException(): void {},
} as unknown as ExecutionContext;

const testEnv: CreaseEnv = {
  ENVIRONMENT: "test",
  ENABLE_UPSTREAM_FETCH: "false",
  SNAPSHOT_TTL_SECONDS: "300",
};

function invoke(url: string, init?: RequestInit): Promise<Response> {
  return Promise.resolve(app.fetch(new Request(url, init), testEnv, mockCtx));
}

describe("Crease Cloudflare Worker HTTP API v1 Contract", () => {
  beforeEach(async () => {
    clearSnapshotStoreForTests();
    const seeded = buildCricketCatalogSnapshot({
      ingestionDurationMs: 40,
      storageMode: "memory-fallback",
      nowMs: Date.parse("2026-04-12T15:00:00Z"),
      reports: [
        {
          result: {
            provider: "cricify",
            events: [
              {
                provider: "cricify",
                providerEventId: "cr_1",
                title: "India vs Australia — 1st T20I",
                tournament: "ICC Men's T20 World Cup",
                status: "LIVE",
                startTimeIso: "2026-04-12T14:00:00Z",
                streams: [
                  {
                    label: "Star Sports 1 English 1080p",
                    url: "https://cdn.example.com/ind-aus.m3u8",
                    headers: { Authorization: "Bearer hidden", Referer: "https://player.example.com" },
                  },
                ],
              },
              {
                provider: "cricify",
                providerEventId: "cr_2",
                title: "Mumbai Indians Women vs RCB Women",
                tournament: "WPL",
                status: "UPCOMING",
                startTimeIso: "2026-04-13T14:00:00Z",
                streams: [
                  { label: "JioStar Hindi 720p", url: "https://cdn.example.com/wpl.m3u8" },
                ],
              },
            ],
            channels: [
              {
                provider: "cricify",
                providerChannelId: "ch_willow",
                name: "Willow Cricket HD",
                category: "Cricket",
                streams: [{ label: "Willow HD", url: "https://cdn.example.com/willow.m3u8" }],
              },
            ],
          },
          health: {
            provider: "cricify",
            displayName: "Cricify",
            cryptoPipeline: "AES-128-CBC",
            customScheme: "cricify://",
            circuitState: "CLOSED",
            ok: true,
            latencyMs: 35,
            rawEventsFetched: 2,
            cricketEventsKept: 2,
            nonCricketDropped: 0,
            channelsKept: 1,
          },
        },
      ],
    });
    await writeCatalogSnapshot(testEnv, seeded, 300_000, 600_000);
  });

  it("serves /health, /openapi.json, /portal, and /docs with Crease v0.0.0 metadata", async () => {
    const healthRes = await invoke("https://crease.test/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get("x-crease-version")).toBe("0.0.0");
    const health = (await healthRes.json()) as { ok: boolean; data: { version: string; service: string } };
    expect(health.ok).toBe(true);
    expect(health.data.version).toBe("0.0.0");
    expect(health.data.service).toBe("Crease");

    const specRes = await invoke("https://crease.test/openapi.json");
    const spec = (await specRes.json()) as { openapi: string; info: { version: string; title: string } };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.version).toBe("0.0.0");
    expect(spec.info.title).toContain("Crease");

    const portalRes = await invoke("https://crease.test/portal");
    expect(portalRes.status).toBe(200);
    expect(await portalRes.text()).toContain("Crease");

    const docsRes = await invoke("https://crease.test/docs");
    expect(docsRes.status).toBe(200);
    expect(await docsRes.text()).toContain("OpenAPI 3.1");
  });

  it("serves /api/v1/matches with filtering, ETag 304, detail lookup, and redacted headers", async () => {
    const listRes = await invoke("https://crease.test/api/v1/matches?phase=live");
    expect(listRes.status).toBe(200);
    const etag = listRes.headers.get("etag");
    expect(etag).toBeTruthy();

    const listBody = (await listRes.json()) as {
      ok: boolean;
      data: { matches: Array<{ matchId: string; streams: Array<{ publicHeaders: Record<string, string>; hasRedactedAuth: boolean }> }> };
    };
    expect(listBody.ok).toBe(true);
    expect(listBody.data.matches).toHaveLength(1);
    const match = listBody.data.matches[0]!;
    expect(match.streams[0]?.hasRedactedAuth).toBe(true);
    expect(match.streams[0]?.publicHeaders["Authorization"]).toBeUndefined();

    // Conditional 304 Not Modified
    const notModRes = await invoke("https://crease.test/api/v1/matches", {
      headers: { "If-None-Match": etag! },
    });
    expect(notModRes.status).toBe(304);

    // Match detail & streams
    const detailRes = await invoke(`https://crease.test/api/v1/matches/${match.matchId}`);
    expect(detailRes.status).toBe(200);

    const streamsRes = await invoke(`https://crease.test/api/v1/matches/${match.matchId}/streams`);
    expect(streamsRes.status).toBe(200);
  });

  it("serves series, squads, formats, schedule, XMLTV EPG, M3U8 playlist, search, and providers", async () => {
    const epgRes = await invoke("https://crease.test/api/v1/epg.xml");
    expect(epgRes.status).toBe(200);
    expect(epgRes.headers.get("content-type")).toContain("application/xml");
    expect(await epgRes.text()).toContain("Crease Cricket Edge API");

    const m3uRes = await invoke("https://crease.test/api/v1/playlist.m3u");
    expect(m3uRes.status).toBe(200);
    const m3uText = await m3uRes.text();
    expect(m3uText).toContain("#EXTM3U");
    expect(m3uText).toContain("Willow Cricket HD");

    const teamRes = await invoke("https://crease.test/api/v1/teams/MI-W");
    expect(teamRes.status).toBe(200);
    const teamJson = (await teamRes.json()) as { data: { team: { id: string; squadClass: string } } };
    expect(teamJson.data.team.id).toBe("MI-W");
    expect(teamJson.data.team.squadClass).toBe("WOMENS");

    const searchRes = await invoke("https://crease.test/api/v1/search?q=Willow");
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as { data: { totalHits: number } };
    expect(searchJson.data.totalHits).toBeGreaterThanOrEqual(1);

    const provRes = await invoke("https://crease.test/api/v1/providers");
    const provJson = (await provRes.json()) as { data: { total: number } };
    expect(provJson.data.total).toBe(6);
  });

  it("blocks SSRF targets on /api/v1/proxy and /api/v1/streams/inspect with HTTP 403", async () => {
    const proxyRes = await invoke(
      "https://crease.test/api/v1/proxy?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F"
    );
    expect(proxyRes.status).toBe(403);
    const proxyJson = (await proxyRes.json()) as { ok: boolean; error: { code: string } };
    expect(proxyJson.ok).toBe(false);
    expect(proxyJson.error.code).toBe("SSRF_BLOCKED");

    const inspectRes = await invoke(
      "https://crease.test/api/v1/streams/inspect?url=http%3A%2F%2F127.0.0.1%3A12345%2Ftest.m3u8"
    );
    expect(inspectRes.status).toBe(403);
    const inspectJson = (await inspectRes.json()) as { ok: boolean; error: { code: string } };
    expect(inspectJson.error.code).toBe("SSRF_BLOCKED");
  });

  it("streams SSE initial snapshot and returns structured JSON 404 for unknown routes", async () => {
    const controller = new AbortController();
    const sseRes = await invoke("https://crease.test/api/v1/live/sse", {
      signal: controller.signal,
    });
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
    const reader = sseRes.body!.getReader();
    const first = await reader.read();
    const chunkText = new TextDecoder().decode(first.value);
    expect(chunkText).toContain("retry: 5000");
    controller.abort();
    await reader.cancel();

    const notFound = await invoke("https://crease.test/api/v1/does-not-exist");
    expect(notFound.status).toBe(404);
    const nfJson = (await notFound.json()) as { ok: boolean; error: { code: string } };
    expect(nfJson.ok).toBe(false);
    expect(nfJson.error.code).toBe("NOT_FOUND");
  });
});
