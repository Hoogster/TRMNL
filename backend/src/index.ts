import { Env } from "./types";
import { html, json, normalizePath } from "./lib/http";
import { handleTodoRequest } from "./todo";
import { handleWeatherRequest, refreshWeather } from "./weather";
import { handleMenuRequest } from "./menu";

// A bare JSON blob at "/" reads as a confusing error to anyone who lands here without the
// exact "/todo" path typed - link here instead so a mistyped/pasted base URL still gets
// someone to the actual family To-Do page.
const LANDING_PAGE_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TRMNL Family Backend</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1.25rem; color: #18181b; }
  a.button { display: inline-block; margin-top: 1rem; padding: 0.75rem 1.25rem; border-radius: 0.75rem; background: #18181b; color: #fff; text-decoration: none; font-weight: 600; }
  @media (prefers-color-scheme: dark) { body { color: #f4f4f5; background: #0b0b0d; } }
</style>
</head>
<body>
  <h1>🏡 TRMNL Family Backend</h1>
  <p>Das ist nur der Server dahinter - die Familien-To-Do-Liste ist hier:</p>
  <a class="button" href="/todo">Zur To-Do-Liste →</a>
  <p style="margin-top:2rem;">Wetter (<code>/weather.json</code>) und Menü-Inspiration (<code>/menu.json</code>) sind reine TRMNL-Polling-Endpunkte ohne eigene Seite.</p>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    url.pathname = normalizePath(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,x-api-key,authorization",
        },
      });
    }

    if (url.pathname === "/") {
      return html(LANDING_PAGE_HTML);
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "trmnl-family-backend" });
    }

    const todoResponse = await handleTodoRequest(request, env, url);
    if (todoResponse) return todoResponse;

    const weatherResponse = await handleWeatherRequest(request, env, url);
    if (weatherResponse) return weatherResponse;

    const menuResponse = await handleMenuRequest(request, env, url);
    if (menuResponse) return menuResponse;

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
