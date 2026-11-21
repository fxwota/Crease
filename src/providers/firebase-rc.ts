import type { CreaseEnv } from "../config/env";
import { L1Cache } from "../storage/l1-cache";

export interface FirebaseRemoteConfigSpec {
  providerKey: string;
  projectIdOrNumber: string;
  apiKey: string;
  appId: string;
  packageName: string;
  certSha1?: string;
}

const RC_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const rcCache = new L1Cache<Record<string, string>>(16);

function generateFirebaseInstanceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "d";
  for (let i = 0; i < 21; i++) {
    out += chars[(bytes[i % 16] ?? 0) % chars.length]!;
  }
  return out;
}

export async function fetchFirebaseRemoteConfig(
  spec: FirebaseRemoteConfigSpec,
  env: CreaseEnv | undefined,
  timeoutMs = 3500
): Promise<Record<string, string>> {
  const cacheKey = `crease:frc:${spec.providerKey}`;

  return rcCache.singleflight(cacheKey, RC_TTL_MS, async () => {
    // Check Cloudflare KV cache first (0 Firebase subrequests on warm runs)
    if (env?.CREASE_KV) {
      try {
        const cached = await env.CREASE_KV.get(cacheKey, "text");
        if (cached) {
          const parsed = JSON.parse(cached) as Record<string, string>;
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
      } catch {
        // Proceed to live fetch
      }
    }

    const endpoint = `https://firebaseremoteconfig.googleapis.com/v1/projects/${spec.projectIdOrNumber}/namespaces/firebase:fetch?key=${encodeURIComponent(spec.apiKey)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Android-Package": spec.packageName,
      "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7)",
    };
    if (spec.certSha1) {
      headers["X-Android-Cert"] = spec.certSha1;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appId: spec.appId,
          appInstanceId: generateFirebaseInstanceId(),
          packageName: spec.packageName,
          sdkVersion: "21.6.0",
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        return {};
      }

      const json = (await res.json()) as { entries?: Record<string, string> };
      const entries = json.entries ?? {};

      if (env?.CREASE_KV && Object.keys(entries).length > 0) {
        try {
          await env.CREASE_KV.put(cacheKey, JSON.stringify(entries), {
            expirationTtl: Math.floor(RC_TTL_MS / 1000),
          });
        } catch {
          // non-fatal
        }
      }

      return entries;
    } catch {
      return {};
    }
  });
}

export function extractDomainFromRc(
  entries: Record<string, string>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const val = entries[key]?.trim();
    if (val && /^https?:\/\//i.test(val)) {
      return val.replace(/\/+$/, "");
    }
  }
  return undefined;
}
