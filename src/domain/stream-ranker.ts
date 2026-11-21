import type {
  ClearKeyConfig,
  CommentaryFeedType,
  CricketStream,
  EncryptionType,
  PlaybackCompatibility,
  ProviderId,
  StreamProtocol,
} from "./types";

const LANGUAGE_PATTERNS: ReadonlyArray<{ code: string; rx: RegExp }> = [
  { code: "hi", rx: /\b(hindi|हिन्दी|hin)\b/i },
  { code: "ta", rx: /\b(tamil|தமிழ்|tam)\b/i },
  { code: "te", rx: /\b(telugu|తెలుగు|tel)\b/i },
  { code: "kn", rx: /\b(kannada|ಕನ್ನಡ|kan)\b/i },
  { code: "bn", rx: /\b(bengali|bangla|বাংলা|ben)\b/i },
  { code: "mr", rx: /\b(marathi|मराठी|mar)\b/i },
  { code: "bho", rx: /\b(bhojpuri|bho)\b/i },
  { code: "gu", rx: /\b(gujarati|guj)\b/i },
  { code: "ml", rx: /\b(malayalam|mal)\b/i },
  { code: "pa", rx: /\b(punjabi|pan)\b/i },
  { code: "ur", rx: /\b(urdu|urd)\b/i },
  { code: "en", rx: /\b(english|eng|world feed|international feed)\b/i },
];

export function detectStreamLanguage(label: string): string {
  for (const item of LANGUAGE_PATTERNS) {
    if (item.rx.test(label)) return item.code;
  }
  return "en";
}

