import type { CreaseEnv } from "../config/env";
import { base64ToBytes, bytesToUtf8 } from "../crypto/bytes";
import { decryptLivXowPayload } from "../crypto/livxow";
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
  providerKey: "livxow",
  projectIdOrNumber: "459539398637",
  apiKey: "AIzaSyBIfjXqlm2QLLctnTUQUNK9j9Kf2ybS7yw",
  appId: "1:459539398637:android:96270124df48971af131e4",
  packageName: "com.livxow.tv",
} as const;

const FALLBACK_DOMAINS = [
  "https://hsueuekaiwhhe.shop",
  "https://welalagaa.site",
  "https://sohaidoegeve2.shop",
] as const;

const USER_AGENT = "okhttp/4.9.2";

function decodeProPathIfBase64Url(raw: string): string {
  if (/^https?:\/\//i.test(raw) || raw.includes(".txt") || raw.includes("/")) {
    return raw;
  }
  try {
    const decoded = bytesToUtf8(base64ToBytes(raw)).trim();
    if (decoded && /^[\w./:-]+$/.test(decoded)) {
      return decoded;
    }
  } catch {
    // keep raw
  }
  return raw;
}

function extractLivXowStream(rec: Record<string, unknown>, idx: number): RawProviderStream | null {
  const raw = sanitizeField(rec["link"] ?? rec["url"] ?? rec["stream_url"]);
  if (!raw) return null;
  const { url, headers } = parsePipeHeadersUrl(raw);
  const referer = sanitizeField(rec["referer"] ?? rec["referrer"]);
  const ua = sanitizeField(rec["user_agent"] ?? rec["ua"]);
  if (referer) headers["Referer"] = referer;
  if (ua) headers["User-Agent"] = ua;
  const drm = parseClearKeySpec(sanitizeField(rec["key"] ?? rec["drm_key"]));
  const out: RawProviderStream = {
    label: sanitizeField(rec["name"] ?? rec["title"]) ?? `LivXow Feed ${idx + 1}`,
    url,
    headers,
  };
  if (drm) out.drm = drm;
  return out;
}

export const livxowProvider: Cs3ProviderAdapter = {
  descriptor: {
    id: "livxow",
    displayName: "LivXow",
    packageName: FIREBASE_SPEC.packageName,
    customScheme: "livxow://",
    cryptoPipeline: "Multi-Pass Substitution + Base64url pro/*.txt + AES-128-CBC",
    fallbackDomains: FALLBACK_DOMAINS,
  },

  async fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult> {
    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 3500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "livxow_api", "domain"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: ["/events.txt", "/categories.txt", "/cats.txt"],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptLivXowPayload,
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

          const rawLink = sanitizeField(rec["link"] ?? rec["slug"] ?? rec["id"]) ?? `lx-${i + 1}`;
          const linkPath = decodeProPathIfBase64Url(rawLink);
          const streams: RawProviderStream[] = [];

          if (/^https?:\/\//i.test(linkPath)) {
            const s = extractLivXowStream({ ...rec, link: linkPath }, 0);
            if (s) streams.push(s);
          } else {
            streams.push({
              label: "LivXow Live",
              url: `livxow://${linkPath}`,
              customScheme: `livxow://${linkPath}`,
            });
          }

          const ev: RawProviderEvent = {
            provider: "livxow",
            providerEventId: `livxow_${i + 1}_${linkPath.slice(0, 24)}`,
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
      provider: "livxow",
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
    const raw = schemePath.replace(/^livxow:\/\//i, "").replace(/^\/+/, "").trim();
    if (!raw) return [];
    const cleanPath = decodeProPathIfBase64Url(raw);

    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 2500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "livxow_api", "domain"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const paths = cleanPath.startsWith("pro/")
      ? [`/${cleanPath}`, `/${cleanPath}.txt`]
      : [`/${cleanPath}`, `/pro/${cleanPath}.txt`, `/${cleanPath}.txt`];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths,
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptLivXowPayload,
    });
    if (!res) return [];

    try {
      const parsed: unknown = JSON.parse(res.text);
      const records = unwrapNestedRecords(parsed, ["channel", "event", "data"]);
      const out: RawProviderStream[] = [];
      for (let i = 0; i < records.length; i++) {
        const s = extractLivXowStream(records[i]!, i);
        if (s) out.push(s);
      }
      return out;
    } catch {
      return [];
    }
  },
};
