import type { CreaseEnv } from "../config/env";
import { decryptCricifyPayload } from "../crypto/cricify";
import {
  fetchDecryptedFromCandidates,
  parsePipeHeadersUrl,
  parseProviderDateTime,
  sanitizeField,
  sanitizeUrl,
} from "./base";
import { parseClearKeySpec } from "./drm";
import { extractDomainFromRc, fetchFirebaseRemoteConfig } from "./firebase-rc";
import { parseM3uPlaylist } from "./m3u";
import type {
  Cs3ProviderAdapter,
  ProviderFetchResult,
  RawProviderChannel,
  RawProviderEvent,
  RawProviderStream,
} from "./types";

const FIREBASE_SPEC = {
  providerKey: "cricify",
  projectIdOrNumber: "963020218535",
  apiKey: "AIzaSyAh9jkEU0E_UYxH0m_BKAt-uUSTiTPqhb8",
  appId: "1:963020218535:android:47ec53252c64fb3c9c7b82",
  packageName: "com.cricfy.tv",
} as const;

const FALLBACK_DOMAINS = [
  "https://cftkhffmgf147.top",
  "https://cfymarkscanjiostar80.top",
  "https://cfyhljddgbkkufh82.top",
] as const;

const M3U_MIRRORS = [
  "https://github.com/abusaeeidx/CricHd-playlists-Auto-Update-permanent/raw/main/ALL.m3u",
  "https://raw.githubusercontent.com/Jitendra-unatti/fancode/refs/heads/main/data/fancode.m3u",
  "https://iptv-org.github.io/iptv/categories/sports.m3u",
] as const;

const USER_AGENT = "okhttp/4.12.0";

function buildStreamFromLinkRecord(rec: Record<string, unknown>, idx: number): RawProviderStream | null {
  const rawLink = sanitizeField(rec["link"] ?? rec["url"] ?? rec["stream_url"]);
  if (!rawLink) return null;
  const { url, headers } = parsePipeHeadersUrl(rawLink);

  const referer = sanitizeField(rec["referer"] ?? rec["referrer"]);
  const origin = sanitizeField(rec["origin"]);
  const ua = sanitizeField(rec["user_agent"] ?? rec["userAgent"] ?? rec["ua"]);
  const cookie = sanitizeField(rec["cookie"]);
  if (referer) headers["Referer"] = referer;
  if (origin) headers["Origin"] = origin;
  if (ua) headers["User-Agent"] = ua;
  if (cookie) headers["Cookie"] = cookie;

  const drm = parseClearKeySpec(
    sanitizeField(rec["drm_key"] ?? rec["clear_key"] ?? rec["key"] ?? rec["license_key"])
  );

  const out: RawProviderStream = {
    label: sanitizeField(rec["name"] ?? rec["title"] ?? rec["label"]) ?? `Cricify Feed ${idx + 1}`,
    url,
    headers,
  };
  if (drm) out.drm = drm;
  const typeHint = sanitizeField(rec["type"] ?? rec["format"]);
  if (typeHint) out.typeHint = typeHint;
  return out;
}

