import { Hono } from "hono";
import type { CreaseEnv } from "../../config/env";
import { ScheduleQuerySchema } from "../../domain/schemas";
import type { CricketMatch } from "../../domain/types";
import { generateCricketXmltvEpg } from "../../ingestion/catalog-builder";
import { getCatalogSnapshotWithSwr } from "../../ingestion/orchestrator";
import { errorJson, getSafeExecutionCtx, okJson } from "../envelope";

export const scheduleRoutes = new Hono<{ Bindings: CreaseEnv }>();

async function handleScheduleJson(c: Parameters<typeof okJson>[0]): Promise<Response> {
  const parsed = ScheduleQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorJson(c, 400, "INVALID_QUERY", "Invalid schedule query", parsed.error.flatten());
  }

  const { snapshot, cacheSource } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  let matches = snapshot.matches;
  if (parsed.data.format) {
    matches = matches.filter((m) => m.format === parsed.data.format);
  }
  if (parsed.data.date) {
    matches = matches.filter((m) => m.dateBucketUtc === parsed.data.date);
  }

  const nowMs = Date.now();
  const twoHoursMs = 2 * 3600 * 1000;
  const liveNow: CricketMatch[] = [];
  const startingSoon: CricketMatch[] = [];
  const byDate: Record<string, CricketMatch[]> = {};

  for (const m of matches) {
    if (m.phase === "live" || m.phase === "break") {
      liveNow.push(m);
    } else if (m.phase === "pre_match") {
      startingSoon.push(m);
    } else if (m.startTimeIso) {
      const startMs = Date.parse(m.startTimeIso);
      if (Number.isFinite(startMs) && startMs > nowMs && startMs - nowMs <= twoHoursMs) {
        startingSoon.push(m);
      }
    }

    const bucket = byDate[m.dateBucketUtc] ?? [];
    bucket.push(m);
    byDate[m.dateBucketUtc] = bucket;
  }

  return okJson(
    c,
    {
      liveNow,
      startingSoon,
      dates: Object.keys(byDate).sort(),
      byDate,
    },
    { cache: cacheSource, etag: snapshot.etag, cacheControl: "public, max-age=30" }
  );
}

scheduleRoutes.get("/schedule", handleScheduleJson);
scheduleRoutes.get("/epg", handleScheduleJson);

scheduleRoutes.get("/epg.xml", async (c) => {
  const { snapshot } = await getCatalogSnapshotWithSwr(c.env, getSafeExecutionCtx(c));
  const xml = generateCricketXmltvEpg(snapshot);
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=180",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
