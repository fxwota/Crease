import { describe, expect, it } from "vitest";
import { RAW_CHANGELOG_MD } from "../../src/config/changelog-raw";
import { APP_VERSION, type CreaseEnv } from "../../src/config/env";
import { filterParsedChangelog, parseChangelogMarkdown } from "../../src/domain/changelog-parser";
import { createCreaseApp } from "../../src/http/app";

const app = createCreaseApp();
const testEnv: CreaseEnv = {
  ENVIRONMENT: "test",
  ENABLE_UPSTREAM_FETCH: "false",
  SNAPSHOT_TTL_SECONDS: "180",
  STALE_WHILE_REVALIDATE_SECONDS: "600",
  PROVIDER_TIMEOUT_MS: "2000",
};

const mockCtx = {
  waitUntil: (_p: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
  props: {},
} as unknown as ExecutionContext;

function invoke(url: string, init?: RequestInit): Promise<Response> {
  return Promise.resolve(app.fetch(new Request(url, init), testEnv, mockCtx));
}

describe("Changelog Parser, Release Governance & HTTP Endpoints", () => {
  it("parses the live CHANGELOG.md into structured Conventional Commit entries", () => {
    const parsed = parseChangelogMarkdown(RAW_CHANGELOG_MD);
    expect(parsed.currentVersion).toBe(APP_VERSION);
    expect(parsed.totalReleases).toBeGreaterThanOrEqual(1);
    expect(parsed.totalChanges).toBeGreaterThanOrEqual(15);
    expect(parsed.typeCounts["feat"]).toBeGreaterThanOrEqual(6);
    expect(parsed.typeCounts["security"]).toBeGreaterThanOrEqual(2);
    expect(parsed.typeCounts["perf"]).toBeGreaterThanOrEqual(2);
    expect(parsed.typeCounts["test"]).toBeGreaterThanOrEqual(3);

    const v0 = parsed.releases[0];
    expect(v0?.version).toBe("0.0.0");
    expect(v0?.date).toBe("2026-04-12");
    expect(v0?.codename).toContain("Genesis");
    expect(v0?.categories.some((c) => c.name === "Features")).toBe(true);
    expect(v0?.categories.some((c) => c.name === "Security")).toBe(true);
  });

  it("supports Conventional Commits breaking flags, custom scopes, and unreleased sections", () => {
    const sample = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "### Bug Fixes",
      "- `fix(playfy):` **Envelope Fallback** — Handles trailing whitespace on base64 tokens.",
      "",
      "## [0.2.0] - 2026-05-01 — Edge Stream Hardening",
      "Release summary line.",
      "### Breaking Changes",
      "- `feat(api)!:` **Require v1 Prefix** — Removed legacy root aliases.",
      "",
    ].join("\n");

    const parsed = parseChangelogMarkdown(sample);
    expect(parsed.unreleased?.totalChanges).toBe(1);
    expect(parsed.releases[0]?.version).toBe("0.2.0");
    expect(parsed.releases[0]?.breakingCount).toBe(1);

    const onlyBreaking = filterParsedChangelog(parsed, { type: "breaking" });
    expect(onlyBreaking.totalChanges).toBe(1);
    expect(onlyBreaking.releases[0]?.categories[0]?.entries[0]?.scope).toBe("api");
  });

  it("serves /api/v1/changelog with ETag/304, filtering, /changelog UI, and raw /changelog.md", async () => {
    const res = await invoke("http://crease.local/api/v1/changelog");
    expect(res.status).toBe(200);
    const etag = res.headers.get("etag");
    expect(etag).toBeTruthy();
    const body = (await res.json()) as {
      ok: boolean;
      data: { currentVersion: string; source: string; totalChanges: number };
    };
    expect(body.ok).toBe(true);
    expect(body.data.currentVersion).toBe(APP_VERSION);
    expect(body.data.source).toBe("CHANGELOG.md");
    expect(body.data.totalChanges).toBeGreaterThanOrEqual(15);

    // ETag 304 conditional check
    const notMod = await invoke("http://crease.local/api/v1/changelog", {
      headers: { "If-None-Match": etag! },
    });
    expect(notMod.status).toBe(304);

    // Filtered query
    const filteredRes = await invoke("http://crease.local/api/v1/changelog?type=security&q=ssrf");
    expect(filteredRes.status).toBe(200);
    const filteredBody = (await filteredRes.json()) as { ok: boolean; data: { totalChanges: number } };
    expect(filteredBody.ok).toBe(true);
    expect(filteredBody.data.totalChanges).toBeGreaterThanOrEqual(1);

    // Raw CHANGELOG.md endpoint
    const mdRes = await invoke("http://crease.local/changelog.md");
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers.get("content-type")).toContain("text/markdown");
    expect(await mdRes.text()).toContain("## [0.0.0]");

    // HTML /changelog page
    const uiRes = await invoke("http://crease.local/changelog");
    expect(uiRes.status).toBe(200);
    const html = await uiRes.text();
    expect(html).toContain("Crease Changelog");
    expect(html).toContain("/api/v1/changelog");
  });
});
