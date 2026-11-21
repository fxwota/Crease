import { APP_VERSION } from "../config/env";
import { fnv1a64Hex } from "../crypto/bytes";
import { classifyCricketEvent, isCricketChannel } from "../domain/classifier";
import { computeCanonicalMatchKey, deduplicateCricketMatches } from "../domain/deduplicator";
import {
  detectBroadcaster,
  normalizeMatchPhase,
  parseCricketFixtureMeta,
} from "../domain/parser";
import {
  buildPlaybackCompatibility,
  detectCommentaryFeedType,
  detectQualityTier,
  detectStreamLanguage,
  detectStreamProtocol,
  rankStreams,
  scoreCricketStream,
} from "../domain/stream-ranker";
import type {
  CricketBroadcaster,
  CricketCatalogSnapshot,
  CricketChannel,
  CricketMatch,
  CricketStream,
  EncryptionType,
  ProviderHealthSnapshot,
  ProviderId,
} from "../domain/types";
import type { ProviderFetchResult, RawProviderStream } from "../providers/types";
import { redactSensitiveHeadersForPublicJson } from "../streaming/headers";

export interface ProviderIngestionReport {
  result: ProviderFetchResult;
  health: ProviderHealthSnapshot;
}

function buildCricketStream(
  provider: ProviderId,
  raw: RawProviderStream,
  idx: number
): CricketStream {
  const { publicHeaders, hasRedactedAuth } = redactSensitiveHeadersForPublicJson(raw.headers);
  const isCustomScheme = Boolean(raw.customScheme) || /^[a-z]+:\/\//i.test(raw.url) && !/^https?:\/\//i.test(raw.url);
  const protocol = detectStreamProtocol(raw.url, raw.typeHint);
  const language = detectStreamLanguage(raw.label);
  const feedType = detectCommentaryFeedType(raw.label, language);
  const { quality, height } = detectQualityTier(raw.label, raw.url);
  const encryption: EncryptionType = raw.drm ? "CLEARKEY" : "NONE";
  const broadcaster = detectBroadcaster(raw.label);

  const compatOpts: {
    protocol: typeof protocol;
    encryption: EncryptionType;
    hasCustomHeaders: boolean;
    isCustomScheme: boolean;
    drm?: NonNullable<RawProviderStream["drm"]>;
  } = {
    protocol,
    encryption,
    hasCustomHeaders: Object.keys(publicHeaders).length > 0 || hasRedactedAuth,
    isCustomScheme,
  };
  if (raw.drm) compatOpts.drm = raw.drm;

  const compatibility = buildPlaybackCompatibility(compatOpts);

  const scoreOpts: {
    provider: ProviderId;
    protocol: typeof protocol;
    resolutionHeight?: number;
    encryption: EncryptionType;
    language: string;
    feedType: typeof feedType;
  } = {
    provider,
    protocol,
    encryption,
    language,
    feedType,
  };
  if (height !== undefined) scoreOpts.resolutionHeight = height;

  const rankScore = scoreCricketStream(scoreOpts);

  const stream: CricketStream = {
    id: `stm_${fnv1a64Hex(`${provider}:${raw.url}:${idx}`)}`,
    provider,
    label: raw.label,
    url: raw.url,
    protocol,
    quality,
    language,
    feedType,
    encryption,
    publicHeaders,
    hasRedactedAuth,
    compatibility,
    rankScore,
  };

  if (raw.customScheme) stream.customScheme = raw.customScheme;
  if (height !== undefined) stream.resolutionHeight = height;
  if (broadcaster) stream.broadcaster = broadcaster;
  if (raw.drm) stream.drm = raw.drm;
  return stream;
}

