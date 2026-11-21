import { describe, expect, it } from "vitest";
import {
  inheritSignedCdnQueryParams,
  redactSensitiveHeadersForPublicJson,
} from "../../src/streaming/headers";
import { inspectManifestText } from "../../src/streaming/manifest-parser";
import { filterDashMpdByQuality, rewriteHlsPlaylistForProxy } from "../../src/streaming/proxy";
import {
  isSafeUpstreamUrl,
  safeFetchWithRedirects,
  SsrfBlockedError,
  validateUpstreamUrl,
} from "../../src/streaming/ssrf";

describe("Security Hardening — SSRF, Redirect Hops, Redaction & 24KB Manifest Inspection", () => {
  it("blocks every private, loopback, metadata, alternate-encoded, IPv6-mapped, and non-HTTP URL", () => {
    const blockedUrls = [
      "http://localhost/secret",
      "http://127.0.0.1/admin",
      "http://127.0.0.1:12345/no-ephemeral-port-bypass",
      "http://10.0.0.1/internal",
      "http://172.16.0.1/internal",
      "http://192.168.1.1/router",
      "http://100.64.0.1/cgnat",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://2130706433/decimal-loopback",
      "http://0x7f000001/hex-loopback",
      "http://0177.0.0.1/octal-loopback",
      "http://127.1/shorthand-loopback",
      "http://[::1]/ipv6-loopback",
      "http://[fc00::1]/ula",
      "http://[fe80::1]/link-local",
      "http://[::ffff:127.0.0.1]/ipv4-mapped-loopback",
      "http://[::ffff:7f00:1]/ipv4-mapped-hex",
      "http://[::ffff:169.254.169.254]/ipv4-mapped-metadata",
      "file:///etc/passwd",
      "gopher://127.0.0.1:6379/_INFO",
      "https://user:pass@cdn.example.com/live.m3u8",
      "http://intranet/single-label",
    ];

    for (const url of blockedUrls) {
      expect(isSafeUpstreamUrl(url), `Expected SSRF block for ${url}`).toBe(false);
    }

    expect(validateUpstreamUrl("https://cdn.example.com/live/cricket.m3u8").safe).toBe(true);
    expect(validateUpstreamUrl("https://8.8.8.8/live.m3u8").safe).toBe(true);
  });

  it("blocks 3xx redirects that bounce from a public host to an internal/metadata target", async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "https://public-cdn.example.com/start.m3u8") {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      return new Response("SHOULD_NEVER_BE_REACHED", { status: 200 });
    };

    await expect(
      safeFetchWithRedirects("https://public-cdn.example.com/start.m3u8", { fetchImpl: fakeFetch })
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("redacts Authorization, Cookie, Set-Cookie, and X-Api-Key from public JSON headers", () => {
    const result = redactSensitiveHeadersForPublicJson({
      Authorization: "Bearer super-secret-jwt",
      Cookie: "sid=xyz123",
      "Set-Cookie": "sid=xyz123; HttpOnly",
      "X-Api-Key": "topsecret",
      Referer: "https://player.example.com/",
      "User-Agent": "CreasePlayer/1.0",
    });

    expect(result.hasRedactedAuth).toBe(true);
    expect(result.publicHeaders["Authorization"]).toBeUndefined();
    expect(result.publicHeaders["Cookie"]).toBeUndefined();
    expect(result.publicHeaders["Set-Cookie"]).toBeUndefined();
    expect(result.publicHeaders["X-Api-Key"]).toBeUndefined();
    expect(result.publicHeaders["Referer"]).toBe("https://player.example.com/");
    expect(result.publicHeaders["User-Agent"]).toBe("CreasePlayer/1.0");
  });

  it("inherits signed CDN query tokens onto child HLS playlists and filters variants by quality", () => {
    const inherited = inheritSignedCdnQueryParams(
      "https://cdn.example.com/live/master.m3u8?hdnts=exp=1776099999~hmac=abc123&token=tok99",
      "720p/index.m3u8"
    );
    expect(inherited).toContain("https://cdn.example.com/live/720p/index.m3u8");
    expect(inherited).toContain("hdnts=");
    expect(inherited).toContain("token=tok99");

    const master = [
      "#EXTM3U",
      '#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080',
      "1080p.m3u8",
      '#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1280x720',
      "720p.m3u8",
      '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360',
      "360p.m3u8",
    ].join("\n");

    const filtered = rewriteHlsPlaylistForProxy({
      playlistText: master,
      baseUrl: "https://cdn.example.com/live/master.m3u8?hdnts=sig1",
      proxyOrigin: "https://crease.example.workers.dev",
      quality: "720p",
    });
    expect(filtered).toContain("RESOLUTION=1280x720");
    expect(filtered).not.toContain("RESOLUTION=1920x1080");
    expect(filtered).toContain("https://crease.example.workers.dev/api/v1/proxy?url=");
    expect(filtered).toContain("hdnts%3Dsig1");
  });

  it("inspects HLS master/LL-HLS and DASH ClearKey MPD manifests within 24KB cap", () => {
    const hls = [
      "#EXTM3U",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Hindi",LANGUAGE="hi",DEFAULT=YES',
      "#EXT-X-KEY:METHOD=AES-128,URI=\"https://cdn.example.com/k.key\"",
      "#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES",
      "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,FRAME-RATE=50.000",
      "high.m3u8",
      "#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,FRAME-RATE=25.000",
      "med.m3u8",
    ].join("\n");

    const hlsInfo = inspectManifestText({
      text: hls,
      url: "https://cdn.example.com/master.m3u8",
      httpStatus: 200,
      latencyMs: 42,
    });
    expect(hlsInfo.protocol).toBe("hls");
    expect(hlsInfo.isMasterPlaylist).toBe(true);
    expect(hlsInfo.isLowLatency).toBe(true);
    expect(hlsInfo.encryption).toBe("AES-128");
    expect(hlsInfo.renditions).toHaveLength(2);
    expect(hlsInfo.renditions[0]?.height).toBe(1080);
    expect(hlsInfo.audioTracks[0]?.language).toBe("hi");

    const mpd = `<?xml version="1.0"?>
      <MPD type="dynamic">
        <Period>
          <AdaptationSet contentType="video">
            <ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" cenc:default_KID="00112233-4455-6677-8899-aabbccddeeff"/>
            <Representation id="1" width="1920" height="1080" bandwidth="5000000" codecs="avc1.640028"/>
            <Representation id="2" width="1280" height="720" bandwidth="2500000" codecs="avc1.4d401f"/>
          </AdaptationSet>
          <AdaptationSet contentType="audio" lang="en" label="English World Feed"/>
        </Period>
      </MPD>`;

    const dashInfo = inspectManifestText({
      text: mpd,
      url: "https://cdn.example.com/live.mpd",
      httpStatus: 200,
      latencyMs: 38,
    });
    expect(dashInfo.protocol).toBe("dash");
    expect(dashInfo.encryption).toBe("CLEARKEY");
    expect(dashInfo.clearKeyKids).toEqual(["00112233445566778899aabbccddeeff"]);
    expect(dashInfo.compatibility.browserShakaDash).toBe(true);

    const filteredMpd = filterDashMpdByQuality(mpd, "720p");
    expect(filteredMpd).toContain('height="720"');
    expect(filteredMpd).not.toContain('height="1080"');
  });
});
