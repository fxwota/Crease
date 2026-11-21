import type { CreaseEnv } from "../config/env";
import { decryptPlayZtvPayload } from "../crypto/playztv";
import {
  fetchDecryptedFromCandidates,
  parsePipeHeadersUrl,
  parseProviderDateTime,
  sanitizeField,
  sanitizeUrl,
  unwrapNestedRecords,
} from "./base";
import { parseClearKeySpec } from "./drm";
import { extractDomainFromRc, fetchFirebaseRemoteConfig } from "./firebase-rc";
import type {
  Cs3ProviderAdapter,
  ProviderFetchResult,
  RawProviderEvent,
  RawProviderStream,
} from "./types";

const FIREBASE_SPEC = {
  providerKey: "playztv",
  projectIdOrNumber: "516859456626",
  apiKey: "AIzaSyDKRqLlbaZBIpHzLBiQTUrJqr3gN-nDWWc",
  appId: "1:516859456626:android:12a75869902c4f8a6826eb",
  packageName: "com.playz.tv",
} as const;

const FALLBACK_DOMAINS = [
  "https://pabbdyzone.shop",
  "https://tourniquest.site",
  "https://adsflw.xyz",
  "https://playztv2828.store",
] as const;

const USER_AGENT = "okhttp/4.12.0";

function extractPlayZtvStream(rec: Record<string, unknown>, idx: number): RawProviderStream | null {
  const raw = sanitizeField(rec["link"] ?? rec["url"] ?? rec["stream_url"]);
  if (!raw) return null;
  const { url, headers } = parsePipeHeadersUrl(raw);
  const referer = sanitizeField(rec["referer"] ?? rec["referrer"]);
  const ua = sanitizeField(rec["user_agent"] ?? rec["ua"]);
  if (referer) headers["Referer"] = referer;
  if (ua) headers["User-Agent"] = ua;
  const drm = parseClearKeySpec(sanitizeField(rec["key"] ?? rec["drm_key"]));
  const out: RawProviderStream = {
    label: sanitizeField(rec["name"] ?? rec["title"]) ?? `PlayZTV Feed ${idx + 1}`,
    url,
    headers,
  };
  if (drm) out.drm = drm;
  return out;
}

export const playztvProvider: Cs3ProviderAdapter = {
  descriptor: {
    id: "playztv",
    displayName: "PlayZTV",
    packageName: FIREBASE_SPEC.packageName,
    customScheme: "playztv://",
    cryptoPipeline: "libplayztv.so Byte-Reverse + Pair-Swap + Substitution + AES-128-CBC",
    fallbackDomains: FALLBACK_DOMAINS,
  },

  async fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult> {
    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 3500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "playz_api", "domain"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: ["/events.txt", "/categories.txt", "/cats.txt"],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptPlayZtvPayload,
    });

    const events: RawProviderEvent[] = [];
    if (res) {
      try {
        const parsed: unknown = JSON.parse(res.text);
        const records = unwrapNestedRecords(parsed, ["event", "cat", "channel", "data"]);
        for (let i = 0; i < records.length; i++) {
          const rec = records[i]!;
          const title = sanitizeField(rec["title"] ?? rec["name"] ?? rec["event_name"]);
          if (!title) continue;

          const linkPath = sanitizeField(rec["link"] ?? rec["slug"] ?? rec["id"]) ?? `pz-${i + 1}`;
          const streams: RawProviderStream[] = [];
          if (/^https?:\/\//i.test(linkPath)) {
            const s = extractPlayZtvStream(rec, 0);
            if (s) streams.push(s);
          } else {
            streams.push({
              label: "PlayZTV Live",
              url: `playztv://${linkPath}`,
              customScheme: `playztv://${linkPath}`,
            });
          }

          const ev: RawProviderEvent = {
            provider: "playztv",
            providerEventId: `playztv_${i + 1}_${linkPath.slice(0, 24)}`,
            title,
            streams,
          };
          const tournament = sanitizeField(rec["tournament"] ?? rec["league"] ?? rec["cat_name"]);
          const teamA = sanitizeField(rec["team1"] ?? rec["team_a"]);
          const teamB = sanitizeField(rec["team2"] ?? rec["team_b"]);
          const status = sanitizeField(rec["status"]);
          const startIso = parseProviderDateTime(rec["date"] ?? rec["start_time"], rec["time"]);
          const poster = sanitizeUrl(rec["logo"] ?? rec["image"] ?? rec["poster"]);

          if (tournament) ev.tournament = tournament;
          if (teamA) ev.teamA = teamA;
          if (teamB) ev.teamB = teamB;
          if (status) ev.status = status;
          if (startIso) ev.startTimeIso = startIso;
          if (poster) ev.posterUrl = poster;
          events.push(ev);
        }
      } catch {
        // ignore parse errors
      }
    }

    const out: ProviderFetchResult = {
      provider: "playztv",
      events,
      channels: [],
    };
    const domain = res?.domain ?? rcDomain;
    if (domain) out.resolvedDomain = domain;
    return out;
  },

  async resolveCustomScheme(
    schemePath: string,
    env: CreaseEnv | undefined,
    timeoutMs: number
  ): Promise<RawProviderStream[]> {
    const cleanPath = schemePath.replace(/^playztv:\/\//i, "").replace(/^\/+/, "").trim();
    if (!cleanPath) return [];

    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 2500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "playz_api", "domain"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: [`/${cleanPath}`, `/${cleanPath}.txt`],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptPlayZtvPayload,
    });
    if (!res) return [];

    try {
      const parsed: unknown = JSON.parse(res.text);
      const records = unwrapNestedRecords(parsed, ["channel", "event", "data"]);
      const out: RawProviderStream[] = [];
      for (let i = 0; i < records.length; i++) {
        const s = extractPlayZtvStream(records[i]!, i);
        if (s) out.push(s);
      }
      return out;
    } catch {
      return [];
    }
  },
};
