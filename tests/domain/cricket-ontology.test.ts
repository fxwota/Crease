import { describe, expect, it } from "vitest";
import {
  ALL_CRICKET_SERIES,
  ALL_CRICKET_SQUADS,
  classifyCricketEvent,
  computeCanonicalMatchKey,
  deduplicateCricketMatches,
  isCricketChannel,
  parseCricketFixtureMeta,
  resolveCricketSquad,
  searchCricketCatalog,
} from "../../src/domain";
import { buildCricketCatalogSnapshot } from "../../src/ingestion/catalog-builder";
import { parseProviderDateTime } from "../../src/providers/base";
import { parseClearKeySpec } from "../../src/providers/drm";
import { parseM3uPlaylist } from "../../src/providers/m3u";

describe("Cricket-First Domain Ontology, Classifier & Deduplication", () => {
  it("strictly drops non-cricket sports while preserving cricket fixtures and 24/7 cricket channels", () => {
    expect(classifyCricketEvent({ title: "Arsenal vs Chelsea", tournament: "Premier League" }).isCricket).toBe(false);
    expect(classifyCricketEvent({ title: "Lakers vs Celtics", tournament: "NBA" }).isCricket).toBe(false);
    expect(classifyCricketEvent({ title: "Monaco Grand Prix", tournament: "Formula 1" }).isCricket).toBe(false);
    expect(classifyCricketEvent({ title: "UFC 315 Main Card", category: "MMA" }).isCricket).toBe(false);
    expect(classifyCricketEvent({ title: "Real Madrid vs Barcelona", tournament: "La Liga" }).isCricket).toBe(false);

    expect(classifyCricketEvent({ title: "Mumbai Indians vs Chennai Super Kings", tournament: "Indian Premier League" }).isCricket).toBe(true);
    expect(classifyCricketEvent({ title: "India Women vs Australia Women 2nd ODI" }).isCricket).toBe(true);
    expect(classifyCricketEvent({ title: "England vs Australia Day 3", tournament: "The Ashes" }).isCricket).toBe(true);

    expect(isCricketChannel("Willow Cricket HD", "Sports")).toBe(true);
    expect(isCricketChannel("Sky Sports Cricket", "UK")).toBe(true);
    expect(isCricketChannel("Star Sports 1 Hindi HD", "India")).toBe(true);
    expect(isCricketChannel("Sky Sports F1 HD", "Motorsport")).toBe(false);
    expect(isCricketChannel("NBA TV HD", "Basketball")).toBe(false);
    expect(isCricketChannel("MUTV HD", "Football")).toBe(false);
  });

  it("prevents squad collisions across Men's, Women's, U19, A-Team, and global MI franchises", () => {
    const indMen = resolveCricketSquad("India");
    const indWomen = resolveCricketSquad("India Women");
    const indU19 = resolveCricketSquad("India U19");
    const indA = resolveCricketSquad("India A");
    expect(new Set([indMen?.id, indWomen?.id, indU19?.id, indA?.id]).size).toBe(4);
    expect(indMen?.id).toBe("IND");
    expect(indWomen?.id).toBe("IND-W");
    expect(indU19?.id).toBe("IND-U19");
    expect(indA?.id).toBe("IND-A");

    const miIpl = resolveCricketSquad("Mumbai Indians", { leagueHint: "ipl" });
    const miWpl = resolveCricketSquad("Mumbai Indians Women", { leagueHint: "wpl" });
    const miSa20 = resolveCricketSquad("MI Cape Town", { leagueHint: "sa20" });
    const miMlc = resolveCricketSquad("MI New York", { leagueHint: "mlc" });
    const miIlt = resolveCricketSquad("MI Emirates", { leagueHint: "ilt20" });

    expect([miIpl?.id, miWpl?.id, miSa20?.id, miMlc?.id, miIlt?.id]).toEqual([
      "MI",
      "MI-W",
      "MICT",
      "MINY",
      "MIE",
    ]);
  });

  it("produces order-independent canonical match IDs and merges multi-provider fixtures", () => {
    const k1 = computeCanonicalMatchKey({
      format: "T20I",
      squadClass: "MENS",
      homeTeamId: "IND",
      awayTeamId: "AUS",
      seriesId: "international-cricket",
      dateBucketUtc: "2026-04-12",
      fallbackTitle: "India vs Australia",
    });
    const k2 = computeCanonicalMatchKey({
      format: "T20I",
      squadClass: "MENS",
      homeTeamId: "AUS",
      awayTeamId: "IND",
      seriesId: "international-cricket",
      dateBucketUtc: "2026-04-12",
      fallbackTitle: "Australia vs India",
    });
    expect(k1.matchId).toBe(k2.matchId);
    expect(k1.canonicalKey).toBe(k2.canonicalKey);

    const parsed = parseCricketFixtureMeta({
      title: "WPL Final: Mumbai Indians Women vs RCB Women",
    });
    expect(parsed.series.id).toBe("wpl");
    expect(parsed.squadClass).toBe("WOMENS");
    expect(parsed.format).toBe("T20");
    expect(parsed.stage).toBe("Final");
    expect(parsed.homeTeam?.id).toBe("MI-W");
    expect(parsed.awayTeam?.id).toBe("RCB-W");
  });

  it("merges duplicate fixtures across providers and ranks streams deterministically", () => {
    const snapshot = buildCricketCatalogSnapshot({
      ingestionDurationMs: 120,
      storageMode: "memory-fallback",
      nowMs: Date.parse("2026-04-12T14:00:00Z"),
      reports: [
        {
          result: {
            provider: "cricify",
            events: [
              {
                provider: "cricify",
                providerEventId: "c1",
                title: "India vs Pakistan — 3rd T20I",
                tournament: "ACC Asia Cup",
                status: "LIVE",
                startTimeIso: "2026-04-12T13:30:00Z",
                streams: [
                  {
                    label: "Star Sports 1 Hindi 1080p",
                    url: "https://cdn.example.com/hindi.m3u8",
                    headers: { Cookie: "session=secret", Referer: "https://player.example.com" },
                  },
                ],
              },
              {
                provider: "cricify",
                providerEventId: "c_non_cricket",
                title: "Manchester United vs Liverpool",
                tournament: "Premier League",
                status: "LIVE",
                streams: [{ label: "Sky", url: "https://cdn.example.com/epl.m3u8" }],
              },
            ],
            channels: [
              {
                provider: "cricify",
                providerChannelId: "ch1",
                name: "Willow Cricket HD",
                category: "Cricket",
                streams: [{ label: "Willow HD", url: "https://cdn.example.com/willow.m3u8" }],
              },
              {
                provider: "cricify",
                providerChannelId: "ch2",
                name: "Sky Sports F1 HD",
                category: "Motorsport",
                streams: [{ label: "F1", url: "https://cdn.example.com/f1.m3u8" }],
              },
            ],
          },
          health: {
            provider: "cricify",
            displayName: "Cricify",
            cryptoPipeline: "AES",
            customScheme: "cricify://",
            circuitState: "CLOSED",
            ok: true,
            latencyMs: 50,
            rawEventsFetched: 2,
            cricketEventsKept: 0,
            nonCricketDropped: 0,
            channelsKept: 0,
          },
        },
        {
          result: {
            provider: "sportzx",
            events: [
              {
                provider: "sportzx",
                providerEventId: "s1",
                title: "Pakistan v India T20I",
                tournament: "Asia Cup",
                status: "UPCOMING",
                startTimeIso: "2026-04-12T13:30:00Z",
                streams: [
                  { label: "Dugout 720p English", url: "https://cdn2.example.com/dugout.m3u8" },
                ],
              },
            ],
            channels: [],
          },
          health: {
            provider: "sportzx",
            displayName: "Sportzx",
            cryptoPipeline: "SXR3",
            customScheme: "sportzx://",
            circuitState: "CLOSED",
            ok: true,
            latencyMs: 65,
            rawEventsFetched: 1,
            cricketEventsKept: 0,
            nonCricketDropped: 0,
            channelsKept: 0,
          },
        },
      ],
    });

    expect(snapshot.diagnostics.nonCricketDropped).toBe(1);
    expect(snapshot.matches).toHaveLength(1);
    expect(snapshot.channels).toHaveLength(1);
    expect(snapshot.channels[0]?.name).toBe("Willow Cricket HD");

    const merged = snapshot.matches[0]!;
    expect(merged.providerCount).toBe(2);
    expect(merged.phase).toBe("live");
    expect(merged.featured).toBe(true);
    expect(merged.streamCount).toBe(2);
    // Cookie must be redacted from public stream headers
    const hindiStream = merged.streams.find((s) => s.language === "hi");
    expect(hindiStream?.hasRedactedAuth).toBe(true);
    expect(hindiStream?.publicHeaders["Cookie"]).toBeUndefined();
    expect(hindiStream?.publicHeaders["Referer"]).toBe("https://player.example.com");

    // Search with 1-edit typo ("Indai") finds India squad & match
    const search = searchCricketCatalog({
      query: "Indai",
      limit: 10,
      matches: snapshot.matches,
      series: ALL_CRICKET_SERIES,
      teams: ALL_CRICKET_SQUADS,
      channels: snapshot.channels,
    });
    expect(search.matches.length).toBeGreaterThanOrEqual(1);
    expect(search.teams.some((t) => t.id === "IND")).toBe(true);
  });

  it("parses multi-format provider dates, M3U8 ClearKey directives, and deduplicateCricketMatches", () => {
    expect(parseProviderDateTime("12/04/2026", "14:30:00")).toBe("2026-04-12T14:30:00.000Z");
    expect(parseProviderDateTime(1776004200)).toMatch(/^2026-04-12T/);

    const ck = parseClearKeySpec("00112233445566778899aabbccddeeff:ffeeddccbbaa99887766554433221100");
    expect(ck?.kid).toBe("00112233445566778899aabbccddeeff");
    expect(ck?.key).toBe("ffeeddccbbaa99887766554433221100");

    const m3u = [
      "#EXTM3U",
      '#EXTINF:-1 group-title="Cricket" tvg-logo="https://img.example/w.png",Willow HD',
      "#KODIPROP:inputstream.adaptive.license_key=00112233445566778899aabbccddeeff:ffeeddccbbaa99887766554433221100",
      "https://cdn.example.com/live/index.mpd|Referer=https://ref.example.com",
    ].join("\n");
    const parsedM3u = parseM3uPlaylist(m3u);
    expect(parsedM3u).toHaveLength(1);
    expect(parsedM3u[0]?.drm?.kid).toBe("00112233445566778899aabbccddeeff");
    expect(parsedM3u[0]?.headers["Referer"]).toBe("https://ref.example.com");
    expect(deduplicateCricketMatches([])).toEqual([]);
  });
});
