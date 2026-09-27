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
        items: listOpen.slice(0, 12).map((i) => ({ id: i.id, text: i.text, assignee: i.assignee, dueDate: i.dueDate })),
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
    top_items: open.slice(0, 8).map((i) => ({ text: i.text, list: i.list, assignee: i.assignee, dueDate: i.dueDate })),
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
    const body = await request.json<{ text?: string; list?: string; assignee?: string; dueDate?: string }>().catch(() => ({}) as any);
    const text = (body.text ?? "").trim();
    if (!text) return json({ error: "text is required" }, { status: 400 });
    const list = (body.list ?? DEFAULT_LIST).trim() || DEFAULT_LIST;
    const assignee = (body.assignee ?? "").trim() || undefined;
    const dueDate = (body.dueDate ?? "").trim() || undefined;

    const items = await loadTodos(env);
    const item: TodoItem = { id: newId(), list, text, done: false, createdAt: new Date().toISOString(), assignee, dueDate };
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
 * The API key is collected once via an on-page form (not `window.prompt()`) and cached in
 * localStorage with an in-memory fallback, then sent as `X-API-Key` on every fetch. This
 * page is often opened from an embedded webview (a chat app's link-preview browser, or
 * TRMNL's own companion app opening `tap_action_url`) - many such webviews silently no-op
 * `prompt()`/`alert()` (return null, show no dialog at all) and can restrict localStorage,
 * which made the previous prompt()-based flow fail completely and silently on mobile. Good
 * enough to keep the family's list off of randos who stumble on the URL; it is not meant
 * to withstand a determined attacker.
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
    background: #f4f4f5; color: #18181b; padding-bottom: 10rem;
  }
  .topbar { position: sticky; top: 0; z-index: 5; background: #f4f4f5; border-bottom: 1px solid rgba(0,0,0,0.08); }
  header { padding: 1.25rem 1rem 0.75rem; }
  h1 { font-size: 1.4rem; margin: 0; }
  .lists { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0 1rem 0.75rem; }
  .list-chip {
    flex: none; padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid #d4d4d8;
    background: #fff; font-size: 0.9rem; white-space: nowrap; cursor: pointer;
  }
  .list-chip.active { background: #18181b; color: #fff; border-color: #18181b; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  main { padding: 1rem 1rem 0; max-width: 32rem; margin: 0 auto; }
  ul { list-style: none; margin: 0; padding: 0; }
  li {
    display: flex; align-items: flex-start; gap: 0.75rem; background: #fff; border-radius: 0.9rem;
    padding: 0.85rem 0.9rem; margin-bottom: 0.6rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  }
  li input[type=checkbox] { width: 1.3rem; height: 1.3rem; flex: none; margin-top: 0.1rem; }
  li .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  li .text { word-break: break-word; line-height: 1.35; }
  li.done .body { opacity: 0.5; }
  li.done .text { text-decoration: line-through; }
  .meta { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .avatar {
    width: 1.3rem; height: 1.3rem; border-radius: 50%; color: #fff; font-size: 0.7rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex: none;
  }
  .tag { font-size: 0.75rem; color: #71717a; background: #f0f0f2; padding: 0.15rem 0.55rem; border-radius: 999px; }
  .tag.due.overdue { color: #b91c1c; background: #fee2e2; }
  li button.del {
    border: none; background: #f4f4f5; color: #71717a; font-size: 1rem; flex: none;
    width: 1.9rem; height: 1.9rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  }
  #addForm {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 10; display: flex; flex-direction: column; gap: 0.5rem;
    padding: 0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom)); background: #f4f4f5cc; backdrop-filter: blur(8px);
    border-top: 1px solid rgba(0,0,0,0.08);
  }
  .add-row { display: flex; gap: 0.5rem; }
  #addForm input[type=text] { flex: 1; padding: 0.75rem 0.9rem; border-radius: 0.75rem; border: 1px solid #d4d4d8; font-size: 1rem; }
  #addForm button[type=submit] { padding: 0.75rem 1.1rem; border-radius: 0.75rem; border: none; background: #18181b; color: #fff; font-size: 1rem; flex: none; }
  .add-row--meta select, .add-row--meta input[type=date] {
    flex: 1; min-width: 0; padding: 0.5rem 0.6rem; border-radius: 0.6rem; border: 1px solid #d4d4d8;
    font-size: 0.85rem; background: #fff; color: inherit;
  }
  .empty { color: #71717a; padding: 2rem 0; text-align: center; }
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); align-items: center; justify-content: center; z-index: 20; padding: 1rem; display: none; }
  .overlay:not([hidden]) { display: flex; }
  .overlay-card { background: #fff; border-radius: 1rem; padding: 1.5rem; max-width: 22rem; width: 100%; }
  .overlay-card h2 { margin: 0 0 0.5rem; font-size: 1.2rem; }
  .overlay-card p { margin: 0 0 1rem; color: #52525b; font-size: 0.9rem; }
  #authForm { display: flex; gap: 0.5rem; }
  #authForm input[type=password] { flex: 1; padding: 0.65rem 0.8rem; border-radius: 0.6rem; border: 1px solid #d4d4d8; font-size: 1rem; }
  #authForm button { padding: 0.65rem 1rem; border-radius: 0.6rem; border: none; background: #18181b; color: #fff; }
  .auth-error { color: #b91c1c; margin: 0.75rem 0 0 !important; font-size: 0.85rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0d; color: #f4f4f5; }
    .topbar { background: #0b0b0d; border-bottom-color: rgba(255,255,255,0.08); }
    li { background: #18181b; box-shadow: none; border: 1px solid #27272a; }
    li button.del { background: #27272a; color: #d4d4d8; }
    .list-chip { background: #18181b; border-color: #27272a; color: #f4f4f5; }
    .list-chip.active { background: #f4f4f5; color: #18181b; }
    .tag { background: #27272a; color: #a1a1aa; }
    .tag.due.overdue { background: #4c1d1d; color: #fca5a5; }
    #addForm { background: #0b0b0dcc; border-top-color: rgba(255,255,255,0.08); }
    #addForm input[type=text] { background: #18181b; border-color: #27272a; color: #f4f4f5; }
    .add-row--meta select, .add-row--meta input[type=date] { background: #18181b; border-color: #27272a; color: #f4f4f5; }
    .overlay-card { background: #18181b; }
    .overlay-card p { color: #a1a1aa; }
    #authForm input[type=password] { background: #0b0b0d; border-color: #27272a; color: #f4f4f5; }
  }
</style>
</head>
<body>
<div class="topbar">
  <header><h1>🏡 Familien To-Do</h1></header>
  <div class="lists" id="lists"></div>
</div>
<main><ul id="items"></ul></main>
<form id="addForm">
  <div class="add-row">
    <input type="text" id="newItemText" placeholder="Neue Aufgabe..." autocomplete="off" required>
    <button type="submit">+</button>
  </div>
  <div class="add-row add-row--meta">
    <select id="newItemAssignee" aria-label="Zugewiesen an">
      <option value="">Niemand</option>
      <option value="Livi">Livi</option>
      <option value="Fäbu">Fäbu</option>
    </select>
    <input type="date" id="newItemDue" aria-label="Fällig am">
  </div>
</form>

<div class="overlay" id="authOverlay" hidden>
  <div class="overlay-card">
    <h2>Zugang</h2>
    <p>Bitte den Zugangs-Code für die Familien-To-Do-Liste eingeben.</p>
    <form id="authForm">
      <input type="password" id="authKeyInput" placeholder="Zugangs-Code" autocomplete="off" required>
      <button type="submit">Weiter</button>
    </form>
    <p class="auth-error" id="authError" hidden>Falscher Code, bitte erneut versuchen.</p>
  </div>
</div>

<script>
(function () {
  var KEY_STORAGE = "trmnl_todo_key";
  var memoryKey = null; // in-memory fallback for webviews that block/clear localStorage

  function safeGetStoredKey() {
    try { return localStorage.getItem(KEY_STORAGE); } catch (e) { return null; }
  }
  function safeSetStoredKey(k) {
    try { localStorage.setItem(KEY_STORAGE, k); } catch (e) { /* memoryKey still holds it for this page load */ }
  }
  function safeClearStoredKey() {
    try { localStorage.removeItem(KEY_STORAGE); } catch (e) { /* ignore */ }
  }
  function getKey() { return memoryKey || safeGetStoredKey() || ""; }
  function setKey(k) { memoryKey = k; safeSetStoredKey(k); }
  function clearKey() { memoryKey = null; safeClearStoredKey(); }

  function showAuthOverlay(errorMsg) {
    document.getElementById("authOverlay").hidden = false;
    var err = document.getElementById("authError");
    err.hidden = !errorMsg;
    document.getElementById("authKeyInput").focus();
  }
  function hideAuthOverlay() {
    document.getElementById("authOverlay").hidden = true;
  }

  document.getElementById("authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("authKeyInput");
    var val = input.value.trim();
    if (!val) return;
    setKey(val);
    hideAuthOverlay();
    load();
  });

  var currentList = "alle";
  var allItems = [];

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ "X-API-Key": getKey(), "Content-Type": "application/json" }, options.headers || {});
    return fetch(path, options).then(function (res) {
      if (res.status === 401) {
        clearKey();
        showAuthOverlay(true);
        throw new Error("unauthorized");
      }
      return res.json();
    });
  }

  function colorForName(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return "hsl(" + (hash % 360) + ", 55%, 42%)";
  }

  function formatDueDate(dueDate) {
    var parts = dueDate.split("-");
    return parts[2] + "." + parts[1] + ".";
  }
  function isOverdue(item) {
    if (!item.dueDate || item.done) return false;
    return item.dueDate < new Date().toISOString().slice(0, 10);
  }

  function populateAssigneeOptions() {
    var select = document.getElementById("newItemAssignee");
    var known = ["Livi", "Fäbu"];
    allItems.forEach(function (i) { if (i.assignee && known.indexOf(i.assignee) === -1) known.push(i.assignee); });
    var current = select.value;
    select.innerHTML = "";
    var noneOpt = document.createElement("option");
    noneOpt.value = ""; noneOpt.textContent = "Niemand";
    select.appendChild(noneOpt);
    known.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      select.appendChild(opt);
    });
    select.value = known.indexOf(current) !== -1 ? current : "";
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

      var body = document.createElement("div");
      body.className = "body";
      var textEl = document.createElement("div");
      textEl.className = "text";
      textEl.textContent = item.text;
      body.appendChild(textEl);

      var meta = document.createElement("div");
      meta.className = "meta";
      if (currentList === "alle") {
        var listTag = document.createElement("span");
        listTag.className = "tag";
        listTag.textContent = item.list;
        meta.appendChild(listTag);
      }
      if (item.assignee) {
        var avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.style.background = colorForName(item.assignee);
        avatar.textContent = item.assignee.charAt(0).toUpperCase();
        var nameTag = document.createElement("span");
        nameTag.className = "tag";
        nameTag.textContent = item.assignee;
        meta.appendChild(avatar);
        meta.appendChild(nameTag);
      }
      if (item.dueDate) {
        var due = document.createElement("span");
        due.className = "tag due" + (isOverdue(item) ? " overdue" : "");
        due.textContent = "📅 " + formatDueDate(item.dueDate);
        meta.appendChild(due);
      }
      if (meta.children.length) body.appendChild(meta);

      var del = document.createElement("button");
      del.className = "del"; del.textContent = "✕"; del.setAttribute("aria-label", "Löschen");
      del.onclick = function () { remove(item.id); };

      li.appendChild(cb); li.appendChild(body); li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function load() {
    if (!getKey()) { showAuthOverlay(false); return; }
    api("/api/todo").then(function (data) {
      allItems = data.items || [];
      populateAssigneeOptions();
      render();
    }).catch(function () { /* handled by showAuthOverlay in api() on 401 */ });
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
    var assignee = document.getElementById("newItemAssignee").value;
    var dueDate = document.getElementById("newItemDue").value;
    api("/api/todo", { method: "POST", body: JSON.stringify({ text: text, list: list, assignee: assignee, dueDate: dueDate }) }).then(function () {
      input.value = "";
      document.getElementById("newItemDue").value = "";
      load();
    });
  });

  load();
})();
</script>
</body>
</html>`;
