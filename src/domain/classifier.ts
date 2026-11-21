import { matchKnownSeries } from "./series";
import { resolveCricketSquad } from "./teams";

// Hard non-cricket exclusion patterns (football, NBA, NFL, NHL, F1, UFC/WWE, tennis, golf, etc.)
const NON_CRICKET_SPORT_RX =
  /\b(football|soccer|premier league|epl|champions league|ucl|europa league|conference league|la liga|laliga|serie a|bundesliga|ligue 1|mls|eredivisie|copa america|euro 20\d\d|fifa|uefa|fa cup|carabao cup|efl|afcon|nba|wnba|euroleague|ncaa basketball|nfl|super bowl|nhl|stanley cup|formula 1|formula one|f1 gp|grand prix|motogp|nascar|indycar|ufc|mma|bellator|pfl|wwe|aew|raw|smackdown|wrestlemania|boxing|heavyweight|atp|wta|wimbledon|roland garros|french open|australian open|us open tennis|davis cup|pga tour|lpga|ryder cup|masters golf|snooker|darts|pdc|tour de france|giro d'italia|cycling|rugby|six nations|nrl|afl|mlb|baseball|volleyball|handball|table tennis|badminton|bwf|kabaddi|pkl|pro kabaddi|hockey|fih|isl football|saudi pro league|real madrid|barcelona|manchester united|man utd|man city|manchester city|liverpool|arsenal|chelsea|tottenham|bayern munich|juventus|inter milan|ac milan|psg|paris saint|atletico madrid|borussia dortmund|lakers|celtics|warriors|chiefs|eagles|yankees|dodgers)\b/i;

const POSITIVE_CRICKET_KEYWORDS_RX =
  /\b(cricket|ipl|wpl|bbl|wbbl|psl|cpl|wcpl|sa20|ilt20|mlc|bpl|lpl|npl|t20i?|odi|t10|test match|test series|the ashes|ashes|border[- ]gavaskar|champions trophy|world test championship|wtc|ranji|sheffield shield|county championship|super smash|t20 blast|vitality blast|the hundred|syed mushtaq ali|vijay hazare|duleep trophy|irani cup|plunket shield|marsh cup|ford trophy|asia cup|icc|acc|bcci|pcb|ecb|cricinfo|willow cricket|astro cricket|fox cricket|sky sports cricket|ten cricket|supersport cricket|star sports.*cricket)\b/i;

// 24/7 Cricket channels & major regional sports networks that routinely broadcast cricket
const CRICKET_CHANNEL_ALLOW_RX =
  /\b(cricket|willow|astro cricket|fox cricket|sky sports cricket|ten cricket|supersport cricket|star sports\s*(1|2|3|select|hindi|tamil|telugu|kannada|hd)?|sony\s*(sports\s*)?ten\s*(1|2|3|5)|ptv sports|a sports|geo super|t sports|gazi tv|gtv|dd sports|fancode|jio\s*cinema|jiostar|sports\s*18|tnt sports|sky sport nz|spark sport|super sport\s*(grandstand|variety|action)|espn\s*caribbean|flow sports)\b/i;

const NON_CRICKET_CHANNEL_DENY_RX =
  /\b(sky sports (f1|football|premier league|golf|nfl|nba|tennis|racing|boxing|arena)|fox (soccer|nfl|nascar)|nba tv|nfl network|nhl network|mlb network|golf channel|tennis channel|wwe network|ufc|mutv|lfctv|chelsea tv|real madrid tv|barca tv|eurosport|beinsport|bein sports|dazn (boxing|f1)|motorsport|racing tv|espn (u|news|deportes|fc)|cbs sports golazo|tnt sports (ufc|football)|news|movies|cinema|kids|cartoon|music|comedy|documentary|discovery|nat geo|animal planet|mtv|vh1|cnn|bbc news|al jazeera|fox news)\b/i;

export interface CricketClassificationInput {
  title: string;
  category?: string;
  tournament?: string;
  teamA?: string;
  teamB?: string;
  sportHint?: string;
}

export interface CricketClassificationResult {
  isCricket: boolean;
  confidence: number;
  reason: string;
}

export function classifyCricketEvent(
  input: CricketClassificationInput
): CricketClassificationResult {
  const combined = [
    input.title,
    input.category ?? "",
    input.tournament ?? "",
    input.teamA ?? "",
    input.teamB ?? "",
    input.sportHint ?? "",
  ]
    .join(" ")
    .trim();

  if (!combined) {
    return { isCricket: false, confidence: 0, reason: "empty_input" };
  }

  // Explicit sport hint check
  const hint = (input.sportHint ?? "").trim().toLowerCase();
  if (hint && hint !== "cricket" && hint !== "live" && hint !== "sports" && hint !== "all") {
    if (NON_CRICKET_SPORT_RX.test(hint)) {
      return { isCricket: false, confidence: 0.99, reason: "explicit_non_cricket_sport_hint" };
    }
  }

  // Positive signals evaluated carefully against negative non-cricket signals
  const hasExplicitCricket = POSITIVE_CRICKET_KEYWORDS_RX.test(combined);
  const hasKnownCricketSeries = Boolean(matchKnownSeries(combined));
  const hasNonCricket = NON_CRICKET_SPORT_RX.test(combined);

  // Guard: "Indian Premier League" contains "Premier League" — strip IPL/WPL/CPL/BPL/LPL/NPL before negative check
  const sanitizedForNegative = combined
    .replace(/\b(indian|women'?s|caribbean|bangladesh|lanka|nepal)\s+premier\s+league\b/gi, "")
    .replace(/\bpremier\s+league\s+cricket\b/gi, "");
  const trueNonCricket = NON_CRICKET_SPORT_RX.test(sanitizedForNegative);

  if (trueNonCricket && !hasExplicitCricket && !hasKnownCricketSeries) {
    return { isCricket: false, confidence: 0.97, reason: "matched_non_cricket_sport" };
  }

  // If both negative and cricket terms appear (e.g., "Football UEFA Champions League" shouldn't pass),
  // require unmistakable cricket series or explicit "cricket" keyword.
  if (trueNonCricket && hasNonCricket) {
    if (!/\bcricket\b/i.test(combined) && !hasKnownCricketSeries) {
      return { isCricket: false, confidence: 0.9, reason: "ambiguous_non_cricket_dominant" };
    }
  }

  if (hint === "cricket" || hasExplicitCricket || hasKnownCricketSeries) {
    return { isCricket: true, confidence: 0.98, reason: "explicit_cricket_signal" };
  }

  // Check if both teams resolve cleanly as cricket squads
  const squadA = input.teamA ? resolveCricketSquad(input.teamA) : undefined;
  const squadB = input.teamB ? resolveCricketSquad(input.teamB) : undefined;
  if (squadA && squadB && squadA.id !== squadB.id) {
    // Reject if both are generic country names AND a non-cricket context wasn't checked? Already checked trueNonCricket above.
    // Extra safety: if both are franchise squads, 100% cricket!
    if (squadA.leagueId || squadB.leagueId) {
      return { isCricket: true, confidence: 0.96, reason: "cricket_franchise_squads" };
    }
    // Two ICC nations with vs/v and no non-cricket terms -> likely cricket on CS3 cricket-heavy apps
    return { isCricket: true, confidence: 0.82, reason: "icc_national_squad_pair" };
  }

  // Check title for "X vs Y" where squads resolve to cricket franchises
  const vsMatch = input.title.match(/^(.+?)\s+(?:vs\.?|v\.?|versus)\s+(.+?)(?:\s*[-|:(]|$)/i);
  if (vsMatch) {
    const left = resolveCricketSquad(vsMatch[1] ?? "");
    const right = resolveCricketSquad(vsMatch[2] ?? "");
    if (left && right && left.id !== right.id) {
      if (left.leagueId || right.leagueId) {
        return { isCricket: true, confidence: 0.95, reason: "title_cricket_franchises" };
      }
      return { isCricket: true, confidence: 0.8, reason: "title_icc_nations" };
    }
  }

  return { isCricket: false, confidence: 0.7, reason: "no_cricket_signal" };
}

export function isCricketChannel(name: string, category?: string, group?: string): boolean {
  const combined = `${name} ${category ?? ""} ${group ?? ""}`.trim();
  if (!combined) return false;

  if (NON_CRICKET_CHANNEL_DENY_RX.test(combined) && !/\bcricket\b/i.test(combined)) {
    return false;
  }

  if (CRICKET_CHANNEL_ALLOW_RX.test(combined)) {
    return true;
  }

  return false;
}
