import { APP_NAME, APP_VERSION } from "../config/env";

export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: `${APP_NAME} — Cricket-Only Edge API`,
    version: APP_VERSION,
    description:
      "Cloudflare Workers-native Cricket Live Fixtures, Streams, 24KB Manifest Inspection & SSRF-Hardened 6-Scheme Edge Proxy API federating 6 reverse-engineered CS3 providers (Cricify, Sportzx, PlayFy, SKTech, PlayZTV, LivXow).",
  },
  servers: [{ url: "/", description: "Current Crease Edge Worker" }],
  tags: [
    { name: "Matches", description: "Canonical cricket fixtures, live/upcoming views, and ranked stream feeds" },
    { name: "Entities", description: "Cricket series, collision-free canonical squads, formats, and catalog snapshots" },
    { name: "Schedule & EPG", description: "Chronological cricket schedule and XMLTV electronic program guide" },
    { name: "Channels & IPTV", description: "24/7 cricket channels, broadcast networks, and dynamic M3U8 playlists" },
    { name: "Streams & Proxy", description: "24KB HLS/DASH manifest inspection and SSRF-hardened 6-scheme edge proxy" },
    { name: "Realtime & System", description: "Edge SSE live feed, typo-tolerant search, provider telemetry, and health" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Realtime & System"],
        summary: "Worker readiness, bindings, snapshot age, and provider circuit states",
        responses: { "200": { description: "Health status envelope" } },
      },
    },
    "/api/v1/matches": {
      get: {
        tags: ["Matches"],
        summary: "Query normalized cricket fixtures with filtering, sorting, pagination & ETag/304",
        parameters: [
          { name: "phase", in: "query", schema: { type: "string", enum: ["all", "live", "upcoming", "pre_match", "break", "completed", "abandoned"] } },
          { name: "format", in: "query", schema: { type: "string", enum: ["TEST", "ODI", "T20I", "T20", "T10", "HUNDRED", "LIST_A", "FIRST_CLASS", "OTHER"] } },
          { name: "squadClass", in: "query", schema: { type: "string", enum: ["MENS", "WOMENS", "U19_MENS", "U19_WOMENS", "A_TEAM", "LEGENDS", "FRANCHISE", "DOMESTIC", "CLUB"] } },
          { name: "series", in: "query", schema: { type: "string" } },
          { name: "team", in: "query", schema: { type: "string" } },
          { name: "provider", in: "query", schema: { type: "string", enum: ["cricify", "sportzx", "playfy", "sktech", "playztv", "livxow"] } },
          { name: "language", in: "query", schema: { type: "string" } },
          { name: "drm", in: "query", schema: { type: "boolean" } },
          { name: "featured", in: "query", schema: { type: "boolean" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["status", "featured", "streams", "time", "title"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          "200": { description: "Paginated cricket matches envelope" },
          "304": { description: "Not Modified when If-None-Match matches catalog ETag" },
        },
      },
    },
    "/api/v1/matches/live": {
      get: {
        tags: ["Matches"],
        summary: "List currently live cricket matches",
        responses: { "200": { description: "Live cricket matches envelope" } },
      },
    },
    "/api/v1/matches/upcoming": {
      get: {
        tags: ["Matches"],
        summary: "List upcoming scheduled cricket fixtures",
        responses: { "200": { description: "Upcoming cricket fixtures envelope" } },
      },
    },
    "/api/v1/matches/featured": {
      get: {
        tags: ["Matches"],
        summary: "List marquee & high-priority cricket matches (ICC finals, rivalries, multi-provider live)",
        responses: { "200": { description: "Featured cricket matches envelope" } },
      },
    },
    "/api/v1/matches/{matchId}": {
      get: {
        tags: ["Matches"],
        summary: "Get canonical cricket match detail & ranked streams",
        parameters: [{ name: "matchId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Cricket match detail" }, "404": { description: "Match not found" } },
      },
    },
    "/api/v1/matches/{matchId}/streams": {
      get: {
        tags: ["Matches"],
        summary: "Get ranked, filtered streams for a cricket match with optional bounded canary probing",
        parameters: [
          { name: "matchId", in: "path", required: true, schema: { type: "string" } },
          { name: "protocol", in: "query", schema: { type: "string", enum: ["hls", "dash", "mp4", "ts"] } },
          { name: "quality", in: "query", schema: { type: "string" } },
          { name: "language", in: "query", schema: { type: "string" } },
          { name: "provider", in: "query", schema: { type: "string" } },
          { name: "probe", in: "query", schema: { type: "boolean" } },
        ],
        responses: { "200": { description: "Resolved streams list" }, "404": { description: "Match not found" } },
      },
    },
    "/api/v1/series": {
      get: {
        tags: ["Entities"],
        summary: "List ICC, ACC, bilateral, franchise & domestic cricket series",
        responses: { "200": { description: "Cricket series list" } },
      },
    },
    "/api/v1/series/{seriesId}": {
      get: {
        tags: ["Entities"],
        summary: "Get cricket series detail, participating squads & fixtures",
        parameters: [{ name: "seriesId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Series detail" }, "404": { description: "Series not found" } },
      },
    },
    "/api/v1/teams": {
      get: {
        tags: ["Entities"],
        summary: "List collision-free canonical cricket squads (IND, IND-W, IND-U19, MI, MI-W, MICT, MINY, MIE)",
        responses: { "200": { description: "Cricket squads list" } },
      },
    },
    "/api/v1/teams/{teamId}": {
      get: {
        tags: ["Entities"],
        summary: "Get canonical squad profile and active fixtures",
        parameters: [{ name: "teamId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Squad detail" }, "404": { description: "Squad not found" } },
      },
    },
    "/api/v1/formats": {
      get: {
        tags: ["Entities"],
        summary: "Breakdown of live and upcoming fixtures by cricket format",
        responses: { "200": { description: "Format breakdown" } },
      },
    },
    "/api/v1/catalog": {
      get: {
        tags: ["Entities"],
        summary: "Full normalized cricket catalog snapshot with ETag/304 support",
        responses: { "200": { description: "Catalog snapshot" }, "304": { description: "Not Modified" } },
      },
    },
    "/api/v1/schedule": {
      get: {
        tags: ["Schedule & EPG"],
        summary: "Chronological cricket schedule grouped by liveNow, startingSoon & UTC date",
        responses: { "200": { description: "Structured schedule" } },
      },
    },
    "/api/v1/epg.xml": {
      get: {
        tags: ["Schedule & EPG"],
        summary: "Standards-compliant XMLTV Electronic Program Guide for cricket fixtures & channels",
        responses: { "200": { description: "XMLTV XML document" } },
      },
    },
    "/api/v1/channels": {
      get: {
        tags: ["Channels & IPTV"],
        summary: "List 24/7 cricket channels & cricket broadcast networks",
        responses: { "200": { description: "Paginated cricket channels" } },
      },
    },
    "/api/v1/channels/categories": {
      get: {
        tags: ["Channels & IPTV"],
        summary: "List cricket channel categories with HD counts",
        responses: { "200": { description: "Channel categories" } },
      },
    },
    "/api/v1/broadcasters": {
      get: {
        tags: ["Channels & IPTV"],
        summary: "List cricket broadcast networks and active match/channel counts",
        responses: { "200": { description: "Broadcasters list" } },
      },
    },
    "/api/v1/playlist.m3u": {
      get: {
        tags: ["Channels & IPTV"],
        summary: "Dynamic IPTV M3U8 playlist for cricket fixtures & 24/7 channels with #KODIPROP ClearKey",
        responses: { "200": { description: "M3U8 playlist" } },
      },
    },
    "/api/v1/streams/inspect": {
      get: {
        tags: ["Streams & Proxy"],
        summary: "Deep 24KB HLS/DASH manifest inspector (renditions, audio tracks, encryption, ClearKey KIDs, LL-HLS/DASH)",
        parameters: [{ name: "url", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Manifest inspection payload" },
          "403": { description: "Blocked by SSRF protection" },
        },
      },
    },
    "/api/v1/proxy": {
      get: {
        tags: ["Streams & Proxy"],
        summary: "SSRF-hardened 6-scheme & HTTPS HLS/DASH Edge Stream Proxy with quality filtering & token inheritance",
        parameters: [
          { name: "url", in: "query", required: true, schema: { type: "string" } },
          { name: "fallback", in: "query", schema: { type: "string" } },
          { name: "quality", in: "query", schema: { type: "string" } },
          { name: "referer", in: "query", schema: { type: "string" } },
          { name: "ua", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Proxied HLS manifest, DASH MPD, or streamed media segment" },
          "403": { description: "Blocked by SSRF protection" },
        },
      },
    },
    "/api/v1/live/sse": {
      get: {
        tags: ["Realtime & System"],
        summary: "Edge-safe TransformStream SSE feed with heartbeats and bounded 55s lifecycle",
        responses: { "200": { description: "text/event-stream" } },
      },
    },
    "/api/v1/search": {
      get: {
        tags: ["Realtime & System"],
        summary: "Weighted, 1-edit typo-tolerant cricket search across matches, series, squads, and channels",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Categorized cricket search results" } },
      },
    },
    "/api/v1/providers": {
      get: {
        tags: ["Realtime & System"],
        summary: "List all 6 CS3 providers with cryptographic pipelines, circuit states, and extraction counts",
        responses: { "200": { description: "Provider list" } },
      },
    },
    "/api/v1/diagnostics": {
      get: {
        tags: ["Realtime & System"],
        summary: "Cricket classification precision, deduplication ratio, L1 cache stats, and provider telemetry",
        responses: { "200": { description: "Diagnostics snapshot" } },
      },
    },
    "/api/v1/stats": {
      get: {
        tags: ["Realtime & System"],
        summary: "Platform-wide cricket statistics across formats, squad classes, protocols, and encryption",
        responses: { "200": { description: "Stats snapshot" } },
      },
    },
    "/api/v1/changelog": {
      get: {
        tags: ["Realtime & System"],
        summary: "Structured release notes & Conventional Commits ledger parsed directly from CHANGELOG.md",
        parameters: [
          { name: "version", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["all", "feat", "fix", "security", "perf", "refactor", "test", "docs", "build", "chore", "breaking"] } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "includeUnreleased", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "Structured changelog envelope" },
          "304": { description: "Not Modified when If-None-Match matches changelog ETag" },
        },
      },
    },
    "/changelog.md": {
      get: {
        tags: ["Realtime & System"],
        summary: "Raw Keep a Changelog 1.1.0 / Conventional Commits CHANGELOG.md document",
        responses: { "200": { description: "text/markdown document" } },
      },
    },
  },
} as const;
