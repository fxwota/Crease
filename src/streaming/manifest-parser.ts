import { buildPlaybackCompatibility } from "../domain/stream-ranker";
import type {
  AudioTrackInfo,
  EncryptionType,
  ManifestInspection,
  StreamProtocol,
  StreamRendition,
} from "../domain/types";

export const MAX_MANIFEST_INSPECT_BYTES = 24 * 1024;

function parseHlsAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const idx = line.indexOf(":");
  if (idx < 0) return attrs;
  const body = line.slice(idx + 1);
  const rx = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body)) !== null) {
    const key = m[1];
    const val = m[3] ?? m[2] ?? "";
    if (key) attrs[key] = val.trim();
  }
  return attrs;
}

function normalizeKidHex(raw: string): string | null {
  const hex = raw.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  return hex.length === 32 ? hex : null;
}

export function inspectManifestText(params: {
  text: string;
  url: string;
  httpStatus: number;
  latencyMs: number;
  contentType?: string;
  hasCustomHeaders?: boolean;
}): ManifestInspection {
  const raw = params.text.slice(0, MAX_MANIFEST_INSPECT_BYTES);
  const trimmed = raw.trim();
  const bytesInspected = new TextEncoder().encode(raw).byteLength;

  const isDash =
    trimmed.includes("<MPD") ||
    params.url.toLowerCase().includes(".mpd") ||
    (params.contentType ?? "").toLowerCase().includes("dash+xml");

  const isHls =
    !isDash &&
    (trimmed.startsWith("#EXTM3U") ||
      trimmed.includes("#EXT-X-") ||
      params.url.toLowerCase().includes(".m3u8"));

  const protocol: StreamProtocol = isDash ? "dash" : isHls ? "hls" : "unknown";

  if (isDash) {
    return parseDashManifest(trimmed, params, bytesInspected);
  }
  if (isHls) {
    return parseHlsManifest(trimmed, params, bytesInspected);
  }

  const compatibility = buildPlaybackCompatibility({
    protocol,
    encryption: "UNKNOWN",
    hasCustomHeaders: Boolean(params.hasCustomHeaders),
    isCustomScheme: false,
  });

  const out: ManifestInspection = {
    reachable: params.httpStatus >= 200 && params.httpStatus < 400,
    httpStatus: params.httpStatus,
    latencyMs: params.latencyMs,
    protocol,
    isMasterPlaylist: false,
    isLowLatency: false,
    encryption: "UNKNOWN",
    clearKeyKids: [],
    renditions: [],
    audioTracks: [],
    compatibility,
    bytesInspected,
  };
  if (params.contentType) out.contentType = params.contentType;
  return out;
}

