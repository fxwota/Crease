import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { APP_VERSION, type CreaseEnv } from "../config/env";
import type { CacheSource } from "../storage/snapshot-store";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiMeta {
  version: string;
  timestamp: string;
  requestId: string;
  cache?: CacheSource | "BYPASS";
  etag?: string;
  pagination?: PaginationMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
  error: null;
}

export interface ApiErrorEnvelope {
  ok: false;
  data: null;
  meta: ApiMeta;
  error: ApiErrorBody;
}

export type CreaseContext = Context<{ Bindings: CreaseEnv }>;

export function getRequestId(c: CreaseContext): string {
  const existing = c.req.header("cf-ray") ?? c.req.header("x-request-id");
  if (existing) return existing;
  return `req_${crypto.randomUUID().slice(0, 12)}`;
}

export function getSafeExecutionCtx(
  c: CreaseContext
): Pick<ExecutionContext, "waitUntil"> | undefined {
  try {
    const ctx = c.executionCtx;
    if (ctx && typeof ctx.waitUntil === "function") {
      return ctx;
    }
  } catch {
    // Non-Worker execution context (e.g. Node dev server or direct unit test)
  }
  return undefined;
}

export function checkConditionalNotModified(
  c: CreaseContext,
  etag: string
): Response | null {
  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch && ifNoneMatch.trim() === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "X-Crease-Version": APP_VERSION,
        "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      },
    });
  }
  return null;
}

export function okJson<T>(
  c: CreaseContext,
  data: T,
  opts?: {
    status?: ContentfulStatusCode;
    cache?: CacheSource | "BYPASS";
    etag?: string;
    pagination?: PaginationMeta;
    cacheControl?: string;
  }
): Response {
  const meta: ApiMeta = {
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    requestId: getRequestId(c),
  };
  if (opts?.cache) meta.cache = opts.cache;
  if (opts?.etag) meta.etag = opts.etag;
  if (opts?.pagination) meta.pagination = opts.pagination;

  const body: ApiSuccessEnvelope<T> = {
    ok: true,
    data,
    meta,
    error: null,
  };

  c.header("X-Crease-Version", APP_VERSION);
  if (opts?.cache) c.header("X-Crease-Edge-Cache", opts.cache);
  if (opts?.etag) c.header("ETag", opts.etag);
  if (opts?.cacheControl) c.header("Cache-Control", opts.cacheControl);

  return c.json(body, opts?.status ?? 200);
}

export function errorJson(
  c: CreaseContext,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown
): Response {
  const errObj: ApiErrorBody = { code, message };
  if (details !== undefined) errObj.details = details;

  const body: ApiErrorEnvelope = {
    ok: false,
    data: null,
    meta: {
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      requestId: getRequestId(c),
    },
    error: errObj,
  };

  c.header("X-Crease-Version", APP_VERSION);
  return c.json(body, status);
}
