import { Env } from "./types";
import { json } from "./lib/http";
import { handleTodoRequest } from "./todo";
import { handleWeatherRequest, refreshWeather } from "./weather";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,x-api-key,authorization",
        },
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "trmnl-family-backend" });
    }

    const todoResponse = await handleTodoRequest(request, env, url);
    if (todoResponse) return todoResponse;

    const weatherResponse = await handleWeatherRequest(request, env, url);
    if (weatherResponse) return weatherResponse;

    return json({ error: "not found" }, { status: 404 });
  },

  /**
   * Cron entry point - see the `[triggers]` crons in wrangler.toml. One SRF API call per
   * tick (the single /forecastpoint call returns days + hours together), 4 ticks/day.
   */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await refreshWeather(env);
  },
};
