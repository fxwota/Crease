import type { CreaseEnv } from "../config/env";
import { decryptPlayFyPayload } from "../crypto/playfy";
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
  RawProviderChannel,
  RawProviderEvent,
  RawProviderStream,
} from "./types";

const FIREBASE_SPEC = {
  providerKey: "playfy",
  projectIdOrNumber: "239487160038",
  apiKey: "AIzaSyDdHIwVAD3XgP5bEwZOcR1QIz7gO5q5EoM",
  appId: "1:239487160038:android:308875071ce6f0fd48f527",
  packageName: "com.playfy.tv",
  certSha1: "31CD6939D1BEAE32D1B0EF2D9460B170116A1885",
} as const;

const FALLBACK_DOMAINS = [
  "https://easypdfmaker.online",
  "https://reliablewebcenter.online",
] as const;

const USER_AGENT = "PLAYFy/1.7 (Android)";

function buildPlayFyStream(rec: Record<string, unknown>, idx: number): RawProviderStream | null {
  const raw = sanitizeField(rec["url"] ?? rec["link"] ?? rec["stream_url"]);
  if (!raw) return null;
  const { url, headers } = parsePipeHeadersUrl(raw);
  const referer = sanitizeField(rec["referer"] ?? rec["referrer"]);
  const ua = sanitizeField(rec["user_agent"] ?? rec["userAgent"] ?? rec["ua"]);
  const origin = sanitizeField(rec["origin"]);
  if (referer) headers["Referer"] = referer;
  if (ua) headers["User-Agent"] = ua;
  if (origin) headers["Origin"] = origin;

  const drm = parseClearKeySpec(sanitizeField(rec["drm"] ?? rec["clear_key"] ?? rec["key"]));
  const out: RawProviderStream = {
    label: sanitizeField(rec["name"] ?? rec["title"] ?? rec["quality"]) ?? `PlayFy Feed ${idx + 1}`,
    url,
    headers,
  };
  if (drm) out.drm = drm;
  return out;
}

export const playfyProvider: Cs3ProviderAdapter = {
  descriptor: {
    id: "playfy",
    displayName: "PlayFy",
    packageName: FIREBASE_SPEC.packageName,
    customScheme: "playfy://",
    cryptoPipeline: "Dalvik 32-bit FNV-1a Key/IV + AES-128-CBC (PKCS#7 & NoPadding)",
    fallbackDomains: FALLBACK_DOMAINS,
  },

  async fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult> {
    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 3500));
    const rcDomain = extractDomainFromRc(rc, ["baseUrl", "api_url", "base_url", "domain", "url", "playfy_api"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const events: RawProviderEvent[] = [];
    const channels: RawProviderChannel[] = [];
    let resolvedDomain = rcDomain;

    const liveRes = await fetchDecryptedFromCandidates({
      domains,
      paths: ["/cats/live-events.json", "/live-events.json"],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptPlayFyPayload,
    });

    if (liveRes) {
      resolvedDomain = liveRes.domain;
      try {
        const parsed: unknown = JSON.parse(liveRes.text);
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === "object" && Array.isArray((parsed as { data?: unknown[] }).data)
            ? (parsed as { data: unknown[] }).data
            : [];

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (!item || typeof item !== "object") continue;
          const rec = item as Record<string, unknown>;
          const id = sanitizeField(rec["id"] ?? rec["channel_id"] ?? rec["slug"]) ?? `pf-${i + 1}`;
          const title = sanitizeField(rec["title"] ?? rec["name"] ?? rec["match_name"]);
          if (!title) continue;

          const streams: RawProviderStream[] = [];
          const direct = buildPlayFyStream(rec, 0);
          if (direct) {
            streams.push(direct);
          } else {
            streams.push({
              label: "PlayFy Live",
              url: `playfy://${id}`,
              customScheme: `playfy://${id}`,
            });
          }

          const ev: RawProviderEvent = {
            provider: "playfy",
            providerEventId: `playfy_${id}`,
            title,
            streams,
          };
          const tournament = sanitizeField(rec["tournament"] ?? rec["league"] ?? rec["category"]);
          const teamA = sanitizeField(rec["team1"] ?? rec["teamA"]);
          const teamB = sanitizeField(rec["team2"] ?? rec["teamB"]);
          const status = sanitizeField(rec["status"]);
          const startIso = parseProviderDateTime(rec["start_time"] ?? rec["date"], rec["time"]);
          const poster = sanitizeUrl(rec["poster"] ?? rec["image"] ?? rec["logo"]);

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
      provider: "playfy",
      events,
      channels,
    };
    if (resolvedDomain) out.resolvedDomain = resolvedDomain;
    return out;
  },

  async resolveCustomScheme(
    schemePath: string,
    env: CreaseEnv | undefined,
    timeoutMs: number
  ): Promise<RawProviderStream[]> {
    const channelId = schemePath.replace(/^playfy:\/\//i, "").replace(/^\/+/, "").trim();
    if (!channelId) return [];

    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 2500));
    const rcDomain = extractDomainFromRc(rc, ["baseUrl", "api_url", "base_url", "domain", "url", "playfy_api"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: [`/channels/${channelId}.json`, `/cc.json`],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptPlayFyPayload,
    });
    if (!res) return [];

    try {
      const parsed: unknown = JSON.parse(res.text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const out: RawProviderStream[] = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item && typeof item === "object") {
          const s = buildPlayFyStream(item as Record<string, unknown>, i);
          if (s) out.push(s);
        }
      }
      return out;
    } catch {
      return [];
    }
  },
};
