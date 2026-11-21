import type { CreaseEnv } from "../config/env";
import type { CricketCatalogSnapshot } from "../domain/types";
import { L1Cache } from "./l1-cache";

const KV_SNAPSHOT_KEY = "crease:snapshot:v1";
const CACHE_API_URL = "https://crease-internal.edge/cache/snapshot-v1.json";

export type CacheSource = "L1" | "CACHE_API" | "KV" | "MEMORY" | "FRESH";

export interface SnapshotReadResult {
  snapshot: CricketCatalogSnapshot | null;
  source: CacheSource;
  stale: boolean;
  ageMs: number;
}

const isolateL1 = new L1Cache<CricketCatalogSnapshot>(8);
let memoryFallbackSnapshot: { snapshot: CricketCatalogSnapshot; savedAt: number } | null = null;

function getDefaultEdgeCache(): Cache | null {
  try {
    const maybeCaches = globalThis.caches as (CacheStorage & { default?: Cache }) | undefined;
    return maybeCaches?.default ?? null;
  } catch {
    return null;
  }
}

export async function readCatalogSnapshot(
  env: CreaseEnv | undefined,
  ttlMs: number
): Promise<SnapshotReadResult> {
  const now = Date.now();

  // Tier 1: Isolate L1 cache (0 subrequests)
  const l1 = isolateL1.getEntry(KV_SNAPSHOT_KEY, now);
  if (l1) {
    return {
      snapshot: l1.value,
      source: "L1",
      stale: l1.stale,
      ageMs: l1.ageMs,
    };
  }

  // Tier 2: Cloudflare Cache API (caches.default)
  const edgeCache = getDefaultEdgeCache();
  if (edgeCache) {
    try {
      const cachedRes = await edgeCache.match(CACHE_API_URL);
      if (cachedRes) {
        const snapshot = (await cachedRes.json()) as CricketCatalogSnapshot;
        const ageMs = Math.max(0, now - Date.parse(snapshot.generatedAt));
        const stale = ageMs > ttlMs;
        isolateL1.set(KV_SNAPSHOT_KEY, snapshot, Math.min(ttlMs, 15_000), now);
        return { snapshot, source: "CACHE_API", stale, ageMs };
      }
    } catch {
      // Cache API unavailable or corrupt — fall through to KV
    }
  }

  // Tier 3: Cloudflare KV namespace (1 subrequest, shared across PoPs)
  if (env?.CREASE_KV) {
    try {
      const raw = await env.CREASE_KV.get(KV_SNAPSHOT_KEY, "text");
      if (raw) {
        const snapshot = JSON.parse(raw) as CricketCatalogSnapshot;
        const ageMs = Math.max(0, now - Date.parse(snapshot.generatedAt));
        const stale = ageMs > ttlMs;
        isolateL1.set(KV_SNAPSHOT_KEY, snapshot, Math.min(ttlMs, 15_000), now);
        return { snapshot, source: "KV", stale, ageMs };
      }
    } catch {
      // KV unavailable — fall through to memory fallback
    }
  }

  // Zero-binding local/test fallback
  if (memoryFallbackSnapshot) {
    const ageMs = Math.max(0, now - memoryFallbackSnapshot.savedAt);
    return {
      snapshot: memoryFallbackSnapshot.snapshot,
      source: "MEMORY",
      stale: ageMs > ttlMs,
      ageMs,
    };
  }

  return { snapshot: null, source: "FRESH", stale: true, ageMs: 0 };
}

export async function writeCatalogSnapshot(
  env: CreaseEnv | undefined,
  snapshot: CricketCatalogSnapshot,
  ttlMs: number,
  swrMs: number
): Promise<void> {
  const now = Date.now();
  const l1Ttl = Math.min(ttlMs, 15_000);
  isolateL1.set(KV_SNAPSHOT_KEY, snapshot, l1Ttl, now);
  memoryFallbackSnapshot = { snapshot, savedAt: now };

  const serialized = JSON.stringify(snapshot);
  const edgeCache = getDefaultEdgeCache();
  if (edgeCache) {
    try {
      const maxAgeSec = Math.max(15, Math.floor(ttlMs / 1000));
      const swrSec = Math.max(60, Math.floor(swrMs / 1000));
      await edgeCache.put(
        CACHE_API_URL,
        new Response(serialized, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": `public, max-age=${maxAgeSec}, stale-while-revalidate=${swrSec}`,
          },
        })
      );
    } catch {
      // Non-fatal in non-CF runtimes
    }
  }

  if (env?.CREASE_KV) {
    try {
      const expirationTtl = Math.max(60, Math.floor((ttlMs + swrMs) / 1000));
      await env.CREASE_KV.put(KV_SNAPSHOT_KEY, serialized, { expirationTtl });
    } catch {
      // Non-fatal if KV write quota exceeded or unbound in preview
    }
  }
}

export function clearSnapshotStoreForTests(): void {
  isolateL1.clear();
  memoryFallbackSnapshot = null;
}

export function getL1CacheStats(): ReturnType<L1Cache<CricketCatalogSnapshot>["stats"]> {
  return isolateL1.stats();
}
