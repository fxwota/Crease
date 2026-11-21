import { fnv1a64Hex } from "../crypto/bytes";
import { rankStreams } from "./stream-ranker";
import type {
  CricketMatch,
  CricketStream,
  MatchPhase,
  ProviderId,
} from "./types";

const PHASE_PRIORITY: Record<MatchPhase, number> = {
  live: 6,
  break: 5,
  pre_match: 4,
  upcoming: 3,
  unknown: 2,
  completed: 1,
  abandoned: 0,
};

const MARQUEE_PAIRS = new Set<string>([
  "IND|PAK",
  "AUS|ENG",
  "AUS|IND",
  "ENG|IND",
  "CSK|MI",
  "CSK|RCB",
  "MI|RCB",
  "IND-W|AUS-W",
  "IND-W|ENG-W",
]);

export function computeCanonicalMatchKey(input: {
  format: string;
  squadClass: string;
  homeTeamId?: string;
  awayTeamId?: string;
  seriesId: string;
  dateBucketUtc: string;
  fallbackTitle: string;
}): { canonicalKey: string; matchId: string } {
  let entityPart: string;
  if (input.homeTeamId && input.awayTeamId) {
    const sorted = [input.homeTeamId.toUpperCase(), input.awayTeamId.toUpperCase()].sort();
    entityPart = `${sorted[0]}_v_${sorted[1]}`;
  } else {
    entityPart = input.fallbackTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  // Order-independent canonical key scoped by format, squadClass, sorted squads, and UTC date bucket
  const canonicalKey = `${input.squadClass.toLowerCase()}:${input.format.toLowerCase()}:${entityPart}:${input.dateBucketUtc}`;
  const matchId = `crk_${fnv1a64Hex(canonicalKey)}`;
  return { canonicalKey, matchId };
}

export function computeFeaturedScore(match: CricketMatch): number {
  let score = 0;
  if (match.phase === "live") score += 40;
  else if (match.phase === "pre_match" || match.phase === "break") score += 28;
  else if (match.phase === "upcoming") score += 12;

  if (match.series.category === "icc") score += 25;
  else if (match.series.id === "ipl" || match.series.id === "wpl" || match.series.id === "the-ashes" || match.series.id === "asia-cup") {
    score += 20;
  } else if (match.series.category === "franchise") {
    score += 12;
  }

  if (match.stage && /\b(final|semi|qualifier|eliminator)\b/i.test(match.stage)) {
    score += 20;
  }

  if (match.homeTeam && match.awayTeam) {
    const pairKey = [match.homeTeam.id, match.awayTeam.id].sort().join("|");
    if (MARQUEE_PAIRS.has(pairKey)) {
      score += 22;
    }
  }

  // Multi-provider consensus bonus
  score += Math.min(20, (match.providerCount - 1) * 7);
  score += Math.min(10, match.streamCount);

  return Math.min(100, score);
}

export function deduplicateCricketMatches(candidates: readonly CricketMatch[]): CricketMatch[] {
  const merged = new Map<string, CricketMatch>();

  for (const item of candidates) {
    const existing = merged.get(item.matchId);
    if (!existing) {
      const cloned: CricketMatch = {
        ...item,
        broadcasters: [...new Set(item.broadcasters)],
        languages: [...new Set(item.languages)],
        providers: [...new Set(item.providers)],
        providerEventIds: { ...item.providerEventIds },
        streams: dedupeStreams(item.streams),
      };
      cloned.providerCount = cloned.providers.length;
      cloned.streamCount = cloned.streams.length;
      merged.set(cloned.matchId, cloned);
      continue;
    }

    // Consensus phase: higher operational phase wins (live > break > pre_match > upcoming > completed)
    if (PHASE_PRIORITY[item.phase] > PHASE_PRIORITY[existing.phase]) {
      existing.phase = item.phase;
    }

    // Prefer richer title/series/stage/venue/poster/time metadata
    if (existing.series.id === "international-cricket" && item.series.id !== "international-cricket") {
      existing.series = item.series;
    }
    if (!existing.stage && item.stage) existing.stage = item.stage;
    if (!existing.matchNumber && item.matchNumber) existing.matchNumber = item.matchNumber;
    if (!existing.venue && item.venue) existing.venue = item.venue;
    if (!existing.posterUrl && item.posterUrl) existing.posterUrl = item.posterUrl;
    if (!existing.startTimeIso && item.startTimeIso) existing.startTimeIso = item.startTimeIso;
    if (!existing.endTimeIso && item.endTimeIso) existing.endTimeIso = item.endTimeIso;
    if (existing.homeTeam && !existing.homeTeam.logoUrl && item.homeTeam?.logoUrl) {
      existing.homeTeam = { ...existing.homeTeam, logoUrl: item.homeTeam.logoUrl };
    }
    if (existing.awayTeam && !existing.awayTeam.logoUrl && item.awayTeam?.logoUrl) {
      existing.awayTeam = { ...existing.awayTeam, logoUrl: item.awayTeam.logoUrl };
    }

    const providers = new Set<ProviderId>([...existing.providers, ...item.providers]);
    existing.providers = [...providers];
    existing.providerCount = existing.providers.length;
    existing.providerEventIds = { ...existing.providerEventIds, ...item.providerEventIds };

    existing.broadcasters = [...new Set([...existing.broadcasters, ...item.broadcasters])];
    existing.languages = [...new Set([...existing.languages, ...item.languages])];
    existing.streams = dedupeStreams([...existing.streams, ...item.streams]);
    existing.streamCount = existing.streams.length;
    existing.hasDrm = existing.hasDrm || item.hasDrm;
    if (item.updatedAt > existing.updatedAt) {
      existing.updatedAt = item.updatedAt;
    }
  }

  const finalized = [...merged.values()].map((m) => {
    const rankedStreams = rankStreams(m.streams);
    const updated: CricketMatch = {
      ...m,
      streams: rankedStreams,
      streamCount: rankedStreams.length,
    };
    const featuredScore = computeFeaturedScore(updated);
    updated.featuredScore = featuredScore;
    updated.featured = featuredScore >= 55;
    return updated;
  });

  // Sort: live first, then featuredScore desc, then startTime asc
  return finalized.sort((a, b) => {
    const phaseDiff = PHASE_PRIORITY[b.phase] - PHASE_PRIORITY[a.phase];
    if (phaseDiff !== 0) return phaseDiff;
    if (b.featuredScore !== a.featuredScore) return b.featuredScore - a.featuredScore;
    if (a.startTimeIso && b.startTimeIso) return a.startTimeIso.localeCompare(b.startTimeIso);
    return a.title.localeCompare(b.title);
  });
}

function dedupeStreams(streams: readonly CricketStream[]): CricketStream[] {
  const seen = new Map<string, CricketStream>();
  for (const s of streams) {
    const key = `${s.provider}:${s.url}`;
    const prev = seen.get(key);
    if (!prev || s.rankScore > prev.rankScore) {
      seen.set(key, s);
    }
  }
  return rankStreams([...seen.values()]);
}
