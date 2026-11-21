import type { ProviderId } from "../domain/types";
import { cricifyProvider } from "./cricify";
import { livxowProvider } from "./livxow";
import { playfyProvider } from "./playfy";
import { playztvProvider } from "./playztv";
import { sktechProvider } from "./sktech";
import { sportzxProvider } from "./sportzx";
import type { Cs3ProviderAdapter } from "./types";

export const PROVIDER_ADAPTERS: readonly Cs3ProviderAdapter[] = [
  cricifyProvider,
  sportzxProvider,
  playfyProvider,
  sktechProvider,
  playztvProvider,
  livxowProvider,
];

const ADAPTER_BY_ID = new Map<ProviderId, Cs3ProviderAdapter>(
  PROVIDER_ADAPTERS.map((adapter) => [adapter.descriptor.id, adapter])
);

export function getProviderAdapter(id: string): Cs3ProviderAdapter | undefined {
  return ADAPTER_BY_ID.get(id.trim().toLowerCase() as ProviderId);
}

export function getProviderByCustomScheme(url: string): Cs3ProviderAdapter | undefined {
  const lower = url.trim().toLowerCase();
  return PROVIDER_ADAPTERS.find((adapter) => lower.startsWith(adapter.descriptor.customScheme));
}
