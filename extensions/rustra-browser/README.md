# Rustra Browser Bridge (Chrome extension)

The client-side executor for Rustra's browser computer-use protocol. It polls
a Rustra server for `BrowserAction` commands and runs them in your active tab
(navigate, click, type, read DOM, evaluate JS, screenshot), posting results
back. Backend contract: `crates/rustra-browser` + `crates/rustra-server`
(`/api/browser/sessions...`).

## Run it locally

1. **Start the dev server** (mints a token, drives a demo once you connect):
   ```sh
   cargo run -p rustra-server --example serve
   ```
   Copy the printed `token` and `server` URL.

2. **Load the extension** — Chrome → `chrome://extensions` → enable
   *Developer mode* → *Load unpacked* → select this folder
   (`extensions/rustra-browser/`).

3. **Connect** — click the extension icon, paste the token, confirm the
   server URL, hit **Connect**. The popup shows the session id.

4. **Watch it work** — open any normal `http(s)://` tab. The server's demo
   reads the page title + URL and takes a screenshot; results print in the
   terminal. (Extensions can't run on `chrome://` pages — use a real site.)

## Notes

- The server enqueues commands via `session.perform(action)`; without an LLM
  the `serve` example drives a fixed demo sequence. Wire the `browser_tool`
  into an agent to have a model drive it instead.
- CORS is opened by the example (`ServerConfig::cors_permissive(true)`) so the
  extension origin can reach the API.
- MV3 service workers idle-sleep; the poll loop self-reschedules and resumes
  from `chrome.storage` on wake.
