import type { CircuitState, ProviderId } from "../domain/types";

interface BreakerRecord {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number;
  lastError?: string;
}

export class ProviderCircuitBreaker {
  private readonly records = new Map<ProviderId, BreakerRecord>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(failureThreshold = 3, cooldownMs = 60_000) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
  }

  canExecute(provider: ProviderId, now = Date.now()): boolean {
    const rec = this.records.get(provider);
    if (!rec || rec.state === "CLOSED") return true;

    if (rec.state === "OPEN") {
      if (now - rec.openedAt >= this.cooldownMs) {
        rec.state = "HALF_OPEN";
        return true;
      }
      return false;
    }

    // HALF_OPEN permits probe attempt
    return true;
  }

  recordSuccess(provider: ProviderId): void {
    this.records.set(provider, {
      state: "CLOSED",
      consecutiveFailures: 0,
      openedAt: 0,
    });
  }

  recordFailure(provider: ProviderId, reason: string, now = Date.now()): void {
    const prev = this.records.get(provider) ?? {
      state: "CLOSED" as CircuitState,
      consecutiveFailures: 0,
      openedAt: 0,
    };
    const failures = prev.consecutiveFailures + 1;
    const isOpen = failures >= this.failureThreshold || prev.state === "HALF_OPEN";
    this.records.set(provider, {
      state: isOpen ? "OPEN" : "CLOSED",
      consecutiveFailures: failures,
      openedAt: isOpen ? now : prev.openedAt,
      lastError: reason,
    });
  }

  getState(provider: ProviderId, now = Date.now()): CircuitState {
    const rec = this.records.get(provider);
    if (!rec) return "CLOSED";
    if (rec.state === "OPEN" && now - rec.openedAt >= this.cooldownMs) {
      return "HALF_OPEN";
    }
    return rec.state;
  }

  resetAll(): void {
    this.records.clear();
  }
}

export const providerCircuitBreaker = new ProviderCircuitBreaker();
