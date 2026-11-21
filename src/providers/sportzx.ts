import type { CreaseEnv } from "../config/env";
import { decryptSportzxPayload } from "../crypto/sportzx";
import {
  fetchDecryptedFromCandidates,
  parsePipeHeadersUrl,
  parseProviderDateTime,
  sanitizeField,
  sanitizeUrl,
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
  providerKey: "sportzx",
  projectIdOrNumber: "234785582029",
  apiKey: "AIzaSyCTIFo_vw_-XrjzDeE1yG4KuAqGLchzZ0M",
  appId: "1:234785582029:android:f5f9299eaa7a0d73c93284",
  packageName: "com.sportzxtv.app",
  certSha1: "C506E5FE9C49CABD6A5AEAC643B7C3AA3C3FE9CF",
} as const;

const FALLBACK_DOMAINS = [
  "https://world.playfy.stream",
  "https://android.onlystream.stream",
] as const;

const USER_AGENT = "okhttp/4.12.0";

function parseStreamItem(rec: Record<string, unknown>, idx: number): RawProviderStream | null {
  const raw = sanitizeField(rec["link"] ?? rec["url"] ?? rec["stream_url"]);
  if (!raw) return null;
  const { url, headers } = parsePipeHeadersUrl(raw);
  const referer = sanitizeField(rec["referer"] ?? rec["referrer"]);
  const ua = sanitizeField(rec["user_agent"] ?? rec["userAgent"] ?? rec["ua"]);
  const origin = sanitizeField(rec["origin"]);
  if (referer) headers["Referer"] = referer;
  if (ua) headers["User-Agent"] = ua;
  if (origin) headers["Origin"] = origin;

  const drm = parseClearKeySpec(
    sanitizeField(rec["drm_key"] ?? rec["clearKey"] ?? rec["key"] ?? rec["license"])
  );

  const out: RawProviderStream = {
    label: sanitizeField(rec["name"] ?? rec["title"] ?? rec["quality"]) ?? `Sportzx Feed ${idx + 1}`,
    url,
    headers,
  };
  if (drm) out.drm = drm;
  return out;
}

export const sportzxProvider: Cs3ProviderAdapter = {
  descriptor: {
    id: "sportzx",
    displayName: "Sportzx",
    packageName: FIREBASE_SPEC.packageName,
    customScheme: "sportzx://",
    cryptoPipeline: "SXR3 ChaCha20-Sponge + 128-bit MAC (Dex & Legacy) + AES-128-CBC Fallbacks",
    fallbackDomains: FALLBACK_DOMAINS,
  },

  async fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult> {
    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 3500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "sportzx_api"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: ["/events.txt", "/events.json"],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptSportzxPayload,
    });

    const events: RawProviderEvent[] = [];
    if (res) {
      try {
        const parsed: unknown = JSON.parse(res.text);
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown[] }).events)
            ? (parsed as { events: unknown[] }).events
            : [];

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (!item || typeof item !== "object") continue;
          const rec = item as Record<string, unknown>;
          const evId = sanitizeField(rec["id"] ?? rec["event_id"]) ?? `sx-${i + 1}`;
          const teamA = sanitizeField(rec["team1"] ?? rec["team_a"] ?? rec["home_team"]);
          const teamB = sanitizeField(rec["team2"] ?? rec["team_b"] ?? rec["away_team"]);
          const title =
            sanitizeField(rec["title"] ?? rec["name"] ?? rec["match_title"]) ??
            (teamA && teamB ? `${teamA} vs ${teamB}` : undefined);
          if (!title) continue;

          const streams: RawProviderStream[] = [];
          const rawLinks = rec["channels"] ?? rec["links"] ?? rec["streams"];
          if (Array.isArray(rawLinks)) {
            for (let j = 0; j < rawLinks.length; j++) {
              const link = rawLinks[j];
              if (link && typeof link === "object") {
                const s = parseStreamItem(link as Record<string, unknown>, j);
                if (s) streams.push(s);
              }
            }
          }
          if (streams.length === 0) {
            streams.push({
              label: "Sportzx Live",
              url: `sportzx://${evId}`,
              customScheme: `sportzx://${evId}`,
            });
          }

          const ev: RawProviderEvent = {
            provider: "sportzx",
            providerEventId: `sportzx_${evId}`,
            title,
            streams,
          };
          const tournament = sanitizeField(rec["tournament"] ?? rec["league"] ?? rec["competition"]);
          const category = sanitizeField(rec["category"] ?? rec["sport"]);
          const status = sanitizeField(rec["status"] ?? rec["state"]);
          const startIso = parseProviderDateTime(rec["start_time"] ?? rec["date"], rec["time"]);
          const poster = sanitizeUrl(rec["poster"] ?? rec["image"]);
          const teamALogo = sanitizeUrl(rec["team1_logo"] ?? rec["team_a_logo"]);
          const teamBLogo = sanitizeUrl(rec["team2_logo"] ?? rec["team_b_logo"]);

          if (tournament) ev.tournament = tournament;
          if (category) {
            ev.category = category;
            ev.sportHint = category;
          }
          if (teamA) ev.teamA = teamA;
          if (teamB) ev.teamB = teamB;
          if (teamALogo) ev.teamALogo = teamALogo;
          if (teamBLogo) ev.teamBLogo = teamBLogo;
          if (poster) ev.posterUrl = poster;
          if (status) ev.status = status;
          if (startIso) ev.startTimeIso = startIso;
          events.push(ev);
        }
      } catch {
        // malformed JSON ignored
      }
    }

    const out: ProviderFetchResult = {
      provider: "sportzx",
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
    const evId = schemePath.replace(/^sportzx:\/\//i, "").replace(/^\/+/, "").trim();
    if (!evId) return [];

    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 2500));
    const rcDomain = extractDomainFromRc(rc, ["api_url", "base_url", "sportzx_api"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: [`/channels/${evId}.json`, `/channels/${evId}.txt`],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptSportzxPayload,
    });
    if (!res) return [];

    try {
      const parsed: unknown = JSON.parse(res.text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const out: RawProviderStream[] = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item && typeof item === "object") {
          const s = parseStreamItem(item as Record<string, unknown>, i);
          if (s) out.push(s);
        }
      }
      return out;
    } catch {
      return [];
    }
  },
};
