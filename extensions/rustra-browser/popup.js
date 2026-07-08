const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function show(html, cls) {
  statusEl.innerHTML = html;
  statusEl.className = cls || "";
}

function refresh() {
  chrome.runtime.sendMessage({ type: "status" }, (s) => {
    if (s && s.connected) {
      $("server").value = s.server || $("server").value;
      show(`Connected.<br>session: <b>${s.sessionId}</b>`, "ok");
    } else {
      show("Not connected.");
    }
  });
}

$("connect").addEventListener("click", () => {
  const server = $("server").value.trim();
  const token = $("token").value.trim();
  if (!token) return show("Enter a token.", "err");
  show("Connecting…");
  chrome.runtime.sendMessage({ type: "connect", server, token }, (r) => {
    if (r && r.ok) show(`Connected.<br>session: <b>${r.sessionId}</b>`, "ok");
    else show("Failed: " + (r ? r.error : "no response"), "err");
  });
});

$("disconnect").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "disconnect" }, refresh);
});

refresh();
