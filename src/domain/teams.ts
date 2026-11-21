import type { CricketSquadRef, SquadClass } from "./types";

interface NationSeed {
  code: string;
  name: string;
  shortName: string;
  countryCode: string;
  aliases: string[];
}

const ICC_NATIONS: readonly NationSeed[] = [
  { code: "IND", name: "India", shortName: "India", countryCode: "IN", aliases: ["ind", "india", "bharat", "team india"] },
  { code: "AUS", name: "Australia", shortName: "Australia", countryCode: "AU", aliases: ["aus", "australia", "aussies"] },
  { code: "ENG", name: "England", shortName: "England", countryCode: "GB-ENG", aliases: ["eng", "england"] },
  { code: "PAK", name: "Pakistan", shortName: "Pakistan", countryCode: "PK", aliases: ["pak", "pakistan"] },
  { code: "NZ", name: "New Zealand", shortName: "New Zealand", countryCode: "NZ", aliases: ["nz", "nzl", "new zealand", "black caps", "blackcaps"] },
  { code: "SA", name: "South Africa", shortName: "South Africa", countryCode: "ZA", aliases: ["sa", "rsa", "saf", "south africa", "proteas"] },
  { code: "SL", name: "Sri Lanka", shortName: "Sri Lanka", countryCode: "LK", aliases: ["sl", "srl", "sri lanka", "srilanka"] },
  { code: "BAN", name: "Bangladesh", shortName: "Bangladesh", countryCode: "BD", aliases: ["ban", "bangladesh", "bd"] },
  { code: "WI", name: "West Indies", shortName: "West Indies", countryCode: "WI", aliases: ["wi", "windies", "west indies"] },
  { code: "AFG", name: "Afghanistan", shortName: "Afghanistan", countryCode: "AF", aliases: ["afg", "afghanistan"] },
  { code: "IRE", name: "Ireland", shortName: "Ireland", countryCode: "IE", aliases: ["ire", "irl", "ireland"] },
  { code: "ZIM", name: "Zimbabwe", shortName: "Zimbabwe", countryCode: "ZW", aliases: ["zim", "zimbabwe"] },
  { code: "NED", name: "Netherlands", shortName: "Netherlands", countryCode: "NL", aliases: ["ned", "netherlands", "holland"] },
  { code: "SCO", name: "Scotland", shortName: "Scotland", countryCode: "GB-SCT", aliases: ["sco", "scotland"] },
  { code: "NAM", name: "Namibia", shortName: "Namibia", countryCode: "NA", aliases: ["nam", "namibia"] },
  { code: "NEP", name: "Nepal", shortName: "Nepal", countryCode: "NP", aliases: ["nep", "nepal"] },
  { code: "UAE", name: "United Arab Emirates", shortName: "UAE", countryCode: "AE", aliases: ["uae", "united arab emirates", "emirates"] },
  { code: "USA", name: "United States", shortName: "USA", countryCode: "US", aliases: ["usa", "united states", "us cricket"] },
  { code: "OMA", name: "Oman", shortName: "Oman", countryCode: "OM", aliases: ["oma", "oman"] },
  { code: "CAN", name: "Canada", shortName: "Canada", countryCode: "CA", aliases: ["can", "canada"] },
  { code: "PNG", name: "Papua New Guinea", shortName: "PNG", countryCode: "PG", aliases: ["png", "papua new guinea"] },
  { code: "UGA", name: "Uganda", shortName: "Uganda", countryCode: "UG", aliases: ["uga", "uganda"] },
  { code: "HK", name: "Hong Kong", shortName: "Hong Kong", countryCode: "HK", aliases: ["hk", "hkg", "hong kong"] },
  { code: "KUW", name: "Kuwait", shortName: "Kuwait", countryCode: "KW", aliases: ["kuw", "kuwait"] },
  { code: "KEN", name: "Kenya", shortName: "Kenya", countryCode: "KE", aliases: ["ken", "kenya"] },
  { code: "ITA", name: "Italy", shortName: "Italy", countryCode: "IT", aliases: ["ita", "italy"] },
  { code: "JER", name: "Jersey", shortName: "Jersey", countryCode: "JE", aliases: ["jer", "jersey"] },
  { code: "BER", name: "Bermuda", shortName: "Bermuda", countryCode: "BM", aliases: ["ber", "bermuda"] },
  { code: "MAS", name: "Malaysia", shortName: "Malaysia", countryCode: "MY", aliases: ["mas", "malaysia"] },
];