export function detectCommentaryFeedType(label: string, language: string): CommentaryFeedType {
  const lower = label.toLowerCase();
  if (/\bdugout\b/.test(lower)) return "dugout";
  if (/\bstump[- ]?cam\b/.test(lower)) return "stump-cam";
  if (/\b(tactical|bird'?s? eye|cable cam|drone)\b/.test(lower)) return "tactical";
  if (/\bhero[- ]?cam\b|\bplayer[- ]?cam\b/.test(lower)) return "hero-cam";
  if (/\binsider\b|\bhangout\b/.test(lower)) return "insider";
  if (language !== "en") return "regional";
  return "broadcast";
}

export function detectStreamProtocol(url: string, explicitType?: string): StreamProtocol {
  const lower = `${url} ${explicitType ?? ""}`.toLowerCase();
  if (lower.includes(".mpd") || lower.includes("dash") || lower.includes("application/dash+xml")) {
    return "dash";
  }
  if (
    lower.includes(".m3u8") ||
    lower.includes(".m3u") ||
    lower.includes("hls") ||
    lower.includes("mpegurl")
  ) {
    return "hls";
  }
  if (lower.includes(".mp4")) return "mp4";
  if (lower.includes(".ts")) return "ts";
  return "unknown";
}

export function detectQualityTier(label: string, url?: string): { quality: string; height?: number } {
  const combined = `${label} ${url ?? ""}`.toLowerCase();
  if (/\b(4k|uhd|2160p?)\b/.test(combined)) return { quality: "2160p", height: 2160 };
  if (/\b(1080p?|fhd|full\s*hd)\b/.test(combined)) return { quality: "1080p", height: 1080 };
  if (/\b(720p?|hd)\b/.test(combined)) return { quality: "720p", height: 720 };
  if (/\b(480p?|sd)\b/.test(combined)) return { quality: "480p", height: 480 };
  if (/\b(360p?|low)\b/.test(combined)) return { quality: "360p", height: 360 };
  return { quality: "AUTO" };
}

export function buildPlaybackCompatibility(params: {
  protocol: StreamProtocol;
  encryption: EncryptionType;
  hasCustomHeaders: boolean;
  isCustomScheme: boolean;
  drm?: ClearKeyConfig;
}): PlaybackCompatibility {
  const { protocol, encryption, hasCustomHeaders, isCustomScheme, drm } = params;
  const requiresProxy = hasCustomHeaders || isCustomScheme;
  const notes: string[] = [];

  const isDash = protocol === "dash";
  const isHls = protocol === "hls" || protocol === "unknown";
  const isClearKey = encryption === "CLEARKEY" || Boolean(drm);
  const isCencWithoutClearKey = encryption === "CENC" && !isClearKey;

  const browserHlsJs = isHls && (encryption === "NONE" || encryption === "AES-128" || encryption === "UNKNOWN");
  const browserShakaDash = isDash && (encryption === "NONE" || isClearKey || encryption === "UNKNOWN");
  const safariNativeHls = isHls && (encryption === "NONE" || encryption === "AES-128");
  const iptvKodiExo = !isCencWithoutClearKey;

  if (requiresProxy) notes.push("Requires Edge Proxy for CORS/Referer or custom scheme resolution");
  if (isClearKey) notes.push("ClearKey EME keys supplied — compatible with Shaka Player & Kodi/ExoPlayer");
  if (isCencWithoutClearKey) notes.push("CENC/Widevine encrypted without ClearKey — restricted to DRM-capable players");

  let recommendedPlayer: PlaybackCompatibility["recommendedPlayer"] = "hls.js";
  if (isDash && browserShakaDash) {
    recommendedPlayer = "shaka";
  } else if (browserHlsJs) {
    recommendedPlayer = "hls.js";
  } else if (safariNativeHls) {
    recommendedPlayer = "native-hls";
  } else {
    recommendedPlayer = "exo-kodi";
  }

  return {
    browserHlsJs,
    browserShakaDash,
    safariNativeHls,
    iptvKodiExo,
    requiresProxy,
    recommendedPlayer,
    notes,
  };
}

const PROVIDER_BASE_RELIABILITY: Record<ProviderId, number> = {
  cricify: 18,
  sportzx: 17,
  playfy: 16,
  sktech: 14,
  playztv: 13,
  livxow: 12,
};

export function scoreCricketStream(stream: {
  provider: ProviderId;
  protocol: StreamProtocol;
  resolutionHeight?: number;
  encryption: EncryptionType;
  language: string;
  feedType: CommentaryFeedType;
  probedReachable?: boolean;
}): number {
  let score = 0;

  // Protocol & encryption browser-readiness (max 35)
  if (stream.protocol === "hls" && (stream.encryption === "NONE" || stream.encryption === "AES-128")) {
    score += 35;
  } else if (stream.protocol === "dash" && (stream.encryption === "NONE" || stream.encryption === "CLEARKEY")) {
    score += 28;
  } else if (stream.protocol === "hls" || stream.protocol === "dash") {
    score += 18;
  } else {
    score += 10;
  }

  // Quality tier (max 25)
  if ((stream.resolutionHeight ?? 0) >= 2160) score += 25;
  else if ((stream.resolutionHeight ?? 0) >= 1080) score += 22;
  else if ((stream.resolutionHeight ?? 0) >= 720) score += 16;
  else if ((stream.resolutionHeight ?? 0) >= 480) score += 10;
  else if ((stream.resolutionHeight ?? 0) >= 360) score += 6;
  else score += 12; // AUTO adaptive ABR

  // Commentary / Feed tier (max 10)
  if (stream.feedType === "broadcast" && (stream.language === "en" || stream.language === "hi")) {
    score += 10;
  } else if (stream.feedType === "regional") {
    score += 8;
  } else {
    score += 6;
  }

  // Provider reliability (max 18)
  score += PROVIDER_BASE_RELIABILITY[stream.provider] ?? 10;

  // Live probe bonus (max 12)
  if (stream.probedReachable === true) score += 12;
  else if (stream.probedReachable === false) score -= 25;

  return Math.max(0, Math.min(100, score));
}

export function rankStreams(streams: CricketStream[]): CricketStream[] {
  return [...streams].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if ((b.resolutionHeight ?? 0) !== (a.resolutionHeight ?? 0)) {
      return (b.resolutionHeight ?? 0) - (a.resolutionHeight ?? 0);
    }
    return a.id.localeCompare(b.id);
  });
}
