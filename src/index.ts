import type { CreaseEnv } from "./config/env";
import { createCreaseApp } from "./http/app";
import { runScheduledIngestion } from "./ingestion/orchestrator";

const app = createCreaseApp();

const worker: ExportedHandler<CreaseEnv> = {
  async fetch(request: Request, env: CreaseEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async scheduled(
    _controller: ScheduledController,
    env: CreaseEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runScheduledIngestion(env));
  },
};

export default worker;
export { createCreaseApp };