function parseHlsManifest(
  text: string,
  params: { httpStatus: number; latencyMs: number; contentType?: string; hasCustomHeaders?: boolean },
  bytesInspected: number
): ManifestInspection {
  const lines = text.split(/\r?\n/);
  const renditions: StreamRendition[] = [];
  const audioTracks: AudioTrackInfo[] = [];
  const clearKeyKids = new Set<string>();

  let isMasterPlaylist = false;
  let isLowLatency = false;
  let targetDurationSec: number | undefined;
  let segmentCount = 0;
  let encryption: EncryptionType = "NONE";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      isMasterPlaylist = true;
      const attrs = parseHlsAttributes(line);
      const bw = attrs["BANDWIDTH"] ? Number.parseInt(attrs["BANDWIDTH"], 10) : undefined;
      const resMatch = attrs["RESOLUTION"]?.match(/^(\d+)x(\d+)$/i);
      const width = resMatch?.[1] ? Number.parseInt(resMatch[1], 10) : undefined;
      const height = resMatch?.[2] ? Number.parseInt(resMatch[2], 10) : undefined;
      const fps = attrs["FRAME-RATE"] ? Number.parseFloat(attrs["FRAME-RATE"]) : undefined;
      const label = height ? `${height}p` : bw ? `${Math.round(bw / 1000)}kbps` : "AUTO";

      const rendition: StreamRendition = { label };
      if (width !== undefined) rendition.width = width;
      if (height !== undefined) rendition.height = height;
      if (bw !== undefined && Number.isFinite(bw)) rendition.bandwidth = bw;
      if (fps !== undefined && Number.isFinite(fps)) rendition.frameRate = fps;
      if (attrs["CODECS"]) rendition.codecs = attrs["CODECS"];
      renditions.push(rendition);
    } else if (line.startsWith("#EXT-X-MEDIA:")) {
      const attrs = parseHlsAttributes(line);
      if ((attrs["TYPE"] ?? "").toUpperCase() === "AUDIO") {
        const track: AudioTrackInfo = {
          name: attrs["NAME"] ?? attrs["LANGUAGE"] ?? "Audio",
          isDefault: (attrs["DEFAULT"] ?? "").toUpperCase() === "YES",
        };
        if (attrs["LANGUAGE"]) track.language = attrs["LANGUAGE"];
        if (attrs["GROUP-ID"]) track.groupId = attrs["GROUP-ID"];
        audioTracks.push(track);
      }
    } else if (line.startsWith("#EXT-X-KEY:") || line.startsWith("#EXT-X-SESSION-KEY:")) {
      const attrs = parseHlsAttributes(line);
      const method = (attrs["METHOD"] ?? "").toUpperCase();
      if (method === "AES-128") {
        if (encryption === "NONE") encryption = "AES-128";
      } else if (method === "SAMPLE-AES" || method === "SAMPLE-AES-CTR") {
        encryption = "SAMPLE-AES";
      }
      const keyFormat = (attrs["KEYFORMAT"] ?? "").toLowerCase();
      if (keyFormat.includes("clearkey") || keyFormat.includes("e2719d58-a985-b3c9-781a-b030af78d30e")) {
        encryption = "CLEARKEY";
      } else if (keyFormat.includes("widevine") || keyFormat.includes("edef8ba9")) {
        encryption = "CENC";
      }
      if (attrs["KEYID"]) {
        const kid = normalizeKidHex(attrs["KEYID"].replace(/^0x/i, ""));
        if (kid) clearKeyKids.add(kid);
      }
    } else if (line.startsWith("#EXT-X-TARGETDURATION:")) {
      const val = Number.parseFloat(line.slice("#EXT-X-TARGETDURATION:".length));
      if (Number.isFinite(val)) targetDurationSec = val;
    } else if (line.startsWith("#EXTINF:")) {
      segmentCount++;
    } else if (
      line.startsWith("#EXT-X-PART:") ||
      line.startsWith("#EXT-X-PART-INF:") ||
      line.startsWith("#EXT-X-PRELOAD-HINT:") ||
      line.startsWith("#EXT-X-SERVER-CONTROL:")
    ) {
      isLowLatency = true;
    }
  }

  renditions.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bandwidth ?? 0) - (a.bandwidth ?? 0));

  const compatibility = buildPlaybackCompatibility({
    protocol: "hls",
    encryption,
    hasCustomHeaders: Boolean(params.hasCustomHeaders),
    isCustomScheme: false,
  });

  const out: ManifestInspection = {
    reachable: true,
    httpStatus: params.httpStatus,
    latencyMs: params.latencyMs,
    protocol: "hls",
    isMasterPlaylist,
    isLowLatency,
    encryption,
    clearKeyKids: [...clearKeyKids],
    renditions,
    audioTracks,
    compatibility,
    bytesInspected,
  };
  if (params.contentType) out.contentType = params.contentType;
  if (targetDurationSec !== undefined) out.targetDurationSec = targetDurationSec;
  if (segmentCount > 0) out.segmentCount = segmentCount;
  return out;
}