export function buildCricketCatalogSnapshot(params: {
  reports: readonly ProviderIngestionReport[];
  ingestionDurationMs: number;
  storageMode: "kv" | "memory-fallback";
  nowMs?: number;
}): CricketCatalogSnapshot {
  const nowMs = params.nowMs ?? Date.now();
  const generatedAt = new Date(nowMs).toISOString();
  const todayUtc = generatedAt.slice(0, 10);

  let totalRawEvents = 0;
  let cricketEventsKept = 0;
  let nonCricketDropped = 0;

  const candidateMatches: CricketMatch[] = [];
  const channelMap = new Map<string, CricketChannel>();
  const healthList: ProviderHealthSnapshot[] = [];

  for (const report of params.reports) {
    const { result, health } = report;
    let providerCricketKept = 0;
    let providerNonCricketDropped = 0;
    let providerChannelsKept = 0;

    for (const rawEv of result.events) {
      totalRawEvents++;
      const classInput: {
        title: string;
        category?: string;
        tournament?: string;
        teamA?: string;
        teamB?: string;
        sportHint?: string;
      } = { title: rawEv.title };
      if (rawEv.category) classInput.category = rawEv.category;
      if (rawEv.tournament) classInput.tournament = rawEv.tournament;
      if (rawEv.teamA) classInput.teamA = rawEv.teamA;
      if (rawEv.teamB) classInput.teamB = rawEv.teamB;
      if (rawEv.sportHint) classInput.sportHint = rawEv.sportHint;

      const classification = classifyCricketEvent(classInput);
      if (!classification.isCricket) {
        nonCricketDropped++;
        providerNonCricketDropped++;
        continue;
      }

      cricketEventsKept++;
      providerCricketKept++;

      const parseInput: {
        title: string;
        tournament?: string;
        category?: string;
        teamA?: string;
        teamB?: string;
        teamALogo?: string;
        teamBLogo?: string;
      } = { title: rawEv.title };
      if (rawEv.tournament) parseInput.tournament = rawEv.tournament;
      if (rawEv.category) parseInput.category = rawEv.category;
      if (rawEv.teamA) parseInput.teamA = rawEv.teamA;
      if (rawEv.teamB) parseInput.teamB = rawEv.teamB;
      if (rawEv.teamALogo) parseInput.teamALogo = rawEv.teamALogo;
      if (rawEv.teamBLogo) parseInput.teamBLogo = rawEv.teamBLogo;

      const parsed = parseCricketFixtureMeta(parseInput);
      const streams = rankStreams(
        rawEv.streams.map((s, idx) => buildCricketStream(result.provider, s, idx))
      );

      const dateBucketUtc = rawEv.startTimeIso ? rawEv.startTimeIso.slice(0, 10) : todayUtc;
      const keyInput: {
        format: string;
        squadClass: string;
        homeTeamId?: string;
        awayTeamId?: string;
        seriesId: string;
        dateBucketUtc: string;
        fallbackTitle: string;
      } = {
        format: parsed.format,
        squadClass: parsed.squadClass,
        seriesId: parsed.series.id,
        dateBucketUtc,
        fallbackTitle: parsed.title,
      };
      if (parsed.homeTeam) keyInput.homeTeamId = parsed.homeTeam.id;
      if (parsed.awayTeam) keyInput.awayTeamId = parsed.awayTeam.id;

      const { canonicalKey, matchId } = computeCanonicalMatchKey(keyInput);

      const phase = normalizeMatchPhase(
        rawEv.status,
        rawEv.startTimeIso,
        rawEv.endTimeIso,
        streams.length > 0,
        nowMs
      );

      const broadcasters = new Set<string>();
      if (parsed.broadcaster) broadcasters.add(parsed.broadcaster);
      for (const s of streams) {
        if (s.broadcaster) broadcasters.add(s.broadcaster);
      }

      const languages = [...new Set(streams.map((s) => s.language))];

      const match: CricketMatch = {
        matchId,
        canonicalKey,
        title: parsed.title,
        kind: parsed.kind,
        format: parsed.format,
        squadClass: parsed.squadClass,
        phase,
        series: parsed.series,
        dateBucketUtc,
        broadcasters: [...broadcasters],
        languages: languages.length > 0 ? languages : ["en"],
        hasDrm: streams.some((s) => s.encryption !== "NONE" && s.encryption !== "UNKNOWN"),
        featured: false,
        featuredScore: 0,
        providers: [result.provider],
        providerCount: 1,
        providerEventIds: { [result.provider]: rawEv.providerEventId },
        streams,
        streamCount: streams.length,
        updatedAt: generatedAt,
      };
      if (parsed.stage) match.stage = parsed.stage;
      if (parsed.matchNumber) match.matchNumber = parsed.matchNumber;
      if (parsed.homeTeam) match.homeTeam = parsed.homeTeam;
      if (parsed.awayTeam) match.awayTeam = parsed.awayTeam;
      if (rawEv.startTimeIso) match.startTimeIso = rawEv.startTimeIso;
      if (rawEv.endTimeIso) match.endTimeIso = rawEv.endTimeIso;
      if (rawEv.posterUrl) match.posterUrl = rawEv.posterUrl;

      candidateMatches.push(match);
    }

    // Filter 24/7 channels strictly to cricket / cricket-carrying networks
    for (const rawCh of result.channels) {
      if (!isCricketChannel(rawCh.name, rawCh.category, rawCh.group)) {
        continue;
      }
      providerChannelsKept++;
      const normName = rawCh.name
        .toLowerCase()
        .replace(/\b(hd|fhd|uhd|4k|sd|live|tv|backup|server\s*\d+)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const chKey = normName || rawCh.name.toLowerCase().trim();
      const chStreams = rawCh.streams.map((s, idx) => buildCricketStream(result.provider, s, idx));
      const broadcaster = detectBroadcaster(rawCh.name);
      const language = detectStreamLanguage(rawCh.name);
      const isHd = /\b(hd|fhd|1080p?|720p?|4k|uhd)\b/i.test(rawCh.name);

      const existing = channelMap.get(chKey);
      if (!existing) {
        const ch: CricketChannel = {
          channelId: `chn_${fnv1a64Hex(chKey)}`,
          name: rawCh.name.trim(),
          normalizedName: chKey,
          category: normalizeChannelCategory(rawCh.name, rawCh.category),
          language,
          isHd,
          providers: [result.provider],
          streams: rankStreams(chStreams),
          streamCount: chStreams.length,
        };
        if (broadcaster) ch.broadcaster = broadcaster;
        if (rawCh.logoUrl) ch.logoUrl = rawCh.logoUrl;
        channelMap.set(chKey, ch);
      } else {
        if (!existing.providers.includes(result.provider)) {
          existing.providers.push(result.provider);
        }
        existing.streams = rankStreams([...existing.streams, ...chStreams]);
        existing.streamCount = existing.streams.length;
        existing.isHd = existing.isHd || isHd;
        if (!existing.logoUrl && rawCh.logoUrl) existing.logoUrl = rawCh.logoUrl;
      }
    }

    healthList.push({
      ...health,
      rawEventsFetched: result.events.length,
      cricketEventsKept: providerCricketKept,
      nonCricketDropped: providerNonCricketDropped,
      channelsKept: providerChannelsKept,
    });
  }

  const matches = deduplicateCricketMatches(candidateMatches);
  const channels = [...channelMap.values()].sort(
    (a, b) => b.streamCount - a.streamCount || a.name.localeCompare(b.name)
  );

  const totalStreams =
    matches.reduce((sum, m) => sum + m.streamCount, 0) +
    channels.reduce((sum, ch) => sum + ch.streamCount, 0);

  const dedupRatio =
    cricketEventsKept > 0
      ? Number(((cricketEventsKept - matches.length) / cricketEventsKept).toFixed(4))
      : 0;
  const precisionRatio =
    totalRawEvents > 0 ? Number((cricketEventsKept / totalRawEvents).toFixed(4)) : 1;

  const healthyCount = healthList.filter((h) => h.ok).length;
  const etagSeed = `${APP_VERSION}:${matches.map((m) => `${m.matchId}:${m.phase}:${m.streamCount}`).join(",")}:${channels.length}`;
  const etag = `W/"crk-${fnv1a64Hex(etagSeed)}"`;

  return {
    version: APP_VERSION,
    generatedAt,
    etag,
    matches,
    channels,
    providers: healthList,
    diagnostics: {
      totalRawEvents,
      cricketEventsKept,
      nonCricketDropped,
      cricketPrecisionRatio: precisionRatio,
      deduplicatedMatches: matches.length,
      deduplicationRatio: dedupRatio,
      totalStreams,
      totalChannels: channels.length,
      ingestionDurationMs: params.ingestionDurationMs,
      snapshotAgeSec: 0,
      storageMode: params.storageMode,
      degraded: healthyCount === 0,
    },
  };
}

function normalizeChannelCategory(name: string, rawCategory: string): string {
  const combined = `${name} ${rawCategory}`.toLowerCase();
  if (/\b(willow|sky sports cricket|fox cricket|astro cricket|ten cricket|supersport cricket)\b/.test(combined)) {
    return "24/7 Dedicated Cricket";
  }
  if (/\b(hindi|tamil|telugu|kannada|bengali|marathi|bhojpuri)\b/.test(combined)) {
    return "Regional Cricket Feeds";
  }
  if (/\b(star sports|jiostar|sony|ptv|a sports|t sports|geo super|fancode)\b/.test(combined)) {
    return "Cricket Broadcast Networks";
  }
  return "Cricket Live Channels";
}

export function extractBroadcastersFromSnapshot(
  snapshot: CricketCatalogSnapshot
): CricketBroadcaster[] {
  const map = new Map<
    string,
    { id: string; name: string; matchCount: number; liveMatchCount: number; channelCount: number; languages: Set<string> }
  >();

  const ensure = (name: string) => {
    const id = `brd_${fnv1a64Hex(name.toLowerCase())}`;
    let rec = map.get(id);
    if (!rec) {
      rec = { id, name, matchCount: 0, liveMatchCount: 0, channelCount: 0, languages: new Set<string>() };
      map.set(id, rec);
    }
    return rec;
  };

  for (const m of snapshot.matches) {
    for (const b of m.broadcasters) {
      const rec = ensure(b);
      rec.matchCount++;
      if (m.phase === "live") rec.liveMatchCount++;
      for (const l of m.languages) rec.languages.add(l);
    }
  }

  for (const ch of snapshot.channels) {
    if (!ch.broadcaster) continue;
    const rec = ensure(ch.broadcaster);
    rec.channelCount++;
    rec.languages.add(ch.language);
  }

  return [...map.values()]
    .map((r) => ({
      id: r.id,
      name: r.name,
      matchCount: r.matchCount,
      liveMatchCount: r.liveMatchCount,
      channelCount: r.channelCount,
      languages: [...r.languages],
    }))
    .sort((a, b) => b.liveMatchCount - a.liveMatchCount || b.matchCount + b.channelCount - (a.matchCount + a.channelCount));
}

export function generateCricketXmltvEpg(snapshot: CricketCatalogSnapshot): string {
  const esc = (s: string): string =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const fmtXmlDate = (iso: string): string => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`;
  };

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<tv generator-info-name="Crease Cricket Edge API v${APP_VERSION}">`,
  ];

  for (const m of snapshot.matches) {
    lines.push(`  <channel id="${esc(m.matchId)}">`);
    lines.push(`    <display-name>${esc(m.title)}</display-name>`);
    if (m.posterUrl) lines.push(`    <icon src="${esc(m.posterUrl)}" />`);
    lines.push(`  </channel>`);
  }

  for (const ch of snapshot.channels) {
    lines.push(`  <channel id="${esc(ch.channelId)}">`);
    lines.push(`    <display-name>${esc(ch.name)}</display-name>`);
    if (ch.logoUrl) lines.push(`    <icon src="${esc(ch.logoUrl)}" />`);
    lines.push(`  </channel>`);
  }

  const nowIso = new Date().toISOString();
  for (const m of snapshot.matches) {
    const startIso = m.startTimeIso ?? nowIso;
    const endIso =
      m.endTimeIso ?? new Date(Date.parse(startIso) + 4 * 3600 * 1000).toISOString();
    lines.push(
      `  <programme start="${fmtXmlDate(startIso)}" stop="${fmtXmlDate(endIso)}" channel="${esc(m.matchId)}">`
    );
    lines.push(`    <title lang="en">${esc(m.title)}</title>`);
    lines.push(
      `    <sub-title lang="en">${esc(`${m.series.name} • ${m.format} • ${m.squadClass}`)}</sub-title>`
    );
    lines.push(
      `    <desc lang="en">${esc(`Phase: ${m.phase.toUpperCase()} | Streams: ${m.streamCount} | Providers: ${m.providers.join(", ")}`)}</desc>`
    );
    lines.push(`    <category lang="en">Cricket</category>`);
    lines.push(`    <category lang="en">${esc(m.format)}</category>`);
    lines.push(`  </programme>`);
  }

  lines.push(`</tv>`);
  return lines.join("\n");
}

