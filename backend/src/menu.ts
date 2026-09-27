import { Env } from "./types";
import { json, isAuthorized, unauthorized } from "./lib/http";
import { getSeasonalMenu } from "./lib/seasonalMenu";

/**
 * Unlike weather/todo, this needs no cache or external call at all - the seasonal recipe
 * pick is a pure, cheap function of the current date, computed fresh on every request.
 */
export async function handleMenuRequest(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== "/menu.json" || request.method !== "GET") return null;

  if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();

  const menu = getSeasonalMenu();
  return json({ has_data: true, updated_at: new Date().toISOString(), ...menu });
}
