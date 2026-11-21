import { foldText } from "./parser";
import type {
  CricketChannel,
  CricketMatch,
  CricketSeriesRef,
  CricketSquadRef,
} from "./types";

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 3 || b.length < 3) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (
        a.length === b.length &&
        i + 1 < a.length &&
        a[i] === b[j + 1] &&
        a[i + 1] === b[j]
      ) {
        i += 2;
        j += 2;
      } else if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    }
  }
  if (i < a.length || j < b.length) {
    edits += (a.length - i) + (b.length - j);
  }
  return edits <= 1;
}

function scoreFieldMatch(query: string, queryTokens: readonly string[], candidate: string, weight: number): number {
  const norm = foldText(candidate).toLowerCase();
  if (!norm) return 0;
  if (norm === query) return weight * 2.0;
  if (norm.startsWith(query)) return weight * 1.5;
  if (norm.includes(query)) return weight * 1.1;

  const words = norm.split(/[^a-z0-9]+/).filter(Boolean);
  let matched = 0;
  for (const qt of queryTokens) {
    if (words.some((w) => w === qt || w.startsWith(qt) || editDistanceAtMostOne(qt, w))) {
      matched++;
    }
  }
  if (matched === 0) return 0;
  return weight * (matched / queryTokens.length) * 0.85;
}

export interface CricketSearchResults {
  query: string;
  totalHits: number;
  matches: CricketMatch[];
  series: CricketSeriesRef[];
  teams: CricketSquadRef[];
  channels: CricketChannel[];
}

export function searchCricketCatalog(params: {
  query: string;
  limit: number;
  matches: readonly CricketMatch[];
  series: readonly CricketSeriesRef[];
  teams: readonly CricketSquadRef[];
  channels: readonly CricketChannel[];
}): CricketSearchResults {
  const query = foldText(params.query).toLowerCase();
  const tokens = query.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  const effectiveTokens = tokens.length > 0 ? tokens : [query];

  const scoredMatches = params.matches
    .map((m) => {
      const score = Math.max(
        scoreFieldMatch(query, effectiveTokens, m.title, 100),
        scoreFieldMatch(query, effectiveTokens, m.series.name, 85),
        scoreFieldMatch(query, effectiveTokens, m.series.shortName, 85),
        scoreFieldMatch(query, effectiveTokens, m.format, 60),
        m.homeTeam ? scoreFieldMatch(query, effectiveTokens, `${m.homeTeam.code} ${m.homeTeam.name}`, 95) : 0,
        m.awayTeam ? scoreFieldMatch(query, effectiveTokens, `${m.awayTeam.code} ${m.awayTeam.name}`, 95) : 0,
        scoreFieldMatch(query, effectiveTokens, m.broadcasters.join(" "), 50)
      );
      return { item: m, score: score + (m.phase === "live" && score > 0 ? 15 : 0) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((e) => e.item);

  const scoredSeries = params.series
    .map((s) => ({
      item: s,
      score: Math.max(
        scoreFieldMatch(query, effectiveTokens, s.name, 100),
        scoreFieldMatch(query, effectiveTokens, s.shortName, 95),
        scoreFieldMatch(query, effectiveTokens, s.slug, 80)
      ),
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((e) => e.item);

  const scoredTeams = params.teams
    .map((t) => ({
      item: t,
      score: Math.max(
        scoreFieldMatch(query, effectiveTokens, t.code, 100),
        scoreFieldMatch(query, effectiveTokens, t.name, 95),
        scoreFieldMatch(query, effectiveTokens, t.aliases.join(" "), 80)
      ),
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((e) => e.item);

  const scoredChannels = params.channels
    .map((ch) => ({
      item: ch,
      score: Math.max(
        scoreFieldMatch(query, effectiveTokens, ch.name, 100),
        scoreFieldMatch(query, effectiveTokens, ch.category, 70),
        ch.broadcaster ? scoreFieldMatch(query, effectiveTokens, ch.broadcaster, 85) : 0
      ),
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((e) => e.item);

  return {
    query: params.query,
    totalHits:
      scoredMatches.length + scoredSeries.length + scoredTeams.length + scoredChannels.length,
    matches: scoredMatches,
    series: scoredSeries,
    teams: scoredTeams,
    channels: scoredChannels,
  };
}
