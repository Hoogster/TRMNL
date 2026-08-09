import { Env, TodoItem } from "./types";
import { json, html, isAuthorized, unauthorized } from "./lib/http";

const STORE_KEY = "todos";
const DEFAULT_LIST = "Familie";

async function loadTodos(env: Env): Promise<TodoItem[]> {
  const raw = await env.TODO_KV.get(STORE_KEY, "json");
  return (raw as TodoItem[]) ?? [];
}

async function saveTodos(env: Env, items: TodoItem[]): Promise<void> {
  await env.TODO_KV.put(STORE_KEY, JSON.stringify(items));
}

function newId(): string {
  return crypto.randomUUID();
}

/** Shapes the raw todo list into the JSON contract the Liquid templates render. */
function toTrmnlPayload(items: TodoItem[]) {
  const open = items.filter((i) => !i.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const listNames = Array.from(new Set(items.map((i) => i.list)));

  const lists = listNames
    .map((name) => {
      const listOpen = open.filter((i) => i.list === name);
      return {
        name,
        open_count: listOpen.length,
        items: listOpen.slice(0, 12).map((i) => ({ id: i.id, text: i.text })),
      };
    })
    // Hide fully-empty lists on the display, but keep at least one so layouts have something to say.
    .filter((l) => l.open_count > 0);

  return {
    has_data: items.length > 0,
    updated_at: new Date().toISOString(),
    total_open: open.length,
    total_lists: lists.length,
    lists,
    // Flat convenience view for simple layouts (quadrant/half) that just want "the next N things".
    top_items: open.slice(0, 8).map((i) => ({ text: i.text, list: i.list })),
  };
}

export async function handleTodoRequest(request: Request, env: Env, url: URL): Promise<Response | null> {
  const { pathname } = url;

  // GET /todo.json - the TRMNL polling endpoint (read-only, requires the shared key)
  if (pathname === "/todo.json" && request.method === "GET") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const items = await loadTodos(env);
    return json(toTrmnlPayload(items));
  }

  // GET /todo - the mobile-friendly family web UI (static HTML/JS, no server-side data embedded)
  if (pathname === "/todo" && request.method === "GET") {
    return html(TODO_PAGE_HTML);
  }

  // --- JSON API used by the web UI above (also requires the shared key, sent as a header) ---

  if (pathname === "/api/todo" && request.method === "GET") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const items = await loadTodos(env);
    return json({ items });
  }

  if (pathname === "/api/todo" && request.method === "POST") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const body = await request.json<{ text?: string; list?: string }>().catch(() => ({}) as any);
    const text = (body.text ?? "").trim();
    if (!text) return json({ error: "text is required" }, { status: 400 });
    const list = (body.list ?? DEFAULT_LIST).trim() || DEFAULT_LIST;

    const items = await loadTodos(env);
    const item: TodoItem = { id: newId(), list, text, done: false, createdAt: new Date().toISOString() };
    items.push(item);
    await saveTodos(env, items);
    return json({ item }, { status: 201 });
  }

  const toggleMatch = pathname.match(/^\/api\/todo\/([^/]+)\/toggle$/);
  if (toggleMatch && request.method === "POST") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const items = await loadTodos(env);
    const item = items.find((i) => i.id === toggleMatch[1]);
    if (!item) return json({ error: "not found" }, { status: 404 });
    item.done = !item.done;
    item.doneAt = item.done ? new Date().toISOString() : undefined;
    await saveTodos(env, items);
    return json({ item });
  }

  const deleteMatch = pathname.match(/^\/api\/todo\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    if (!isAuthorized(request, env.TRMNL_API_KEY)) return unauthorized();
    const items = await loadTodos(env);
    const next = items.filter((i) => i.id !== deleteMatch[1]);
    if (next.length === items.length) return json({ error: "not found" }, { status: 404 });
    await saveTodos(env, next);
    return json({ ok: true });
  }

  return null; // not a todo route
}

/**
 * Minimal, dependency-free mobile web UI. Ships as a single inline HTML string so the
 * Worker doesn't need Workers Sites/Assets configured - just deploy and go.
 *
 * The API key is requested once via `prompt()` and cached in localStorage, then sent as
 * `X-API-Key` on every fetch. Good enough to keep the family's list off of randos who
 * stumble on the URL; it is not meant to withstand a determined attacker.
 */
