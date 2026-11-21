import type { CreaseEnv } from "../config/env";
import type { ClearKeyConfig, ProviderId } from "../domain/types";

export interface RawProviderStream {
  label: string;
  url: string;
  customScheme?: string;
  headers?: Record<string, string>;
  drm?: ClearKeyConfig;
  typeHint?: string;
}

export interface RawProviderEvent {
  provider: ProviderId;
  providerEventId: string;
  title: string;
  tournament?: string;
  category?: string;
  sportHint?: string;
  teamA?: string;
  teamB?: string;
  teamALogo?: string;
  teamBLogo?: string;
  posterUrl?: string;
  status?: string;
  startTimeIso?: string;
  endTimeIso?: string;
  streams: RawProviderStream[];
}

export interface RawProviderChannel {
  provider: ProviderId;
  providerChannelId: string;
  name: string;
  category: string;
  group?: string;
  logoUrl?: string;
  streams: RawProviderStream[];
}

export interface ProviderFetchResult {
  provider: ProviderId;
  resolvedDomain?: string;
  events: RawProviderEvent[];
  channels: RawProviderChannel[];
}

export interface ProviderDescriptor {
  id: ProviderId;
  displayName: string;
  packageName: string;
  customScheme: string;
  cryptoPipeline: string;
  fallbackDomains: readonly string[];
}

export interface Cs3ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  fetchCatalog(env: CreaseEnv | undefined, timeoutMs: number): Promise<ProviderFetchResult>;
  resolveCustomScheme(
    schemePath: string,
    env: CreaseEnv | undefined,
    timeoutMs: number
  ): Promise<RawProviderStream[]>;
}
