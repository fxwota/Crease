export const APP_NAME = "Crease";
export const APP_PACKAGE = "crease-api";
export const APP_VERSION = "0.0.0";

export interface CreaseEnv {
  CREASE_KV?: KVNamespace;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  SNAPSHOT_TTL_SECONDS?: string;
  STALE_WHILE_REVALIDATE_SECONDS?: string;
  PROVIDER_TIMEOUT_MS?: string;
  ENABLE_UPSTREAM_FETCH?: string;
}

export interface RuntimeConfig {
  environment: string;
  logLevel: "debug" | "info" | "warn" | "error";
  snapshotTtlMs: number;
  staleWhileRevalidateMs: number;
  providerTimeoutMs: number;
  enableUpstreamFetch: boolean;
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function resolveRuntimeConfig(env: CreaseEnv | undefined): RuntimeConfig {
  const levelRaw = (env?.LOG_LEVEL ?? "info").toLowerCase();
  const logLevel: RuntimeConfig["logLevel"] =
    levelRaw === "debug" || levelRaw === "warn" || levelRaw === "error" ? levelRaw : "info";

  return {
    environment: env?.ENVIRONMENT ?? "production",
    logLevel,
    snapshotTtlMs: parsePositiveInt(env?.SNAPSHOT_TTL_SECONDS, 180, 10, 3600) * 1000,
    staleWhileRevalidateMs: parsePositiveInt(env?.STALE_WHILE_REVALIDATE_SECONDS, 600, 30, 86400) * 1000,
    providerTimeoutMs: parsePositiveInt(env?.PROVIDER_TIMEOUT_MS, 4500, 500, 15000),
    enableUpstreamFetch: (env?.ENABLE_UPSTREAM_FETCH ?? "true").toLowerCase() !== "false",
  };
}
