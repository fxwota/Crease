import { serve } from "@hono/node-server";
import type { CreaseEnv } from "../src/config/env";
import { createCreaseApp } from "../src/http/app";

const port = Number.parseInt(process.env["PORT"] ?? "3000", 10) || 3000;
const app = createCreaseApp();

const localEnv: CreaseEnv = {
  ENVIRONMENT: process.env["ENVIRONMENT"] ?? "development",
  LOG_LEVEL: process.env["LOG_LEVEL"] ?? "info",
  SNAPSHOT_TTL_SECONDS: process.env["SNAPSHOT_TTL_SECONDS"] ?? "180",
  STALE_WHILE_REVALIDATE_SECONDS: process.env["STALE_WHILE_REVALIDATE_SECONDS"] ?? "600",
  PROVIDER_TIMEOUT_MS: process.env["PROVIDER_TIMEOUT_MS"] ?? "4000",
  ENABLE_UPSTREAM_FETCH: process.env["ENABLE_UPSTREAM_FETCH"] ?? "true",
};

const mockExecutionCtx = {
  waitUntil(promise: Promise<unknown>): void {
    promise.catch(() => {});
  },
  passThroughOnException(): void {},
} as unknown as ExecutionContext;

serve(
  {
    port,
    hostname: "0.0.0.0",
    fetch: (request: Request) => app.fetch(request, localEnv, mockExecutionCtx),
  },
  (info) => {
    console.log(`Crease Cricket Edge API v0.0.0 listening on http://localhost:${info.port}`);
  }
);
