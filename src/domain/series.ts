import type { CricketSeriesRef, MatchFormat, SquadClass } from "./types";

interface SeriesPattern extends CricketSeriesRef {
  patterns: RegExp[];
}

const SERIES_REGISTRY: readonly SeriesPattern[] = [
  {
    id: "icc-t20-wc",
    slug: "icc-t20-world-cup",
    name: "ICC Men's T20 World Cup",
    shortName: "T20 World Cup",
    defaultFormat: "T20I",
    squadClass: "MENS",
    category: "icc",
    patterns: [/\bicc\b.*\bt20\b.*\bworld cup\b/i, /\bt20 world cup\b/i],
  },
  {
    id: "icc-womens-t20-wc",
    slug: "icc-womens-t20-world-cup",
    name: "ICC Women's T20 World Cup",
    shortName: "Women's T20 WC",
    defaultFormat: "T20I",
    squadClass: "WOMENS",
    category: "icc",
    patterns: [/\bwomen'?s?\b.*\bt20\b.*\bworld cup\b/i, /\bt20\b.*\bworld cup\b.*\bwomen'?s?\b/i],
  },
  {
    id: "icc-odi-wc",
    slug: "icc-cricket-world-cup",
    name: "ICC Cricket World Cup",
    shortName: "Cricket World Cup",
    defaultFormat: "ODI",
    squadClass: "MENS",
    category: "icc",
    patterns: [/\bicc\b.*\bcricket world cup\b/i, /\bodi world cup\b/i],
  },
  {
    id: "icc-womens-odi-wc",
    slug: "icc-womens-cricket-world-cup",
    name: "ICC Women's Cricket World Cup",
    shortName: "Women's World Cup",
    defaultFormat: "ODI",
    squadClass: "WOMENS",
    category: "icc",
    patterns: [/\bwomen'?s?\b.*\bcricket world cup\b/i, /\bwomen'?s?\b.*\bodi world cup\b/i],
  },
  {
    id: "icc-ct",
    slug: "icc-champions-trophy",
    name: "ICC Champions Trophy",
    shortName: "Champions Trophy",
    defaultFormat: "ODI",
    squadClass: "MENS",
    category: "icc",
    patterns: [/\bchampions trophy\b/i],
  },
  {
    id: "icc-wtc",
    slug: "icc-world-test-championship",
    name: "ICC World Test Championship",
    shortName: "WTC",
    defaultFormat: "TEST",
    squadClass: "MENS",
    category: "icc",
    patterns: [/\bworld test championship\b/i, /\bwtc\b/i],
  },
  {
    id: "icc-u19-wc",
    slug: "icc-u19-world-cup",
    name: "ICC Under-19 Cricket World Cup",
    shortName: "U19 World Cup",
    defaultFormat: "ODI",
    squadClass: "U19_MENS",
    category: "icc",
    patterns: [/\bu-?19\b.*\bworld cup\b/i, /\bunder-?19\b.*\bworld cup\b/i],
  },
  {
    id: "asia-cup",
    slug: "acc-asia-cup",
    name: "ACC Asia Cup",
    shortName: "Asia Cup",
    defaultFormat: "T20I",
    squadClass: "MENS",
    category: "acc",
    patterns: [/\basia cup\b/i],
  },
  {
    id: "the-ashes",
    slug: "the-ashes",
    name: "The Ashes",
    shortName: "The Ashes",
    defaultFormat: "TEST",
    squadClass: "MENS",
    category: "bilateral",
    patterns: [/\bthe ashes\b/i, /\bashes\b/i],
  },
  {
    id: "bgt",
    slug: "border-gavaskar-trophy",
    name: "Border-Gavaskar Trophy",
    shortName: "BGT",
    defaultFormat: "TEST",
    squadClass: "MENS",
    category: "bilateral",
    patterns: [/\bborder[- ]gavaskar\b/i, /\bbgt\b/i],
  },
  {
    id: "ipl",
    slug: "indian-premier-league",
    name: "Indian Premier League",
    shortName: "IPL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "IN",
    patterns: [/\bipl\b/i, /\bindian premier league\b/i, /\btata ipl\b/i],
  },
  {
    id: "wpl",
    slug: "womens-premier-league",
    name: "Women's Premier League",
    shortName: "WPL",
    defaultFormat: "T20",
    squadClass: "WOMENS",
    category: "franchise",
    country: "IN",
    patterns: [/\bwpl\b/i, /\bwomen'?s premier league\b/i],
  },
  {
    id: "wbbl",
    slug: "womens-big-bash-league",
    name: "Women's Big Bash League",
    shortName: "WBBL",
    defaultFormat: "T20",
    squadClass: "WOMENS",
    category: "franchise",
    country: "AU",
    patterns: [/\bwbbl\b/i, /\bwomen'?s big bash\b/i],
  },
  {
    id: "bbl",
    slug: "big-bash-league",
    name: "Big Bash League",
    shortName: "BBL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "AU",
    patterns: [/\bbbl\b/i, /\bbig bash\b/i],
  },
  {
    id: "psl",
    slug: "pakistan-super-league",
    name: "Pakistan Super League",
    shortName: "PSL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "PK",
    patterns: [/\bpsl\b/i, /\bpakistan super league\b/i, /\bhbl psl\b/i],
  },
  {
    id: "cpl",
    slug: "caribbean-premier-league",
    name: "Caribbean Premier League",
    shortName: "CPL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "WI",
    patterns: [/\bcpl\b/i, /\bcaribbean premier league\b/i],
  },
  {
    id: "sa20",
    slug: "sa20",
    name: "SA20",
    shortName: "SA20",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "ZA",
    patterns: [/\bsa20\b/i, /\bbetway sa20\b/i],
  },
  {
    id: "ilt20",
    slug: "ilt20",
    name: "International League T20",
    shortName: "ILT20",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "AE",
    patterns: [/\bilt20\b/i, /\bdp world ilt20\b/i, /\binternational league t20\b/i],
  },
  {
    id: "mlc",
    slug: "major-league-cricket",
    name: "Major League Cricket",
    shortName: "MLC",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "US",
    patterns: [/\bmlc\b/i, /\bmajor league cricket\b/i],
  },
  {
    id: "hundred",
    slug: "the-hundred",
    name: "The Hundred",
    shortName: "The Hundred",
    defaultFormat: "HUNDRED",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "GB-ENG",
    patterns: [/\bthe hundred\b/i],
  },
  {
    id: "bpl",
    slug: "bangladesh-premier-league",
    name: "Bangladesh Premier League",
    shortName: "BPL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "BD",
    patterns: [/\bbpl\b/i, /\bbangladesh premier league\b/i],
  },
  {
    id: "lpl",
    slug: "lanka-premier-league",
    name: "Lanka Premier League",
    shortName: "LPL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "LK",
    patterns: [/\blpl\b/i, /\blanka premier league\b/i],
  },
  {
    id: "t20-blast",
    slug: "vitality-t20-blast",
    name: "Vitality T20 Blast",
    shortName: "T20 Blast",
    defaultFormat: "T20",
    squadClass: "DOMESTIC",
    category: "domestic",
    country: "GB-ENG",
    patterns: [/\bt20 blast\b/i, /\bvitality blast\b/i],
  },
  {
    id: "super-smash",
    slug: "super-smash",
    name: "Super Smash",
    shortName: "Super Smash",
    defaultFormat: "T20",
    squadClass: "DOMESTIC",
    category: "domestic",
    country: "NZ",
    patterns: [/\bsuper smash\b/i],
  },
  {
    id: "npl",
    slug: "nepal-premier-league",
    name: "Nepal Premier League",
    shortName: "NPL",
    defaultFormat: "T20",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "NP",
    patterns: [/\bnepal premier league\b/i, /\bnpl\b/i],
  },
  {
    id: "abu-dhabi-t10",
    slug: "abu-dhabi-t10",
    name: "Abu Dhabi T10",
    shortName: "T10 League",
    defaultFormat: "T10",
    squadClass: "FRANCHISE",
    category: "franchise",
    country: "AE",
    patterns: [/\babu dhabi t10\b/i, /\bt10 league\b/i, /\bzim afro t10\b/i, /\blanka t10\b/i],
  },
  {
    id: "ranji",
    slug: "ranji-trophy",
    name: "Ranji Trophy",
    shortName: "Ranji Trophy",
    defaultFormat: "FIRST_CLASS",
    squadClass: "DOMESTIC",
    category: "domestic",
    country: "IN",
    patterns: [/\branji trophy\b/i, /\branji\b/i],
  },
  {
    id: "sheffield-shield",
    slug: "sheffield-shield",
    name: "Sheffield Shield",
    shortName: "Sheffield Shield",
    defaultFormat: "FIRST_CLASS",
    squadClass: "DOMESTIC",
    category: "domestic",
    country: "AU",
    patterns: [/\bsheffield shield\b/i],
  },
  {
    id: "county-championship",
    slug: "county-championship",
    name: "County Championship",
    shortName: "County Champ",
    defaultFormat: "FIRST_CLASS",
    squadClass: "DOMESTIC",
    category: "domestic",
    country: "GB-ENG",
    patterns: [/\bcounty championship\b/i],
  },
  {
    id: "wcl-legends",
    slug: "world-championship-of-legends",
    name: "World Championship of Legends",
    shortName: "WCL",
    defaultFormat: "T20",
    squadClass: "LEGENDS",
    category: "legends",
    patterns: [/\blegends league\b/i, /\bworld championship of legends\b/i, /\bmasters league\b/i, /\bimlt20\b/i],
  },
];

export const ALL_CRICKET_SERIES: readonly CricketSeriesRef[] = SERIES_REGISTRY.map(
  ({ patterns: _patterns, ...ref }) => ref
);

const SERIES_BY_ID = new Map<string, CricketSeriesRef>(
  ALL_CRICKET_SERIES.map((s) => [s.id.toLowerCase(), s])
);

export function getSeriesById(idOrSlug: string): CricketSeriesRef | undefined {
  const key = idOrSlug.trim().toLowerCase();
  const direct = SERIES_BY_ID.get(key);
  if (direct) return direct;
  return ALL_CRICKET_SERIES.find(
    (s) => s.slug === key || s.shortName.toLowerCase() === key
  );
}

export function matchKnownSeries(text: string): CricketSeriesRef | undefined {
  for (const entry of SERIES_REGISTRY) {
    if (entry.patterns.some((rx) => rx.test(text))) {
      const { patterns: _patterns, ...ref } = entry;
      return ref;
    }
  }
  return undefined;
}

export function buildBilateralOrCustomSeries(
  rawSeriesName: string | undefined,
  format: MatchFormat,
  squadClass: SquadClass
): CricketSeriesRef {
  const cleaned = (rawSeriesName ?? "").trim();
  if (cleaned) {
    const known = matchKnownSeries(cleaned);
    if (known) return known;
    const slug = cleaned
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (slug) {
      return {
        id: `series-${slug}`,
        slug,
        name: cleaned,
        shortName: cleaned.length > 26 ? `${cleaned.slice(0, 24)}…` : cleaned,
        defaultFormat: format,
        squadClass,
        category: "bilateral",
      };
    }
  }

  return {
    id: "international-cricket",
    slug: "international-cricket",
    name: "International Cricket",
    shortName: "International",
    defaultFormat: format,
    squadClass,
    category: "bilateral",
  };
}