function parseDashManifest(
  text: string,
  params: { httpStatus: number; latencyMs: number; contentType?: string; hasCustomHeaders?: boolean },
  bytesInspected: number
): ManifestInspection {
  const renditions: StreamRendition[] = [];
  const audioTracks: AudioTrackInfo[] = [];
  const clearKeyKids = new Set<string>();

  // Extract <Representation ...> video tracks
  const repRx = /<Representation\b([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = repRx.exec(text)) !== null) {
    const attrs = m[1] ?? "";
    const widthMatch = attrs.match(/\bwidth="(\d+)"/i);
    const heightMatch = attrs.match(/\bheight="(\d+)"/i);
    const bwMatch = attrs.match(/\bbandwidth="(\d+)"/i);
    const codecsMatch = attrs.match(/\bcodecs="([^"]+)"/i);
    const fpsMatch = attrs.match(/\bframeRate="([0-9./]+)"/i);

    const width = widthMatch?.[1] ? Number.parseInt(widthMatch[1], 10) : undefined;
    const height = heightMatch?.[1] ? Number.parseInt(heightMatch[1], 10) : undefined;
    const bandwidth = bwMatch?.[1] ? Number.parseInt(bwMatch[1], 10) : undefined;

    if (height !== undefined || width !== undefined) {
      const rendition: StreamRendition = {
        label: height ? `${height}p` : `${Math.round((bandwidth ?? 0) / 1000)}kbps`,
      };
      if (width !== undefined) rendition.width = width;
      if (height !== undefined) rendition.height = height;
      if (bandwidth !== undefined) rendition.bandwidth = bandwidth;
      if (codecsMatch?.[1]) rendition.codecs = codecsMatch[1];
      if (fpsMatch?.[1]) {
        const parts = fpsMatch[1].split("/");
        const fpsVal =
          parts.length === 2
            ? Number.parseFloat(parts[0]!) / Number.parseFloat(parts[1]!)
            : Number.parseFloat(fpsMatch[1]);
        if (Number.isFinite(fpsVal)) rendition.frameRate = Number(fpsVal.toFixed(2));
      }
      renditions.push(rendition);
    }
  }

  // Extract audio AdaptationSets
  const adaptRx = /<AdaptationSet\b([^>]+)>/gi;
  while ((m = adaptRx.exec(text)) !== null) {
    const attrs = m[1] ?? "";
    if (/contentType="audio"|mimeType="audio\//i.test(attrs)) {
      const lang = attrs.match(/\blang="([^"]+)"/i)?.[1];
      const label = attrs.match(/\blabel="([^"]+)"/i)?.[1] ?? lang ?? "Audio";
      const track: AudioTrackInfo = { name: label };
      if (lang) track.language = lang;
      audioTracks.push(track);
    }
  }

  // Detect encryption & ClearKey KIDs
  let encryption: EncryptionType = "NONE";
  const hasContentProtection = /<ContentProtection\b/i.test(text);
  const hasClearKeyUuid =
    /e2719d58-a985-b3c9-781a-b030af78d30e|1077efec-c0b2-4d02-ace3-3c1e52e2fb4b|clearkey/i.test(text);
  const hasWidevineOrPlayReady =
    /edef8ba9-79d6-4ace-a3c8-27dcd51d21ed|9a04f079-9840-4286-ab92-e65be0885f95/i.test(text);

  const kidRx = /(?:cenc:)?default_KID="([^"]+)"/gi;
  while ((m = kidRx.exec(text)) !== null) {
    const kid = normalizeKidHex(m[1] ?? "");
    if (kid) clearKeyKids.add(kid);
  }

  if (hasClearKeyUuid) {
    encryption = "CLEARKEY";
  } else if (hasWidevineOrPlayReady || hasContentProtection) {
    encryption = clearKeyKids.size > 0 ? "CENC" : "CENC";
  }

  const isLowLatency =
    /availabilityTimeOffset=|availabilityTimeComplete="false"|urn:dvb:dash:profile:dvb-dash:2014|ServiceDescription/i.test(
      text
    );

  renditions.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bandwidth ?? 0) - (a.bandwidth ?? 0));

  const compatibility = buildPlaybackCompatibility({
    protocol: "dash",
    encryption,
    hasCustomHeaders: Boolean(params.hasCustomHeaders),
    isCustomScheme: false,
  });

  const out: ManifestInspection = {
    reachable: true,
    httpStatus: params.httpStatus,
    latencyMs: params.latencyMs,
    protocol: "dash",
    isMasterPlaylist: renditions.length > 0,
    isLowLatency,
    encryption,
    clearKeyKids: [...clearKeyKids],
    renditions,
    audioTracks,
    compatibility,
    bytesInspected,
  };
  if (params.contentType) out.contentType = params.contentType;
  return out;
}