export const cricifyProvider: Cs3ProviderAdapter = {
  descriptor: {
    id: "cricify",
    displayName: "Cricify",
    packageName: FIREBASE_SPEC.packageName,
    customScheme: "cricify://",
    cryptoPipeline: "AES-128-CBC (Primary / Dex-Secondary / Legacy) + EnvelopeCrypto",
    fallbackDomains: FALLBACK_DOMAINS,
  },

  async fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult> {
    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 3500));
    const rcDomain = extractDomainFromRc(rc, ["cric_api2", "cric_api1", "api_url", "base_url"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const events: RawProviderEvent[] = [];
    const channels: RawProviderChannel[] = [];
    let resolvedDomain = rcDomain;

    const livePayload = await fetchDecryptedFromCandidates({
      domains,
      paths: ["/categories/live-events.txt", "/live-events.txt"],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptCricifyPayload,
    });

    if (livePayload) {
      resolvedDomain = livePayload.domain;
      try {
        const parsed: unknown = JSON.parse(livePayload.text);
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown[] }).events)
            ? (parsed as { events: unknown[] }).events
            : [];

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (!item || typeof item !== "object") continue;
          const rec = item as Record<string, unknown>;
          const title = sanitizeField(rec["title"] ?? rec["name"] ?? rec["match_name"]);
          if (!title) continue;

          const slug = sanitizeField(rec["slug"] ?? rec["channel_slug"] ?? rec["id"]) ?? `ev-${i + 1}`;
          const streams: RawProviderStream[] = [];

          if (Array.isArray(rec["links"])) {
            for (let j = 0; j < rec["links"].length; j++) {
              const linkObj = rec["links"][j];
              if (linkObj && typeof linkObj === "object") {
                const s = buildStreamFromLinkRecord(linkObj as Record<string, unknown>, j);
                if (s) streams.push(s);
              }
            }
          }

          if (streams.length === 0) {
            const direct = buildStreamFromLinkRecord(rec, 0);
            if (direct) {
              streams.push(direct);
            } else {
              streams.push({
                label: "Cricify Live",
                url: `cricify://${slug}`,
                customScheme: `cricify://${slug}`,
              });
            }
          }

          const ev: RawProviderEvent = {
            provider: "cricify",
            providerEventId: `cricify_${slug}`,
            title,
            streams,
          };
          const tournament = sanitizeField(rec["tournament"] ?? rec["league"] ?? rec["series"]);
          const category = sanitizeField(rec["category"] ?? rec["sport"]);
          const teamA = sanitizeField(rec["team1"] ?? rec["teamA"] ?? rec["team_a"]);
          const teamB = sanitizeField(rec["team2"] ?? rec["teamB"] ?? rec["team_b"]);
          const teamALogo = sanitizeUrl(rec["team1_logo"] ?? rec["teamA_logo"]);
          const teamBLogo = sanitizeUrl(rec["team2_logo"] ?? rec["teamB_logo"]);
          const poster = sanitizeUrl(rec["poster"] ?? rec["image"] ?? rec["banner"]);
          const status = sanitizeField(rec["status"] ?? rec["match_status"]);
          const startIso = parseProviderDateTime(rec["start_time"] ?? rec["date"], rec["time"]);
          const endIso = parseProviderDateTime(rec["end_time"]);

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
          if (endIso) ev.endTimeIso = endIso;
          events.push(ev);
        }
      } catch {
        // Fallback if M3U
        if (livePayload.text.includes("#EXTINF")) {
          const parsedM3u = parseM3uPlaylist(livePayload.text);
          for (let i = 0; i < parsedM3u.length; i++) {
            const entry = parsedM3u[i]!;
            const stream: RawProviderStream = {
              label: entry.name,
              url: entry.url,
              headers: entry.headers,
            };
            if (entry.drm) stream.drm = entry.drm;
            const ch: RawProviderChannel = {
              provider: "cricify",
              providerChannelId: `cricify_ch_${i + 1}`,
              name: entry.name,
              category: entry.group,
              group: entry.group,
              streams: [stream],
            };
            if (entry.logoUrl) ch.logoUrl = entry.logoUrl;
            channels.push(ch);
          }
        }
      }
    }

    // Also pull lightweight M3U mirror if no channels came from API
    if (channels.length === 0) {
      const mirrorRes = await fetchDecryptedFromCandidates({
        domains: [""],
        paths: [M3U_MIRRORS[0], M3U_MIRRORS[1]],
        userAgent: USER_AGENT,
        timeoutMs: Math.min(timeoutMs, 3500),
        decrypt: decryptCricifyPayload,
        validate: (t) => t.includes("#EXTINF"),
      });
      if (mirrorRes) {
        const parsed = parseM3uPlaylist(mirrorRes.text);
        for (let i = 0; i < Math.min(parsed.length, 150); i++) {
          const entry = parsed[i]!;
          const stream: RawProviderStream = {
            label: entry.name,
            url: entry.url,
            headers: entry.headers,
          };
          if (entry.drm) stream.drm = entry.drm;
          const ch: RawProviderChannel = {
            provider: "cricify",
            providerChannelId: `cricify_m3u_${i + 1}`,
            name: entry.name,
            category: entry.group,
            group: entry.group,
            streams: [stream],
          };
          if (entry.logoUrl) ch.logoUrl = entry.logoUrl;
          channels.push(ch);
        }
      }
    }

    const res: ProviderFetchResult = {
      provider: "cricify",
      events,
      channels,
    };
    if (resolvedDomain) res.resolvedDomain = resolvedDomain;
    return res;
  },

  async resolveCustomScheme(
    schemePath: string,
    env: CreaseEnv | undefined,
    timeoutMs: number
  ): Promise<RawProviderStream[]> {
    const slug = schemePath.replace(/^cricify:\/\//i, "").replace(/^\/+/, "").trim();
    if (!slug) return [];

    const rc = await fetchFirebaseRemoteConfig(FIREBASE_SPEC, env, Math.min(timeoutMs, 2500));
    const rcDomain = extractDomainFromRc(rc, ["cric_api2", "cric_api1", "api_url", "base_url"]);
    const domains = rcDomain ? [rcDomain, ...FALLBACK_DOMAINS] : [...FALLBACK_DOMAINS];

    const res = await fetchDecryptedFromCandidates({
      domains,
      paths: [`/channels/${slug}.txt`, `/channels/${slug}.json`],
      userAgent: USER_AGENT,
      timeoutMs,
      decrypt: decryptCricifyPayload,
    });
    if (!res) return [];

    if (res.text.includes("#EXTINF")) {
      return parseM3uPlaylist(res.text).map((entry) => {
        const s: RawProviderStream = {
          label: entry.name,
          url: entry.url,
          headers: entry.headers,
        };
        if (entry.drm) s.drm = entry.drm;
        return s;
      });
    }

    try {
      const parsed: unknown = JSON.parse(res.text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const out: RawProviderStream[] = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item && typeof item === "object") {
          const s = buildStreamFromLinkRecord(item as Record<string, unknown>, i);
          if (s) out.push(s);
        }
      }
      return out;
    } catch {
      return [];
    }
  },
};
