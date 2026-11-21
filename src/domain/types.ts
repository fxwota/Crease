export type ProviderId = "cricify" | "sportzx" | "playfy" | "sktech" | "playztv" | "livxow";

export type MatchFormat =
  | "TEST"
  | "ODI"
  | "T20I"
  | "T10"
  | "HUNDRED"
  | "T20"
  | "LIST_A"
  | "FIRST_CLASS"
  | "OTHER";

export type SquadClass =
  | "MENS"
  | "WOMENS"
  | "U19_MENS"
  | "U19_WOMENS"
  | "A_TEAM"
  | "LEGENDS"
  | "FRANCHISE"
  | "DOMESTIC"
  | "CLUB";

export type MatchPhase =
  | "upcoming"
  | "pre_match"
  | "live"
  | "break"
  | "completed"
  | "abandoned"
  | "unknown";

export type CricketEventKind = "match" | "tournament_channel" | "highlight_or_show";

export type StreamProtocol = "hls" | "dash" | "mp4" | "ts" | "unknown";

export type EncryptionType =
  | "NONE"
  | "CLEARKEY"
  | "AES-128"
  | "SAMPLE-AES"
  | "CENC"
  | "UNKNOWN";

export type CommentaryFeedType =
  | "broadcast"
  | "regional"
  | "dugout"
  | "stump-cam"
  | "tactical"
  | "hero-cam"
  | "insider";

export interface ClearKeyConfig {
  kid: string;
  key: string;
  licenseUrl?: string;
  keysMap?: Record<string, string>;
}

export interface StreamRendition {
  width?: number;
  height?: number;
  bandwidth?: number;
  frameRate?: number;
  codecs?: string;
  label: string;
}

export interface AudioTrackInfo {
  name: string;
  language?: string;
  groupId?: string;
  isDefault?: boolean;
}

export interface PlaybackCompatibility {
  browserHlsJs: boolean;
  browserShakaDash: boolean;
  safariNativeHls: boolean;
  iptvKodiExo: boolean;
  requiresProxy: boolean;
  recommendedPlayer: "hls.js" | "shaka" | "native-hls" | "exo-kodi";
  notes: string[];
}

export interface ManifestInspection {
  reachable: boolean;
  httpStatus?: number;
  latencyMs: number;
  contentType?: string;
  protocol: StreamProtocol;
  isMasterPlaylist: boolean;
  isLowLatency: boolean;
  targetDurationSec?: number;
  segmentCount?: number;
  encryption: EncryptionType;
  clearKeyKids: string[];
  renditions: StreamRendition[];
  audioTracks: AudioTrackInfo[];
  compatibility: PlaybackCompatibility;
  bytesInspected: number;
  error?: string;
}

export interface CricketSquadRef {
  id: string;
  code: string;
  name: string;
  shortName: string;
  squadClass: SquadClass;
  countryCode?: string;
  leagueId?: string;
  logoUrl?: string;
  aliases: string[];
}

export interface CricketSeriesRef {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  defaultFormat: MatchFormat;
  squadClass: SquadClass;
  category: "icc" | "acc" | "bilateral" | "franchise" | "domestic" | "legends";
  country?: string;
}

export interface CricketStream {
  id: string;
  provider: ProviderId;
  label: string;
  url: string;
  proxyUrl?: string;
  customScheme?: string;
  protocol: StreamProtocol;
  quality: string;
  resolutionHeight?: number;
  language: string;
  feedType: CommentaryFeedType;
  broadcaster?: string;
  encryption: EncryptionType;
  drm?: ClearKeyConfig;
  publicHeaders: Record<string, string>;
  hasRedactedAuth: boolean;
  compatibility: PlaybackCompatibility;
  rankScore: number;
  probed?: ManifestInspection;
}

export interface CricketMatch {
  matchId: string;
  canonicalKey: string;
  title: string;
  kind: CricketEventKind;
  format: MatchFormat;
  squadClass: SquadClass;
  phase: MatchPhase;
  stage?: string;
  matchNumber?: string;
  venue?: string;
  series: CricketSeriesRef;
  homeTeam?: CricketSquadRef;
  awayTeam?: CricketSquadRef;
  startTimeIso?: string;
  endTimeIso?: string;
  dateBucketUtc: string;
  posterUrl?: string;
  broadcasters: string[];
  languages: string[];
  hasDrm: boolean;
  featured: boolean;
  featuredScore: number;
  providers: ProviderId[];
  providerCount: number;
  providerEventIds: Record<string, string>;
  streams: CricketStream[];
  streamCount: number;
  updatedAt: string;
}

export interface CricketChannel {
  channelId: string;
  name: string;
  normalizedName: string;
  category: string;
  broadcaster?: string;
  country?: string;
  language: string;
  isHd: boolean;
  logoUrl?: string;
  providers: ProviderId[];
  streams: CricketStream[];
  streamCount: number;
}

export interface CricketBroadcaster {
  id: string;
  name: string;
  matchCount: number;
  liveMatchCount: number;
  channelCount: number;
  languages: string[];
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ProviderHealthSnapshot {
  provider: ProviderId;
  displayName: string;
  cryptoPipeline: string;
  customScheme: string;
  circuitState: CircuitState;
  ok: boolean;
  latencyMs: number;
  rawEventsFetched: number;
  cricketEventsKept: number;
  nonCricketDropped: number;
  channelsKept: number;
  resolvedDomain?: string;
  lastSuccessAt?: string;
  lastError?: string;
}

export interface CatalogDiagnostics {
  totalRawEvents: number;
  cricketEventsKept: number;
  nonCricketDropped: number;
  cricketPrecisionRatio: number;
  deduplicatedMatches: number;
  deduplicationRatio: number;
  totalStreams: number;
  totalChannels: number;
  ingestionDurationMs: number;
  snapshotAgeSec: number;
  storageMode: "kv" | "memory-fallback";
  degraded: boolean;
}

export interface CricketCatalogSnapshot {
  version: string;
  generatedAt: string;
  etag: string;
  matches: CricketMatch[];
  channels: CricketChannel[];
  providers: ProviderHealthSnapshot[];
  diagnostics: CatalogDiagnostics;
}