export function generateCricketM3u8Playlist(params: {
  snapshot: CricketCatalogSnapshot;
  proxyOrigin: string;
  formatFilter?: string;
  useProxy?: boolean;
}): string {
  const lines: string[] = [`#EXTM3U x-tvg-url="${params.proxyOrigin}/api/v1/epg.xml"`];

  const matches = params.formatFilter
    ? params.snapshot.matches.filter((m) => m.format === params.formatFilter)
    : params.snapshot.matches;

  for (const m of matches) {
    const topStream = m.streams[0];
    if (!topStream) continue;

    const group = `${m.series.shortName} (${m.format})`;
    const logo = m.posterUrl ? ` tvg-logo="${m.posterUrl}"` : "";
    lines.push(
      `#EXTINF:-1 tvg-id="${m.matchId}" tvg-name="${m.title.replace(/"/g, "'")}"${logo} group-title="${group.replace(/"/g, "'")}",${m.title} [${topStream.quality}]`
    );

    if (topStream.drm && topStream.drm.kid && topStream.drm.key) {
      lines.push(`#KODIPROP:inputstream.adaptive.license_type=clearkey`);
      lines.push(`#KODIPROP:inputstream.adaptive.license_key=${topStream.drm.kid}:${topStream.drm.key}`);
    }

    const playUrl =
      params.useProxy !== false || topStream.compatibility.requiresProxy
        ? `${params.proxyOrigin}/api/v1/proxy?url=${encodeURIComponent(topStream.url)}`
        : topStream.url;
    lines.push(playUrl);
  }

  for (const ch of params.snapshot.channels) {
    const topStream = ch.streams[0];
    if (!topStream) continue;
    const logo = ch.logoUrl ? ` tvg-logo="${ch.logoUrl}"` : "";
    lines.push(
      `#EXTINF:-1 tvg-id="${ch.channelId}" tvg-name="${ch.name.replace(/"/g, "'")}"${logo} group-title="${ch.category.replace(/"/g, "'")}",${ch.name}`
    );
    if (topStream.drm && topStream.drm.kid && topStream.drm.key) {
      lines.push(`#KODIPROP:inputstream.adaptive.license_type=clearkey`);
      lines.push(`#KODIPROP:inputstream.adaptive.license_key=${topStream.drm.kid}:${topStream.drm.key}`);
    }
    const playUrl =
      params.useProxy !== false || topStream.compatibility.requiresProxy
        ? `${params.proxyOrigin}/api/v1/proxy?url=${encodeURIComponent(topStream.url)}`
        : topStream.url;
    lines.push(playUrl);
  }

  return lines.join("\n");
}