const TODO_PAGE_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Familien To-Do</title>
<link rel="manifest" href="data:application/manifest+json,${encodeURIComponent(
  JSON.stringify({ name: "Familien To-Do", display: "standalone", start_url: "/todo", background_color: "#111827", theme_color: "#111827" }),
)}">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f4f4f5; color: #18181b; padding-bottom: 6rem;
  }
  header { padding: 1.25rem 1rem 0.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 0.75rem; }
  .lists { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0 1rem 0.75rem; }
  .list-chip {
    flex: none; padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid #d4d4d8;
    background: #fff; font-size: 0.9rem; white-space: nowrap; cursor: pointer;
  }
  .list-chip.active { background: #18181b; color: #fff; border-color: #18181b; }
  main { padding: 0 1rem; max-width: 32rem; margin: 0 auto; }
  ul { list-style: none; margin: 0; padding: 0; }
  li {
    display: flex; align-items: center; gap: 0.75rem; background: #fff; border-radius: 0.75rem;
    padding: 0.75rem 0.9rem; margin-bottom: 0.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  }
  li.done .text { text-decoration: line-through; opacity: 0.5; }
  li input[type=checkbox] { width: 1.3rem; height: 1.3rem; flex: none; }
  li .text { flex: 1; word-break: break-word; }
  li button.del { border: none; background: none; color: #a1a1aa; font-size: 1.1rem; padding: 0.25rem; }
  form { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 0.5rem; padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom)); background: #f4f4f5cc; backdrop-filter: blur(8px); }
  form input[type=text] { flex: 1; padding: 0.75rem 0.9rem; border-radius: 0.75rem; border: 1px solid #d4d4d8; font-size: 1rem; }
  form button { padding: 0.75rem 1.1rem; border-radius: 0.75rem; border: none; background: #18181b; color: #fff; font-size: 1rem; }
  .empty { color: #71717a; padding: 2rem 0; text-align: center; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0d; color: #f4f4f5; }
    li { background: #18181b; box-shadow: none; }
    .list-chip { background: #18181b; border-color: #27272a; color: #f4f4f5; }
    .list-chip.active { background: #f4f4f5; color: #18181b; }
    form { background: #0b0b0dcc; }
    form input[type=text] { background: #18181b; border-color: #27272a; color: #f4f4f5; }
  }
</style>
</head>
<body>
<header><h1>🏡 Familien To-Do</h1></header>
<div class="lists" id="lists"></div>
<main><ul id="items"></ul></main>
<form id="addForm">
  <input type="text" id="newItemText" placeholder="Neue Aufgabe..." autocomplete="off" required>
  <button type="submit">+</button>
</form>
<script>
(function () {
  var KEY_STORAGE = "trmnl_todo_key";
  function getKey() {
    var k = localStorage.getItem(KEY_STORAGE);
    if (!k) {
      k = prompt("Zugangs-Code für die Familien-To-Do-Liste:");
      if (k) localStorage.setItem(KEY_STORAGE, k);
    }
    return k || "";
  }

  var currentList = "alle";
  var allItems = [];

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ "X-API-Key": getKey(), "Content-Type": "application/json" }, options.headers || {});
    return fetch(path, options).then(function (res) {
      if (res.status === 401) { localStorage.removeItem(KEY_STORAGE); alert("Falscher Code - bitte neu laden."); throw new Error("unauthorized"); }
      return res.json();
    });
  }

  function renderLists() {
    var names = ["alle"].concat(Array.from(new Set(allItems.map(function (i) { return i.list; }))));
    var el = document.getElementById("lists");
    el.innerHTML = "";
    names.forEach(function (name) {
      var chip = document.createElement("div");
      chip.className = "list-chip" + (name === currentList ? " active" : "");
      chip.textContent = name === "alle" ? "Alle" : name;
      chip.onclick = function () { currentList = name; render(); };
      el.appendChild(chip);
    });
  }

  function render() {
    renderLists();
    var ul = document.getElementById("items");
    ul.innerHTML = "";
    var visible = allItems
      .filter(function (i) { return currentList === "alle" || i.list === currentList; })
      .sort(function (a, b) { return (a.done === b.done) ? a.createdAt.localeCompare(b.createdAt) : (a.done ? 1 : -1); });

    if (visible.length === 0) {
      ul.innerHTML = '<div class="empty">Keine Aufgaben 🎉</div>';
      return;
    }
    visible.forEach(function (item) {
      var li = document.createElement("li");
      li.className = item.done ? "done" : "";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = item.done;
      cb.onchange = function () { toggle(item.id); };
      var span = document.createElement("span");
      span.className = "text";
      span.textContent = item.text + (currentList === "alle" ? "  ·  " + item.list : "");
      var del = document.createElement("button");
      del.className = "del"; del.textContent = "✕";
      del.onclick = function () { remove(item.id); };
      li.appendChild(cb); li.appendChild(span); li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function load() {
    api("/api/todo").then(function (data) { allItems = data.items || []; render(); });
  }

  function toggle(id) {
    api("/api/todo/" + id + "/toggle", { method: "POST" }).then(load);
  }
  function remove(id) {
    api("/api/todo/" + id, { method: "DELETE" }).then(load);
  }

  document.getElementById("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("newItemText");
    var text = input.value.trim();
    if (!text) return;
    var list = currentList === "alle" ? "${DEFAULT_LIST}" : currentList;
    api("/api/todo", { method: "POST", body: JSON.stringify({ text: text, list: list }) }).then(function () {
      input.value = "";
      load();
    });
  });

  load();
})();
</script>
</body>
</html>`;
