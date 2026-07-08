// Rustra browser bridge — the client-side executor.
//
// Polls  GET  /api/browser/sessions/{id}/commands  for an IssuedCommand,
// runs the BrowserAction against the active tab, and reports the result to
// POST /api/browser/sessions/{id}/results. Matches crates/rustra-browser's
// wire format: actions are `{type, ...}`, results are `{ok, data, error?}`.

let cfg = null; // { server, token, sessionId }
let polling = false;

async function api(path, opts = {}) {
  const res = await fetch(cfg.server + path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + cfg.token,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error("no active tab");
  return tab;
}

// Run a function inside the active page and return its value.
async function inPage(func, args = []) {
  const tab = await activeTab();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args,
  });
  return result;
}

async function execute(action) {
  switch (action.type) {
    case "navigate": {
      const tab = await activeTab();
      await chrome.tabs.update(tab.id, { url: action.url });
      return { ok: true, data: null };
    }
    case "evaluate": {
      const v = await inPage((e) => {
        try { return String(eval(e)); } catch (err) { return "ERR: " + err.message; }
      }, [action.expression]);
      return { ok: true, data: v };
    }
    case "read_dom": {
      const v = await inPage((sel) => {
        const el = sel ? document.querySelector(sel) : document.body;
        return el ? el.innerText.slice(0, 5000) : null;
      }, [action.selector || null]);
      return { ok: true, data: v };
    }
    case "click": {
      const ok = await inPage((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.click();
        return true;
      }, [action.selector]);
      return ok ? { ok: true, data: null } : { ok: false, error: "no element: " + action.selector };
    }
    case "type": {
      const ok = await inPage((sel, t) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.focus();
        el.value = t;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }, [action.selector, action.text]);
      return ok ? { ok: true, data: null } : { ok: false, error: "no element: " + action.selector };
    }
    case "press": {
      await inPage((k) => {
        const el = document.activeElement || document.body;
        el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true }));
      }, [action.key]);
      return { ok: true, data: null };
    }
    case "scroll": {
      await inPage((dx, dy) => window.scrollBy(dx, dy), [action.dx, action.dy]);
      return { ok: true, data: null };
    }
    case "wait_for": {
      const ok = await inPage(async (sel, timeout) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (document.querySelector(sel)) return true;
          await new Promise((r) => setTimeout(r, 100));
        }
        return false;
      }, [action.selector, action.timeout_ms]);
      return ok ? { ok: true, data: null } : { ok: false, error: "wait_for timed out: " + action.selector };
    }
    case "screenshot": {
      const tab = await activeTab();
      const url = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      return { ok: true, data: url };
    }
    default:
      return { ok: false, error: "unknown action: " + action.type };
  }
}

async function poll() {
  if (!cfg || !cfg.sessionId) { polling = false; return; }
  try {
    const { command } = await api(`/api/browser/sessions/${cfg.sessionId}/commands`);
    if (command) {
      let result;
      try {
        result = await execute(command.action);
      } catch (e) {
        result = { ok: false, error: String(e && e.message ? e.message : e) };
      }
      await api(`/api/browser/sessions/${cfg.sessionId}/results`, {
        method: "POST",
        body: JSON.stringify({ command_id: command.id, result }),
      });
    }
  } catch (_e) {
    // Server not reachable yet / session gone — keep trying.
  }
  setTimeout(poll, 600);
}

function startPolling() {
  if (polling) return;
  polling = true;
  poll();
}

async function connect({ server, token }) {
  cfg = { server: server.replace(/\/+$/, ""), token, sessionId: null };
  const { id } = await api("/api/browser/sessions", { method: "POST" });
  cfg.sessionId = id;
  await chrome.storage.local.set({ cfg });
  startPolling();
  return id;
}

// Resume after a service-worker restart.
chrome.storage.local.get("cfg").then(({ cfg: saved }) => {
  if (saved && saved.sessionId) {
    cfg = saved;
    startPolling();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "connect") {
    connect(msg)
      .then((id) => sendResponse({ ok: true, sessionId: id }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true; // async response
  }
  if (msg.type === "status") {
    sendResponse({
      connected: !!(cfg && cfg.sessionId),
      sessionId: cfg && cfg.sessionId,
      server: cfg && cfg.server,
    });
  }
  if (msg.type === "disconnect") {
    cfg = null;
    polling = false;
    chrome.storage.local.remove("cfg");
    sendResponse({ ok: true });
  }
});
