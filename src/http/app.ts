import { Hono } from "hono";
import { cors } from "hono/cors";
import { RAW_CHANGELOG_MD } from "../config/changelog-raw";
import { APP_VERSION, type CreaseEnv } from "../config/env";
import { renderChangelogHtml } from "../ui/changelog";
import { renderDocsHtml } from "../ui/docs";
import { renderPortalHtml } from "../ui/portal";
import { errorJson } from "./envelope";
import { OPENAPI_SPEC } from "./openapi";
import { channelsRoutes } from "./routes/channels";
import { entitiesRoutes } from "./routes/entities";
import { liveSseRoutes } from "./routes/live-sse";
import { matchesRoutes } from "./routes/matches";
import { scheduleRoutes } from "./routes/schedule";
import { streamsRoutes } from "./routes/streams";
import { healthRoutes, systemRoutes } from "./routes/system";

export function createCreaseApp(): Hono<{ Bindings: CreaseEnv }> {
  const app = new Hono<{ Bindings: CreaseEnv }>();

  // Global CORS & hardened security headers
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      allowHeaders: ["Accept", "Content-Type", "If-None-Match", "Range"],
      exposeHeaders: ["ETag", "X-Crease-Version", "X-Crease-Edge-Cache", "Content-Range"],
      maxAge: 86400,
    })
  );

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Crease-Version", APP_VERSION);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "SAMEORIGIN");
  });

  // UI & OpenAPI specification routes
  app.get("/", (c) => c.html(renderPortalHtml()));
  app.get("/portal", (c) => c.html(renderPortalHtml()));
  app.get("/changelog", (c) => c.html(renderChangelogHtml()));
  app.get("/changelog.md", (c) => {
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(RAW_CHANGELOG_MD, 200);
  });
  app.get("/docs", (c) => c.html(renderDocsHtml()));
  app.get("/openapi.json", (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json(OPENAPI_SPEC);
  });

  // Health
  app.route("/", healthRoutes);

  // Versioned /api/v1 Cricket API
  const v1 = new Hono<{ Bindings: CreaseEnv }>();
  v1.route("/matches", matchesRoutes);
  v1.route("/", entitiesRoutes);
  v1.route("/", scheduleRoutes);
  v1.route("/", channelsRoutes);
  v1.route("/", streamsRoutes);
  v1.route("/", liveSseRoutes);
  v1.route("/", systemRoutes);

  app.route("/api/v1", v1);

  // Structured JSON 404 & 500 error handlers
  app.notFound((c) =>
    errorJson(c, 404, "NOT_FOUND", `Route '${c.req.method} ${c.req.path}' does not exist`)
  );

  app.onError((err, c) =>
    errorJson(
      c,
      500,
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Unhandled edge worker error"
    )
  );

  return app;
}
