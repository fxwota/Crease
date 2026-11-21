import { z } from "zod";

const booleanQuery = z
  .string()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    const lower = val.trim().toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
    return undefined;
  });

const boundedInt = (defaultVal: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return defaultVal;
      const n = Number.parseInt(val, 10);
      if (!Number.isFinite(n)) return defaultVal;
      return Math.max(min, Math.min(max, n));
    });

export const MatchFormatEnum = z.enum([
  "TEST",
  "ODI",
  "T20I",
  "T10",
  "HUNDRED",
  "T20",
  "LIST_A",
  "FIRST_CLASS",
  "OTHER",
]);

export const SquadClassEnum = z.enum([
  "MENS",
  "WOMENS",
  "U19_MENS",
  "U19_WOMENS",
  "A_TEAM",
  "LEGENDS",
  "FRANCHISE",
  "DOMESTIC",
  "CLUB",
]);

export const MatchPhaseQueryEnum = z.enum([
  "all",
  "live",
  "upcoming",
  "pre_match",
  "break",
  "completed",
  "abandoned",
  "unknown",
]);

export const ProviderIdEnum = z.enum([
  "cricify",
  "sportzx",
  "playfy",
  "sktech",
  "playztv",
  "livxow",
]);

export const MatchesQuerySchema = z.object({
  phase: MatchPhaseQueryEnum.optional().default("all"),
  format: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  squadClass: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  series: z.string().trim().max(120).optional(),
  team: z.string().trim().max(80).optional(),
  provider: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
  language: z.string().trim().max(32).optional(),
  drm: booleanQuery,
  featured: booleanQuery,
  kind: z.enum(["all", "match", "tournament_channel", "highlight_or_show"]).optional().default("all"),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(["status", "featured", "streams", "time", "title"]).optional().default("status"),
  page: boundedInt(1, 1, 1000),
  limit: boundedInt(50, 1, 200),
});

export const SeriesQuerySchema = z.object({
  format: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  active: booleanQuery,
  q: z.string().trim().max(120).optional(),
});

export const TeamsQuerySchema = z.object({
  squadClass: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  series: z.string().trim().max(120).optional(),
  active: booleanQuery,
  q: z.string().trim().max(120).optional(),
  limit: boundedInt(150, 1, 300),
});

export const ChannelsQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
  provider: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
  q: z.string().trim().max(120).optional(),
  page: boundedInt(1, 1, 500),
  limit: boundedInt(100, 1, 250),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Query parameter 'q' is required").max(120),
  limit: boundedInt(20, 1, 100),
});

export const ScheduleQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  format: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined)),
});

export const MatchStreamsQuerySchema = z.object({
  protocol: z.enum(["hls", "dash", "mp4", "ts"]).optional(),
  quality: z.string().trim().max(24).optional(),
  language: z.string().trim().max(32).optional(),
  provider: z.string().trim().max(24).optional(),
  probe: booleanQuery,
});

export const InspectStreamQuerySchema = z.object({
  url: z.string().trim().min(8).max(2048),
  referer: z.string().trim().max(1024).optional(),
  userAgent: z.string().trim().max(512).optional(),
  origin: z.string().trim().max(512).optional(),
});

export const ProxyQuerySchema = z.object({
  url: z.string().trim().min(6).max(4096),
  fallback: z.string().trim().max(4096).optional(),
  quality: z.string().trim().max(24).optional(),
  referer: z.string().trim().max(1024).optional(),
  origin: z.string().trim().max(512).optional(),
  ua: z.string().trim().max(512).optional(),
});
