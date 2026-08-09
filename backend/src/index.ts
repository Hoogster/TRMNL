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
   * Cron entry point - see the `[triggers]` crons in wrangler.toml. By default the
   * 24-hour endpoint is refreshed 4x/day and the 7-day endpoint once/day, for a total of
   * 5 SRF API calls/day - safely under the documented 6/day free-tier cap with headroom
   * for a manual /admin/weather/refresh if you ever need one.
   */
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const hourUTC = new Date(controller.scheduledTime).getUTCHours();
    const includeWeekly = hourUTC === 5; // one weekly-outlook fetch/day, at the 05:00 UTC tick
    await refreshWeather(env, { includeWeekly });
  },
};
