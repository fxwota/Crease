import { resolveRuntimeConfig, type CreaseEnv } from "../config/env";
import type { CricketCatalogSnapshot } from "../domain/types";
import { PROVIDER_ADAPTERS } from "../providers/registry";
import type { Cs3ProviderAdapter, ProviderFetchResult } from "../providers/types";
import { providerCircuitBreaker } from "../storage/circuit-breaker";
import {
  readCatalogSnapshot,
  writeCatalogSnapshot,
  type CacheSource,
} from "../storage/snapshot-store";
import {
  buildCricketCatalogSnapshot,
  type ProviderIngestionReport,
} from "./catalog-builder";

let inflightRefresh: Promise<CricketCatalogSnapshot> | null = null;

export interface ResolvedCatalogResult {
  snapshot: CricketCatalogSnapshot;
  cacheSource: CacheSource;
  stale: boolean;
}

async function ingestSingleProvider(
  adapter: Cs3ProviderAdapter,
  env: CreaseEnv | undefined,
  timeoutMs: number
): Promise<ProviderIngestionReport> {
  const id = adapter.descriptor.id;
  const startedAt = Date.now();

  if (!providerCircuitBreaker.canExecute(id)) {
    return {
      result: { provider: id, events: [], channels: [] },
      health: {
        provider: id,
        displayName: adapter.descriptor.displayName,
        cryptoPipeline: adapter.descriptor.cryptoPipeline,
        customScheme: adapter.descriptor.customScheme,
        circuitState: providerCircuitBreaker.getState(id),
        ok: false,
        latencyMs: 0,
        rawEventsFetched: 0,
        cricketEventsKept: 0,
        nonCricketDropped: 0,
        channelsKept: 0,
        lastError: "Circuit breaker OPEN — cooling down",
      },
    };
  }

  try {
    const result: ProviderFetchResult = await adapter.fetchCatalog(env, timeoutMs);
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const hasPayload = result.events.length > 0 || result.channels.length > 0;
    if (hasPayload) {
      providerCircuitBreaker.recordSuccess(id);
    } else {
      providerCircuitBreaker.recordFailure(id, "Empty payload from upstream domains");
    }

    const health: ProviderIngestionReport["health"] = {
      provider: id,
      displayName: adapter.descriptor.displayName,
      cryptoPipeline: adapter.descriptor.cryptoPipeline,
      customScheme: adapter.descriptor.customScheme,
      circuitState: providerCircuitBreaker.getState(id),
      ok: hasPayload,
      latencyMs,
      rawEventsFetched: result.events.length,
      cricketEventsKept: 0,
      nonCricketDropped: 0,
      channelsKept: 0,
    };
    if (result.resolvedDomain) health.resolvedDomain = result.resolvedDomain;
    if (hasPayload) health.lastSuccessAt = new Date().toISOString();
    else health.lastError = "No reachable cricket payload across candidate domains";

    return { result, health };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider ingestion error";
    providerCircuitBreaker.recordFailure(id, msg);
    return {
      result: { provider: id, events: [], channels: [] },
      health: {
        provider: id,
        displayName: adapter.descriptor.displayName,
        cryptoPipeline: adapter.descriptor.cryptoPipeline,
        customScheme: adapter.descriptor.customScheme,
        circuitState: providerCircuitBreaker.getState(id),
        ok: false,
        latencyMs: Math.max(1, Date.now() - startedAt),
        rawEventsFetched: 0,
        cricketEventsKept: 0,
        nonCricketDropped: 0,
        channelsKept: 0,
        lastError: msg,
      },
    };
  }
}

export async function runScheduledIngestion(
  env: CreaseEnv | undefined,
  adapters: readonly Cs3ProviderAdapter[] = PROVIDER_ADAPTERS
): Promise<CricketCatalogSnapshot> {
  if (inflightRefresh) {
    return inflightRefresh;
  }

  const config = resolveRuntimeConfig(env);
  const storageMode = env?.CREASE_KV ? "kv" : "memory-fallback";

  inflightRefresh = (async () => {
    const startedAt = Date.now();
    let reports: ProviderIngestionReport[];

    if (!config.enableUpstreamFetch) {
      reports = adapters.map((adapter) => ({
        result: { provider: adapter.descriptor.id, events: [], channels: [] },
        health: {
          provider: adapter.descriptor.id,
          displayName: adapter.descriptor.displayName,
          cryptoPipeline: adapter.descriptor.cryptoPipeline,
          customScheme: adapter.descriptor.customScheme,
          circuitState: providerCircuitBreaker.getState(adapter.descriptor.id),
          ok: false,
          latencyMs: 0,
          rawEventsFetched: 0,
          cricketEventsKept: 0,
          nonCricketDropped: 0,
          channelsKept: 0,
          lastError: "Upstream fetching disabled by ENABLE_UPSTREAM_FETCH=false",
        },
      }));
    } else {
      reports = await Promise.all(
        adapters.map((adapter) => ingestSingleProvider(adapter, env, config.providerTimeoutMs))
      );
    }

    const durationMs = Math.max(1, Date.now() - startedAt);
    const freshSnapshot = buildCricketCatalogSnapshot({
      reports,
      ingestionDurationMs: durationMs,
      storageMode,
    });

    // If all providers failed on this run, preserve previous healthy snapshot if one exists
    if (freshSnapshot.diagnostics.degraded && freshSnapshot.matches.length === 0) {
      const existing = await readCatalogSnapshot(env, config.snapshotTtlMs);
      if (existing.snapshot && existing.snapshot.matches.length > 0) {
        return existing.snapshot;
      }
    }

    await writeCatalogSnapshot(
      env,
      freshSnapshot,
      config.snapshotTtlMs,
      config.staleWhileRevalidateMs
    );
    return freshSnapshot;
  })().finally(() => {
    inflightRefresh = null;
  });

  return inflightRefresh;
}

export async function getCatalogSnapshotWithSwr(
  env: CreaseEnv | undefined,
  ctx?: Pick<ExecutionContext, "waitUntil">
): Promise<ResolvedCatalogResult> {
  const config = resolveRuntimeConfig(env);
  const cached = await readCatalogSnapshot(env, config.snapshotTtlMs);

  if (cached.snapshot) {
    const updatedSnapshot: CricketCatalogSnapshot = {
      ...cached.snapshot,
      diagnostics: {
        ...cached.snapshot.diagnostics,
        snapshotAgeSec: Math.floor(cached.ageMs / 1000),
      },
    };

    if (cached.stale && config.enableUpstreamFetch) {
      const refreshPromise = runScheduledIngestion(env).catch(() => updatedSnapshot);
      if (ctx) {
        ctx.waitUntil(refreshPromise);
      }
    }

    return {
      snapshot: updatedSnapshot,
      cacheSource: cached.source,
      stale: cached.stale,
    };
  }

  // Cold isolate with no KV snapshot yet: perform singleflight refresh
  const fresh = await runScheduledIngestion(env);
  return {
    snapshot: fresh,
    cacheSource: "FRESH",
    stale: false,
  };
}
