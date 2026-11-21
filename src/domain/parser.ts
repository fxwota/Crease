import { buildBilateralOrCustomSeries, matchKnownSeries } from "./series";
import { resolveCricketSquad } from "./teams";
import type {
  CricketEventKind,
  CricketSeriesRef,
  CricketSquadRef,
  MatchFormat,
  MatchPhase,
  SquadClass,
} from "./types";

export function foldText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectSquadClass(
  text: string,
  series?: CricketSeriesRef
): SquadClass {
  const lower = foldText(text).toLowerCase();

  const isU19 = /\b(u-?19|under-?19|under 19)\b/.test(lower);
  const isWomen = /\b(women'?s?|wmn|ladies|wpl|wbbl|wcpl)\b|(?:\s|-)(w)\b/.test(lower);

  if (isU19 && isWomen) return "U19_WOMENS";
  if (isU19) return "U19_MENS";
  if (isWomen) return "WOMENS";
  if (/\b(legends|masters|champions league|wcl|imlt20)\b/.test(lower)) return "LEGENDS";
  if (/\b([a-z]+\s+a\s+vs|vs\s+[a-z]+\s+a\b|india a|australia a|england lions|pakistan shaheens|new zealand a|south africa a)\b/.test(lower)) {
    return "A_TEAM";
  }

  if (series) {
    return series.squadClass;
  }

  if (/\b(ranji|sheffield shield|county championship|vijay hazare|syed mushtaq|duleep|plunket|marsh cup|super smash|t20 blast)\b/.test(lower)) {
    return "DOMESTIC";
  }
  if (/\b(club|premier club|ecs|european cricket)\b/.test(lower)) {
    return "CLUB";
  }

  return "MENS";
}

export function detectMatchFormat(
  text: string,
  series?: CricketSeriesRef,
  squadClass?: SquadClass
): MatchFormat {
  const lower = foldText(text).toLowerCase();

  if (/\bthe hundred\b|\bhundred\b/.test(lower)) return "HUNDRED";
  if (/\bt10\b|\b10-over\b/.test(lower)) return "T10";
  if (/\bt20i\b|\bt20 international\b/.test(lower)) return "T20I";
  if (/\bodi\b|\bone[- ]day international\b|\b50-over\b/.test(lower)) return "ODI";
  if (/\btest match\b|\btest series\b|\b\d(?:st|nd|rd|th)\s+test\b|\bday\s+[1-5]\b|\bthe ashes\b|\bborder[- ]gavaskar\b|\bwtc\b/.test(lower)) {
    return "TEST";
  }
  if (/\bfirst[- ]class\b|\branji\b|\bsheffield shield\b|\bcounty championship\b|\bplunket shield\b|\bduleep\b/.test(lower)) {
    return "FIRST_CLASS";
  }
  if (/\blist[- ]a\b|\bvijay hazare\b|\bmarsh cup\b|\bford trophy\b|\bone[- ]day cup\b/.test(lower)) {
    return "LIST_A";
  }
  if (/\bt20\b|\bt-20\b|\bipl\b|\bwpl\b|\bbbl\b|\bwbbl\b|\bpsl\b|\bcpl\b|\bsa20\b|\bilt20\b|\bmlc\b|\bbpl\b|\blpl\b|\bnpl\b|\bsuper smash\b|\bt20 blast\b/.test(lower)) {
    if (squadClass === "MENS" || squadClass === "WOMENS") {
      return series?.category === "franchise" || series?.category === "domestic" ? "T20" : "T20I";
    }
    return "T20";
  }

  if (series) {
    return series.defaultFormat;
  }

  return "OTHER";
}

export function extractMatchStage(text: string): { stage?: string; matchNumber?: string } {
  const folded = foldText(text);
  const stageMatch = folded.match(
    /\b(Grand Final|Final|Semi[- ]?Final(?:\s*\d)?|Quarter[- ]?Final(?:\s*\d)?|Qualifier\s*[12]|Eliminator(?:\s*\d)?|Super\s*(?:Four|4|Eight|8|Six|6)|Playoff|Warm[- ]?Up|Practice Match)\b/i
  );
  const numMatch = folded.match(
    /\b(\d+(?:st|nd|rd|th)\s+(?:Test|ODI|T20I|T20|Match)|Match\s*#?\s*\d+|Day\s*[1-5])\b/i
  );

  const result: { stage?: string; matchNumber?: string } = {};
  if (stageMatch?.[1]) result.stage = stageMatch[1].trim();
  if (numMatch?.[1]) result.matchNumber = numMatch[1].trim();
  return result;
}

export function detectEventKind(title: string, hasTwoTeams: boolean): CricketEventKind {
  const lower = title.toLowerCase();
  if (/\b(highlights|replay|review|preview|show|analysis|post[- ]match|pre[- ]match show|press conference|countdown)\b/.test(lower)) {
    return "highlight_or_show";
  }
  if (!hasTwoTeams && /\b(24\/7|channel|tv|live feed|star sports|sky sports|fox cricket|willow|astro cricket|ptv sports|a sports|ten cricket)\b/.test(lower)) {
    return "tournament_channel";
  }
  return hasTwoTeams ? "match" : "tournament_channel";
}

export function normalizeMatchPhase(
  rawStatus: string | undefined,
  startTimeIso: string | undefined,
  endTimeIso: string | undefined,
  hasActiveStreams: boolean,
  nowMs: number = Date.now()
): MatchPhase {
  const status = (rawStatus ?? "").trim().toLowerCase();

  if (/\b(abandon|cancel|postpon|no result|washout)\b/.test(status)) {
    return "abandoned";
  }
  if (/\b(finish|complete|ended|result|won by|stumps|full time)\b/.test(status)) {
    return "completed";
  }
  if (/\b(innings break|lunch|tea|rain delay|drinks|break|stumps)\b/.test(status)) {
    return "break";
  }
  if (/\b(live|in progress|running|ongoing|streaming|now|started)\b/.test(status)) {
    return "live";
  }
  if (/\b(toss|pre[- ]?match|starting soon|lineups)\b/.test(status)) {
    return "pre_match";
  }
  if (/\b(upcoming|scheduled|fixture|soon|later|tomorrow)\b/.test(status)) {
    return "upcoming";
  }

  if (startTimeIso) {
    const startMs = Date.parse(startTimeIso);
    if (Number.isFinite(startMs)) {
      const endMs = endTimeIso ? Date.parse(endTimeIso) : startMs + 6 * 3600 * 1000;
      if (nowMs >= startMs && nowMs <= (Number.isFinite(endMs) ? endMs : startMs + 6 * 3600 * 1000)) {
        return "live";
      }
      if (startMs - nowMs > 0 && startMs - nowMs <= 30 * 60 * 1000) {
        return "pre_match";
      }
      if (startMs > nowMs) {
        return "upcoming";
      }
      if (nowMs > (Number.isFinite(endMs) ? endMs : startMs + 8 * 3600 * 1000)) {
        return "completed";
      }
    }
  }

  return hasActiveStreams ? "live" : "unknown";
}

const BROADCASTER_PATTERNS: ReadonlyArray<{ name: string; rx: RegExp }> = [
  { name: "Star Sports", rx: /\bstar\s*sports?\b/i },
  { name: "JioStar", rx: /\b(jiostar|jio\s*cinema|sports\s*18)\b/i },
  { name: "Sony Sports", rx: /\bsony\s*(sports?|ten|liv)\b/i },
  { name: "Sky Sports Cricket", rx: /\bsky\s*sports?\s*(cricket)?\b/i },
  { name: "Fox Cricket", rx: /\bfox\s*(cricket|sports?)\b/i },
  { name: "Willow Cricket", rx: /\bwillow\b/i },
  { name: "Astro Cricket", rx: /\bastro\s*cricket\b/i },
  { name: "SuperSport Cricket", rx: /\bsuper\s*sport\b/i },
  { name: "PTV Sports", rx: /\bptv\s*sports?\b/i },
  { name: "A Sports", rx: /\ba\s*sports?\b/i },
  { name: "Ten Cricket", rx: /\bten\s*cricket\b/i },
  { name: "T Sports", rx: /\bt\s*sports?\b/i },
  { name: "FanCode", rx: /\bfancode\b/i },
  { name: "TNT Sports", rx: /\btnt\s*sports?\b/i },
  { name: "Prime Video", rx: /\bprime\s*video\b/i },
  { name: "ESPN", rx: /\bespn\b/i },
  { name: "DD Sports", rx: /\bdd\s*sports?\b/i },
  { name: "Geo Super", rx: /\bgeo\s*super\b/i },
];

export function detectBroadcaster(text: string): string | undefined {
  for (const item of BROADCASTER_PATTERNS) {
    if (item.rx.test(text)) return item.name;
  }
  return undefined;
}

export interface ParsedCricketFixtureMeta {
  title: string;
  kind: CricketEventKind;
  format: MatchFormat;
  squadClass: SquadClass;
  series: CricketSeriesRef;
  homeTeam?: CricketSquadRef;
  awayTeam?: CricketSquadRef;
  stage?: string;
  matchNumber?: string;
  broadcaster?: string;
}

export function parseCricketFixtureMeta(input: {
  title: string;
  tournament?: string;
  category?: string;
  teamA?: string;
  teamB?: string;
  teamALogo?: string;
  teamBLogo?: string;
}): ParsedCricketFixtureMeta {
  const cleanTitle = foldText(input.title);
  const combined = `${cleanTitle} ${input.tournament ?? ""} ${input.category ?? ""}`.trim();

  const knownSeries = matchKnownSeries(combined);
  const squadClass = detectSquadClass(combined, knownSeries);
  const format = detectMatchFormat(combined, knownSeries, squadClass);

  // Resolve squads using series & squadClass context to avoid collisions (IND vs IND-W, MI vs MICT)
  const squadCtx = knownSeries
    ? { squadClassHint: squadClass, leagueHint: knownSeries.id }
    : { squadClassHint: squadClass };

  let homeTeam = input.teamA ? resolveCricketSquad(input.teamA, squadCtx) : undefined;
  let awayTeam = input.teamB ? resolveCricketSquad(input.teamB, squadCtx) : undefined;

  if (!homeTeam || !awayTeam) {
    const titleTeams = extractTeamPairFromTitle(cleanTitle);
    if (titleTeams) {
      homeTeam = homeTeam ?? resolveCricketSquad(titleTeams[0], squadCtx);
      awayTeam = awayTeam ?? resolveCricketSquad(titleTeams[1], squadCtx);
    }
  }

  // Upgrade series if both franchises belong to the same known league (e.g. MI vs CSK -> IPL)
  let resolvedSeries = knownSeries;
  if (!resolvedSeries && homeTeam?.leagueId && homeTeam.leagueId === awayTeam?.leagueId) {
    resolvedSeries = matchKnownSeries(homeTeam.leagueId);
  }
  const series =
    resolvedSeries ?? buildBilateralOrCustomSeries(input.tournament, format, squadClass);

  // Re-evaluate format if franchise series inferred from squads
  const finalFormat =
    format === "OTHER" || (series.category === "franchise" && format === "T20I")
      ? series.defaultFormat
      : format;

  const finalSquadClass =
    homeTeam?.squadClass === "WOMENS" || awayTeam?.squadClass === "WOMENS"
      ? "WOMENS"
      : homeTeam?.squadClass === "U19_WOMENS" || awayTeam?.squadClass === "U19_WOMENS"
        ? "U19_WOMENS"
        : homeTeam?.squadClass === "U19_MENS" || awayTeam?.squadClass === "U19_MENS"
          ? "U19_MENS"
          : homeTeam?.squadClass === "A_TEAM" || awayTeam?.squadClass === "A_TEAM"
            ? "A_TEAM"
            : squadClass;

  const { stage, matchNumber } = extractMatchStage(combined);
  const hasTwoTeams = Boolean(homeTeam && awayTeam && homeTeam.id !== awayTeam.id);
  const kind = detectEventKind(cleanTitle, hasTwoTeams);
  const broadcaster = detectBroadcaster(combined);

  const out: ParsedCricketFixtureMeta = {
    title: hasTwoTeams && homeTeam && awayTeam
      ? `${homeTeam.name} vs ${awayTeam.name}${matchNumber ? ` — ${matchNumber}` : stage ? ` — ${stage}` : ""}`
      : cleanTitle,
    kind,
    format: finalFormat,
    squadClass: finalSquadClass,
    series,
  };

  if (homeTeam) {
    out.homeTeam = input.teamALogo ? { ...homeTeam, logoUrl: input.teamALogo } : homeTeam;
  }
  if (awayTeam) {
    out.awayTeam = input.teamBLogo ? { ...awayTeam, logoUrl: input.teamBLogo } : awayTeam;
  }
  if (stage) out.stage = stage;
  if (matchNumber) out.matchNumber = matchNumber;
  if (broadcaster) out.broadcaster = broadcaster;

  return out;
}

function extractTeamPairFromTitle(title: string): [string, string] | undefined {
  // Remove leading tournament prefixes separated by ":" or "|"
  const segments = title.split(/[|:•]/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const match = seg.match(/^(.+?)\s+(?:vs\.?|v\.?|versus)\s+(.+?)(?:\s*[-–—(,]|$)/i);
    if (match?.[1] && match[2]) {
      const left = match[1].replace(/^\d+(?:st|nd|rd|th)\s+\w+\s*/i, "").trim();
      const right = match[2].replace(/\s+(?:live|stream|hd|t20i?|odi|test|match.*|final.*)$/i, "").trim();
      if (left.length >= 2 && right.length >= 2) {
        return [left, right];
      }
    }
  }
  return undefined;
}