const FRANCHISE_SQUADS: readonly CricketSquadRef[] = [
  // IPL (Men's)
  { id: "MI", code: "MI", name: "Mumbai Indians", shortName: "Mumbai", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["mi", "mumbai indians", "mumbai"] },
  { id: "CSK", code: "CSK", name: "Chennai Super Kings", shortName: "Chennai", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["csk", "chennai super kings", "chennai", "super kings"] },
  { id: "RCB", code: "RCB", name: "Royal Challengers Bengaluru", shortName: "Bengaluru", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["rcb", "royal challengers bengaluru", "royal challengers bangalore", "bangalore", "bengaluru"] },
  { id: "KKR", code: "KKR", name: "Kolkata Knight Riders", shortName: "Kolkata", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["kkr", "kolkata knight riders", "kolkata"] },
  { id: "SRH", code: "SRH", name: "Sunrisers Hyderabad", shortName: "Hyderabad", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["srh", "sunrisers hyderabad", "sunrisers", "hyderabad"] },
  { id: "RR", code: "RR", name: "Rajasthan Royals", shortName: "Rajasthan", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["rr", "rajasthan royals", "rajasthan"] },
  { id: "DC", code: "DC", name: "Delhi Capitals", shortName: "Delhi", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["dc", "delhi capitals", "delhi"] },
  { id: "PBKS", code: "PBKS", name: "Punjab Kings", shortName: "Punjab", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["pbks", "kxip", "punjab kings", "punjab"] },
  { id: "GT", code: "GT", name: "Gujarat Titans", shortName: "Gujarat", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["gt", "gujarat titans"] },
  { id: "LSG", code: "LSG", name: "Lucknow Super Giants", shortName: "Lucknow", squadClass: "FRANCHISE", countryCode: "IN", leagueId: "ipl", aliases: ["lsg", "lucknow super giants", "lucknow"] },

  // WPL (Women's Premier League — collision-free distinct IDs from IPL!)
  { id: "MI-W", code: "MI-W", name: "Mumbai Indians Women", shortName: "Mumbai W", squadClass: "WOMENS", countryCode: "IN", leagueId: "wpl", aliases: ["mi-w", "miw", "mi w", "mumbai indians women", "mumbai indians w"] },
  { id: "RCB-W", code: "RCB-W", name: "Royal Challengers Bengaluru Women", shortName: "Bengaluru W", squadClass: "WOMENS", countryCode: "IN", leagueId: "wpl", aliases: ["rcb-w", "rcbw", "rcb w", "royal challengers bengaluru women", "royal challengers bangalore women"] },
  { id: "DC-W", code: "DC-W", name: "Delhi Capitals Women", shortName: "Delhi W", squadClass: "WOMENS", countryCode: "IN", leagueId: "wpl", aliases: ["dc-w", "dcw", "dc w", "delhi capitals women"] },
  { id: "GG-W", code: "GG-W", name: "Gujarat Giants Women", shortName: "Gujarat W", squadClass: "WOMENS", countryCode: "IN", leagueId: "wpl", aliases: ["gg-w", "ggw", "gujarat giants women", "gujarat giants"] },
  { id: "UPW", code: "UPW", name: "UP Warriorz", shortName: "UP Warriorz", squadClass: "WOMENS", countryCode: "IN", leagueId: "wpl", aliases: ["upw", "up warriorz", "up warriorz women"] },

  // SA20 (distinct MI Cape Town vs MI)
  { id: "MICT", code: "MICT", name: "MI Cape Town", shortName: "MI Cape Town", squadClass: "FRANCHISE", countryCode: "ZA", leagueId: "sa20", aliases: ["mict", "mi cape town", "cape town"] },
  { id: "JSK", code: "JSK", name: "Joburg Super Kings", shortName: "Joburg", squadClass: "FRANCHISE", countryCode: "ZA", leagueId: "sa20", aliases: ["jsk", "joburg super kings", "johannesburg super kings"] },
  { id: "DSG", code: "DSG", name: "Durban's Super Giants", shortName: "Durban", squadClass: "FRANCHISE", countryCode: "ZA", leagueId: "sa20", aliases: ["dsg", "durbans super giants", "durban super giants"] },
  { id: "PR", code: "PR", name: "Paarl Royals", shortName: "Paarl", squadClass: "FRANCHISE", countryCode: "ZA", leagueId: "sa20", aliases: ["pr", "paarl royals"] },
  { id: "PC", code: "PC", name: "Pretoria Capitals", shortName: "Pretoria", squadClass: "FRANCHISE", countryCode: "ZA", leagueId: "sa20", aliases: ["pc", "pretoria capitals"] },
  { id: "SEC", code: "SEC", name: "Sunrisers Eastern Cape", shortName: "Eastern Cape", squadClass: "FRANCHISE", countryCode: "ZA", leagueId: "sa20", aliases: ["sec", "sunrisers eastern cape"] },

  // MLC (distinct MI New York vs MI)
  { id: "MINY", code: "MINY", name: "MI New York", shortName: "MI New York", squadClass: "FRANCHISE", countryCode: "US", leagueId: "mlc", aliases: ["miny", "mi new york"] },
  { id: "TSK", code: "TSK", name: "Texas Super Kings", shortName: "Texas", squadClass: "FRANCHISE", countryCode: "US", leagueId: "mlc", aliases: ["tsk", "texas super kings"] },
  { id: "SFU", code: "SFU", name: "San Francisco Unicorns", shortName: "SF Unicorns", squadClass: "FRANCHISE", countryCode: "US", leagueId: "mlc", aliases: ["sfu", "san francisco unicorns"] },
  { id: "SEA", code: "SEA", name: "Seattle Orcas", shortName: "Seattle", squadClass: "FRANCHISE", countryCode: "US", leagueId: "mlc", aliases: ["sea", "seattle orcas"] },
  { id: "WF", code: "WF", name: "Washington Freedom", shortName: "Washington", squadClass: "FRANCHISE", countryCode: "US", leagueId: "mlc", aliases: ["wf", "washington freedom"] },
  { id: "LAKR", code: "LAKR", name: "LA Knight Riders", shortName: "LA Knight Riders", squadClass: "FRANCHISE", countryCode: "US", leagueId: "mlc", aliases: ["lakr", "la knight riders", "los angeles knight riders"] },

  // ILT20 (distinct MI Emirates vs MI)
  { id: "MIE", code: "MIE", name: "MI Emirates", shortName: "MI Emirates", squadClass: "FRANCHISE", countryCode: "AE", leagueId: "ilt20", aliases: ["mie", "mi emirates"] },
  { id: "DCAP", code: "DCAP", name: "Dubai Capitals", shortName: "Dubai", squadClass: "FRANCHISE", countryCode: "AE", leagueId: "ilt20", aliases: ["dcap", "dubai capitals"] },
  { id: "ADKR", code: "ADKR", name: "Abu Dhabi Knight Riders", shortName: "Abu Dhabi", squadClass: "FRANCHISE", countryCode: "AE", leagueId: "ilt20", aliases: ["adkr", "abu dhabi knight riders"] },
  { id: "DV", code: "DV", name: "Desert Vipers", shortName: "Desert Vipers", squadClass: "FRANCHISE", countryCode: "AE", leagueId: "ilt20", aliases: ["dv", "desert vipers"] },
  { id: "GULF", code: "GULF", name: "Gulf Giants", shortName: "Gulf Giants", squadClass: "FRANCHISE", countryCode: "AE", leagueId: "ilt20", aliases: ["gulf", "gulf giants"] },
  { id: "SW", code: "SW", name: "Sharjah Warriorz", shortName: "Sharjah", squadClass: "FRANCHISE", countryCode: "AE", leagueId: "ilt20", aliases: ["sw", "sharjah warriors", "sharjah warriorz"] },

  // BBL & WBBL
  { id: "SIX", code: "SIX", name: "Sydney Sixers", shortName: "Sixers", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["six", "syd6", "sydney sixers"] },
  { id: "THU", code: "THU", name: "Sydney Thunder", shortName: "Thunder", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["thu", "sydt", "sydney thunder"] },
  { id: "STA", code: "STA", name: "Melbourne Stars", shortName: "Stars", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["sta", "mels", "melbourne stars"] },
  { id: "REN", code: "REN", name: "Melbourne Renegades", shortName: "Renegades", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["ren", "melr", "melbourne renegades"] },
  { id: "SCO-BBL", code: "SCO", name: "Perth Scorchers", shortName: "Scorchers", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["per", "perth scorchers", "scorchers"] },
  { id: "HEA", code: "HEA", name: "Brisbane Heat", shortName: "Heat", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["hea", "bris", "brisbane heat"] },
  { id: "STR", code: "STR", name: "Adelaide Strikers", shortName: "Strikers", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["str", "adel", "adelaide strikers"] },
  { id: "HUR", code: "HUR", name: "Hobart Hurricanes", shortName: "Hurricanes", squadClass: "FRANCHISE", countryCode: "AU", leagueId: "bbl", aliases: ["hur", "hob", "hobart hurricanes"] },

  { id: "SIX-W", code: "SIX-W", name: "Sydney Sixers Women", shortName: "Sixers W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["six-w", "sixw", "sydney sixers women"] },
  { id: "THU-W", code: "THU-W", name: "Sydney Thunder Women", shortName: "Thunder W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["thu-w", "thuw", "sydney thunder women"] },
  { id: "STA-W", code: "STA-W", name: "Melbourne Stars Women", shortName: "Stars W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["sta-w", "staw", "melbourne stars women"] },
  { id: "REN-W", code: "REN-W", name: "Melbourne Renegades Women", shortName: "Renegades W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["ren-w", "renw", "melbourne renegades women"] },
  { id: "SCO-W", code: "SCO-W", name: "Perth Scorchers Women", shortName: "Scorchers W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["per-w", "scow", "perth scorchers women"] },
  { id: "HEA-W", code: "HEA-W", name: "Brisbane Heat Women", shortName: "Heat W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["hea-w", "heaw", "brisbane heat women"] },
  { id: "STR-W", code: "STR-W", name: "Adelaide Strikers Women", shortName: "Strikers W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["str-w", "strw", "adelaide strikers women"] },
  { id: "HUR-W", code: "HUR-W", name: "Hobart Hurricanes Women", shortName: "Hurricanes W", squadClass: "WOMENS", countryCode: "AU", leagueId: "wbbl", aliases: ["hur-w", "hurw", "hobart hurricanes women"] },

  // PSL
  { id: "LQ", code: "LQ", name: "Lahore Qalandars", shortName: "Lahore", squadClass: "FRANCHISE", countryCode: "PK", leagueId: "psl", aliases: ["lq", "lahore qalandars"] },
  { id: "KK", code: "KK", name: "Karachi Kings", shortName: "Karachi", squadClass: "FRANCHISE", countryCode: "PK", leagueId: "psl", aliases: ["kk", "karachi kings"] },
  { id: "IU", code: "IU", name: "Islamabad United", shortName: "Islamabad", squadClass: "FRANCHISE", countryCode: "PK", leagueId: "psl", aliases: ["iu", "islamabad united"] },
  { id: "PZ", code: "PZ", name: "Peshawar Zalmi", shortName: "Peshawar", squadClass: "FRANCHISE", countryCode: "PK", leagueId: "psl", aliases: ["pz", "peshawar zalmi"] },
  { id: "QG", code: "QG", name: "Quetta Gladiators", shortName: "Quetta", squadClass: "FRANCHISE", countryCode: "PK", leagueId: "psl", aliases: ["qg", "quetta gladiators"] },
  { id: "MS", code: "MS", name: "Multan Sultans", shortName: "Multan", squadClass: "FRANCHISE", countryCode: "PK", leagueId: "psl", aliases: ["ms", "multan sultans"] },

  // CPL
  { id: "TKR", code: "TKR", name: "Trinbago Knight Riders", shortName: "Trinbago", squadClass: "FRANCHISE", countryCode: "WI", leagueId: "cpl", aliases: ["tkr", "trinbago knight riders"] },
  { id: "GAW", code: "GAW", name: "Guyana Amazon Warriors", shortName: "Guyana", squadClass: "FRANCHISE", countryCode: "WI", leagueId: "cpl", aliases: ["gaw", "guyana amazon warriors"] },
  { id: "BR", code: "BR", name: "Barbados Royals", shortName: "Barbados", squadClass: "FRANCHISE", countryCode: "WI", leagueId: "cpl", aliases: ["br", "barbados royals"] },
  { id: "SLK", code: "SLK", name: "Saint Lucia Kings", shortName: "St Lucia", squadClass: "FRANCHISE", countryCode: "WI", leagueId: "cpl", aliases: ["slk", "saint lucia kings", "st lucia kings"] },
  { id: "SKNP", code: "SKNP", name: "St Kitts & Nevis Patriots", shortName: "St Kitts", squadClass: "FRANCHISE", countryCode: "WI", leagueId: "cpl", aliases: ["sknp", "st kitts and nevis patriots", "st kitts nevis patriots"] },
  { id: "ABF", code: "ABF", name: "Antigua & Barbuda Falcons", shortName: "Antigua", squadClass: "FRANCHISE", countryCode: "WI", leagueId: "cpl", aliases: ["abf", "antigua and barbuda falcons", "antigua falcons"] },

  // The Hundred
  { id: "OI", code: "OI", name: "Oval Invincibles", shortName: "Oval", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["oi", "oval invincibles"] },
  { id: "TR", code: "TR", name: "Trent Rockets", shortName: "Trent", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["tr", "trent rockets"] },
  { id: "BP", code: "BP", name: "Birmingham Phoenix", shortName: "Birmingham", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["bp", "birmingham phoenix"] },
  { id: "SB", code: "SB", name: "Southern Brave", shortName: "Southern Brave", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["sb", "southern brave"] },
  { id: "WFH", code: "WFH", name: "Welsh Fire", shortName: "Welsh Fire", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["welsh fire"] },
  { id: "LS", code: "LS", name: "London Spirit", shortName: "London Spirit", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["ls", "london spirit"] },
  { id: "MO", code: "MO", name: "Manchester Originals", shortName: "Manchester", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["mo", "manchester originals"] },
  { id: "NS", code: "NS", name: "Northern Superchargers", shortName: "Northern", squadClass: "FRANCHISE", countryCode: "GB-ENG", leagueId: "hundred", aliases: ["ns", "northern superchargers"] },

  // BPL & LPL
  { id: "FRB", code: "FRB", name: "Fortune Barishal", shortName: "Barishal", squadClass: "FRANCHISE", countryCode: "BD", leagueId: "bpl", aliases: ["frb", "fortune barishal"] },
  { id: "RRG", code: "RRG", name: "Rangpur Riders", shortName: "Rangpur", squadClass: "FRANCHISE", countryCode: "BD", leagueId: "bpl", aliases: ["rrg", "rangpur riders"] },
  { id: "COM", code: "COM", name: "Comilla Victorians", shortName: "Comilla", squadClass: "FRANCHISE", countryCode: "BD", leagueId: "bpl", aliases: ["comilla victorians"] },
  { id: "JK", code: "JK", name: "Jaffna Kings", shortName: "Jaffna", squadClass: "FRANCHISE", countryCode: "LK", leagueId: "lpl", aliases: ["jk", "jaffna kings"] },
  { id: "GM", code: "GM", name: "Galle Marvels", shortName: "Galle", squadClass: "FRANCHISE", countryCode: "LK", leagueId: "lpl", aliases: ["gm", "galle marvels", "galle titans"] },
  { id: "CS-LPL", code: "CS", name: "Colombo Strikers", shortName: "Colombo", squadClass: "FRANCHISE", countryCode: "LK", leagueId: "lpl", aliases: ["colombo strikers"] },
];

function buildNationalSquads(): CricketSquadRef[] {
  const squads: CricketSquadRef[] = [];
  for (const n of ICC_NATIONS) {
    squads.push({
      id: n.code,
      code: n.code,
      name: n.name,
      shortName: n.shortName,
      squadClass: "MENS",
      countryCode: n.countryCode,
      aliases: [...n.aliases],
    });
    squads.push({
      id: `${n.code}-W`,
      code: `${n.code}-W`,
      name: `${n.name} Women`,
      shortName: `${n.shortName} W`,
      squadClass: "WOMENS",
      countryCode: n.countryCode,
      aliases: [
        `${n.code.toLowerCase()}-w`,
        `${n.code.toLowerCase()}w`,
        `${n.code.toLowerCase()} w`,
        `${n.name.toLowerCase()} women`,
        `${n.name.toLowerCase()} w`,
        `${n.name.toLowerCase()}-w`,
      ],
    });
    squads.push({
      id: `${n.code}-U19`,
      code: `${n.code}-U19`,
      name: `${n.name} U19`,
      shortName: `${n.shortName} U19`,
      squadClass: "U19_MENS",
      countryCode: n.countryCode,
      aliases: [
        `${n.code.toLowerCase()}-u19`,
        `${n.code.toLowerCase()} u19`,
        `${n.name.toLowerCase()} u19`,
        `${n.name.toLowerCase()} under-19`,
        `${n.name.toLowerCase()} under 19`,
      ],
    });
    squads.push({
      id: `${n.code}-U19W`,
      code: `${n.code}-U19W`,
      name: `${n.name} U19 Women`,
      shortName: `${n.shortName} U19W`,
      squadClass: "U19_WOMENS",
      countryCode: n.countryCode,
      aliases: [
        `${n.code.toLowerCase()}-u19w`,
        `${n.code.toLowerCase()} u19 women`,
        `${n.name.toLowerCase()} u19 women`,
        `${n.name.toLowerCase()} women u19`,
      ],
    });
    squads.push({
      id: `${n.code}-A`,
      code: `${n.code}-A`,
      name: `${n.name} A`,
      shortName: `${n.shortName} A`,
      squadClass: "A_TEAM",
      countryCode: n.countryCode,
      aliases: [
        `${n.code.toLowerCase()}-a`,
        `${n.code.toLowerCase()} a`,
        `${n.name.toLowerCase()} a`,
      ],
    });
    squads.push({
      id: `${n.code}-L`,
      code: `${n.code}-L`,
      name: `${n.name} Legends`,
      shortName: `${n.shortName} Legends`,
      squadClass: "LEGENDS",
      countryCode: n.countryCode,
      aliases: [
        `${n.code.toLowerCase()}-l`,
        `${n.name.toLowerCase()} legends`,
        `${n.name.toLowerCase()} champions`,
        `${n.name.toLowerCase()} masters`,
      ],
    });
  }
  return squads;
}

export const ALL_CRICKET_SQUADS: readonly CricketSquadRef[] = [
  ...buildNationalSquads(),
  ...FRANCHISE_SQUADS,
];

const SQUAD_BY_ID = new Map<string, CricketSquadRef>();
const ALIAS_MAP = new Map<string, CricketSquadRef[]>();

function normalizeLookupKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const squad of ALL_CRICKET_SQUADS) {
  SQUAD_BY_ID.set(squad.id.toUpperCase(), squad);
  const keys = new Set<string>([
    normalizeLookupKey(squad.id),
    normalizeLookupKey(squad.code),
    normalizeLookupKey(squad.name),
    normalizeLookupKey(squad.shortName),
    ...squad.aliases.map(normalizeLookupKey),
  ]);
  for (const key of keys) {
    if (!key) continue;
    const list = ALIAS_MAP.get(key) ?? [];
    if (!list.some((item) => item.id === squad.id)) {
      list.push(squad);
      ALIAS_MAP.set(key, list);
    }
  }
}

export interface SquadResolutionContext {
  squadClassHint?: SquadClass;
  leagueHint?: string;
}

export function getSquadById(id: string): CricketSquadRef | undefined {
  return SQUAD_BY_ID.get(id.trim().toUpperCase());
}

export function resolveCricketSquad(
  rawName: string,
  ctx?: SquadResolutionContext
): CricketSquadRef | undefined {
  const cleaned = normalizeLookupKey(rawName);
  if (!cleaned) return undefined;

  // Direct alias lookup
  const direct = ALIAS_MAP.get(cleaned);
  if (direct && direct.length > 0) {
    return selectBestSquadCandidate(direct, ctx);
  }

  // Detect explicit inline squad modifiers (Women / U19 / A / Legends) on base nation or franchise
  const hasU19 = /\b(u19|u-19|under 19|under-19)\b/.test(cleaned);
  const hasWomen = /\b(women|womens|wmn|ladies)\b|(?:\s|-)(w)$/.test(cleaned);
  const hasATeam = /(?:\s|-)(a)$|\b(a team|shaheens|lions)\b/.test(cleaned);
  const hasLegends = /\b(legends|champions|masters)\b/.test(cleaned);

  const stripped = cleaned
    .replace(/\b(u19|u-19|under 19|under-19|women|womens|wmn|ladies|legends|champions|masters|xi|cricket|team|men|mens)\b/g, " ")
    .replace(/(?:\s|-)(w|a)$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped && stripped !== cleaned) {
    const baseCandidates = ALIAS_MAP.get(stripped);
    if (baseCandidates && baseCandidates.length > 0) {
      const desiredClass: SquadClass | undefined =
        hasU19 && hasWomen
          ? "U19_WOMENS"
          : hasU19
            ? "U19_MENS"
            : hasWomen
              ? "WOMENS"
              : hasATeam
                ? "A_TEAM"
                : hasLegends
                  ? "LEGENDS"
                  : ctx?.squadClassHint;

      const base = baseCandidates[0]!;
      const variant = mapBaseSquadToClass(base, desiredClass, ctx?.leagueHint);
      if (variant) return variant;
    }
  }

  // Upgrade base squad when league/context explicitly signals WOMENS/U19/A_TEAM/LEGENDS
  if (ctx?.squadClassHint && ctx.squadClassHint !== "MENS" && ctx.squadClassHint !== "FRANCHISE") {
    const baseList = ALIAS_MAP.get(cleaned);
    if (baseList && baseList.length > 0) {
      const variant = mapBaseSquadToClass(baseList[0]!, ctx.squadClassHint, ctx.leagueHint);
      if (variant) return variant;
    }
  }

  return undefined;
}

function mapBaseSquadToClass(
  base: CricketSquadRef,
  desiredClass: SquadClass | undefined,
  leagueHint?: string
): CricketSquadRef | undefined {
  if (!desiredClass) return base;
  if (base.squadClass === desiredClass) return base;

  const rootCode = base.id.replace(/-(W|U19W|U19|A|L)$/, "");
  const suffixMap: Partial<Record<SquadClass, string>> = {
    WOMENS: "-W",
    U19_MENS: "-U19",
    U19_WOMENS: "-U19W",
    A_TEAM: "-A",
    LEGENDS: "-L",
  };
  const suffix = suffixMap[desiredClass];
  if (suffix) {
    const exact = SQUAD_BY_ID.get(`${rootCode}${suffix}`);
    if (exact && (!leagueHint || !exact.leagueId || exact.leagueId === leagueHint)) {
      return exact;
    }
  }
  return base;
}

function selectBestSquadCandidate(
  candidates: readonly CricketSquadRef[],
  ctx?: SquadResolutionContext
): CricketSquadRef {
  if (candidates.length === 1) {
    const only = candidates[0]!;
    if (ctx?.squadClassHint && only.squadClass === "MENS" && ctx.squadClassHint !== "MENS") {
      return mapBaseSquadToClass(only, ctx.squadClassHint, ctx.leagueHint) ?? only;
    }
    if (ctx?.squadClassHint === "WOMENS" && only.squadClass === "FRANCHISE") {
      return mapBaseSquadToClass(only, "WOMENS", ctx.leagueHint) ?? only;
    }
    return only;
  }

  if (ctx?.leagueHint) {
    const byLeague = candidates.find((c) => c.leagueId === ctx.leagueHint);
    if (byLeague) return byLeague;
  }
  if (ctx?.squadClassHint) {
    const byClass = candidates.find((c) => c.squadClass === ctx.squadClassHint);
    if (byClass) return byClass;
  }
  return candidates[0]!;
}
