export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // TRMNL and the todo web UI both fetch cross-origin from their own hosts.
      "access-control-allow-origin": "*",
      ...init.headers,
    },
  });
}

export function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...init.headers,
    },
  });
}

export function unauthorized(message = "Unauthorized"): Response {
  return json({ error: message }, { status: 401 });
}

/**
 * Every API route (TRMNL polling endpoints + the todo write actions) is gated behind
 * one shared secret. Accepts it either as `X-API-Key: <key>` (what TRMNL's polling
 * headers use) or `?key=<key>` (handy for pasting a URL straight into a browser).
 */
export function isAuthorized(request: Request, expectedKey: string): boolean {
  if (!expectedKey) return false;
  const header = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header && timingSafeEqual(header, expectedKey)) return true;
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key");
  if (queryKey && timingSafeEqual(queryKey, expectedKey)) return true;
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
