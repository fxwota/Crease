import type { CreaseEnv } from "../config/env";
import { decryptSkTechPayload } from "../crypto/sktech";
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
import { resolveTokenApiStream } from "./token-api";
import type {
  Cs3ProviderAdapter,
  ProviderFetchResult,
  RawProviderChannel,
  RawProviderEvent,
  RawProviderStream,
} from "./types";

const FIREBASE_SPEC = {
  providerKey: "sktech",
  projectIdOrNumber: "330162934410",
  apiKey: "AIzaSyClGjK1EBL-ZLbCoep1z5QSmwMyHshimSk",
  appId: "1:330162934410:android:0d81c4732e3d206d6cd373",
  packageName: "com.live.sktechtv",
} as const;

const FALLBACK_DOMAINS = [
  "https://kk001-a17.pages.dev",
  "https://welalagaa.site",
  "https://matkeritnagurorxbxb.store",
] as const;

const USER_AGENT = "okhttp/4.12.0";

function extractSkTechStream(rec: Record<string, unknown>, idx: number): RawProviderStream | null {
  const raw = sanitizeField(rec["link"] ?? rec["url"] ?? rec["stream_url"]);
  if (!raw) return null;
  const { url, headers } = parsePipeHeadersUrl(raw);
  const referer = sanitizeField(rec["referer"] ?? rec["referrer"]);
  const ua = sanitizeField(rec["user_agent"] ?? rec["ua"]);
  if (referer) headers["Referer"] = referer;
  if (ua) headers["User-Agent"] = ua;
  const drm = parseClearKeySpec(sanitizeField(rec["key"] ?? rec["drm_key"] ?? rec["clear_key"]));
  const out: RawProviderStream = {
    label: sanitizeField(rec["name"] ?? rec["title"]) ?? `SKTech Feed ${idx + 1}`,
    url,
    headers,
  };
  if (drm) out.drm = drm;
  return out;
}

export const sktechProvider: Cs3ProviderAdapter = {
  descriptor: {
    id: "sktech",
    displayName: "SKTech",
    packageName: FIREBASE_SPEC.packageName,
    customScheme: "sktech://",
    cryptoPipeline: "64-Hex Strip + Lookup Table D + V23 Byte-Swap + AES-128-CBC Cascade",
    fallbackDomains: FALLBACK_DOMAINS,
  },

  async fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult> {
    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 3500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "sktech_api", "domain"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: ["/events.txt", "/categories.txt", "/cats.txt"],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptSkTechPayload,
    });

    const events: RawProviderEvent[] = [];
    const channels: RawProviderChannel[] = [];

    if (res) {
      try {
        const parsed: unknown = JSON.parse(res.text);
        const records = unwrapNestedRecords(parsed, ["event", "cat", "channel", "data"]);
        for (let i = 0; i < records.length; i++) {
          const rec = records[i]!;
          const title = sanitizeField(rec["title"] ?? rec["name"] ?? rec["event_name"]);
          if (!title) continue;

          const linkPath = sanitizeField(rec["link"] ?? rec["slug"] ?? rec["id"]) ?? `sk-${i + 1}`;
          const isDirectHttp = /^https?:\/\//i.test(linkPath);

          const streams: RawProviderStream[] = [];
          if (isDirectHttp) {
            const s = extractSkTechStream(rec, 0);
            if (s) streams.push(s);
          } else {
            streams.push({
              label: "SKTech Live",
              url: `sktech://${linkPath}`,
              customScheme: `sktech://${linkPath}`,
            });
          }

          const ev: RawProviderEvent = {
            provider: "sktech",
            providerEventId: `sktech_${i + 1}_${linkPath.slice(0, 24)}`,
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
      provider: "sktech",
      events,
      channels,
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
    const cleanPath = schemePath.replace(/^sktech:\/\//i, "").replace(/^\/+/, "").trim();
    if (!cleanPath) return [];

    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 2500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "sktech_api", "domain"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: [`/${cleanPath}`, `/${cleanPath}.txt`],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptSkTechPayload,
    });
    if (!res) return [];

    try {
      const parsed: unknown = JSON.parse(res.text);
      const records = unwrapNestedRecords(parsed, ["channel", "event", "data"]);
      const out: RawProviderStream[] = [];
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]!;
        const apiType = sanitizeField(rec["type"]);
        const apiUrl = sanitizeField(rec["api"]);
        if (apiType && (apiUrl || sanitizeField(rec["link"]))) {
          const tokenInput: { type?: string; api?: string; link?: string; linkKey?: string; ipApi?: string } = {
            type: apiType,
          };
          const linkVal = sanitizeField(rec["link"]);
          const linkKeyVal = sanitizeField(rec["link_key"]);
          const ipApiVal = sanitizeField(rec["ip_api"]);
          if (apiUrl) tokenInput.api = apiUrl;
          if (linkVal) tokenInput.link = linkVal;
          if (linkKeyVal) tokenInput.linkKey = linkKeyVal;
          if (ipApiVal) tokenInput.ipApi = ipApiVal;

          const resolved = await resolveTokenApiStream(tokenInput, timeoutMs);
          if (resolved) {
            out.push({
              label: sanitizeField(rec["name"] ?? rec["title"]) ?? `SKTech Feed ${i + 1}`,
              url: resolved.url,
              headers: resolved.headers,
            });
            continue;
          }
        }
        const s = extractSkTechStream(rec, i);
        if (s) out.push(s);
      }
      return out;
    } catch {
      return [];
    }
  },
};
