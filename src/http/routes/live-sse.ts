import { Hono } from "hono";
import { APP_VERSION, type CreaseEnv } from "../../config/env";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import { getSafeExecutionCtx } from "../envelope";

export const liveSseRoutes = new Hono<{ Bindings: CreaseEnv }>();

const MAX_SSE_DURATION_MS = 55_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

liveSseRoutes.get("/live/sse", async (c) => {
  const { snapshot } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const signal = c.req.raw.signal;
  let closed = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let maxDurationTimer: ReturnType<typeof setTimeout> | undefined;

  const closeStream = (): void => {
    if (closed) return;
    closed = true;
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    if (maxDurationTimer !== undefined) clearTimeout(maxDurationTimer);
    writer.close().catch(() => {});
  };

  signal.addEventListener("abort", closeStream, { once: true });

  const writeChunk = async (chunk: string): Promise<void> => {
    if (closed) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      closeStream();
    }
  };

  const initialPayload = JSON.stringify({
    version: APP_VERSION,
    generatedAt: snapshot.generatedAt,
    etag: snapshot.etag,
    liveCount: snapshot.matches.filter((m) => m.phase === "live").length,
    totalMatches: snapshot.matches.length,
    totalChannels: snapshot.channels.length,
    matches: snapshot.matches.slice(0, 25).map((m) => ({
      matchId: m.matchId,
      title: m.title,
      format: m.format,
      squadClass: m.squadClass,
      phase: m.phase,
      series: m.series.shortName,
      streamCount: m.streamCount,
      providers: m.providers,
    })),
    providers: snapshot.providers.map((p) => ({
      provider: p.provider,
      ok: p.ok,
      circuitState: p.circuitState,
      cricketEventsKept: p.cricketEventsKept,
    })),
  });

  // Start async stream lifecycle (non-blocking)
  void (async () => {
    await writeChunk(`retry: 5000\n\n`);
    await writeChunk(`event: snapshot\ndata: ${initialPayload}\n\n`);

    if (closed) return;

    heartbeatTimer = setInterval(() => {
      void writeChunk(`: keep-alive ${new Date().toISOString()}\n\n`);
    }, HEARTBEAT_INTERVAL_MS);

    maxDurationTimer = setTimeout(() => {
      void writeChunk(`event: reconnect\ndata: {"reason":"edge_window_rotate"}\n\n`).finally(
        closeStream
      );
    }, MAX_SSE_DURATION_MS);
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Crease-Version": APP_VERSION,
    },
  });
});
