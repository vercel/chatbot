# Agent-Browser Command Reference

Complete reference for all agent-browser commands. Load this when you need details beyond the core workflow.

## Navigation

| Command | Description |
|---------|-------------|
| `open <url>` | Navigate to URL (aliases: goto, navigate). Auto-prepends https:// if no protocol given |
| `back` | Go back in history |
| `forward` | Go forward in history |
| `reload` | Refresh current page |
| `close` | Close browser (aliases: quit, exit) |
| `connect <port>` | Connect to browser via CDP port |

## Snapshot

| Command | Description |
|---------|-------------|
| `snapshot` | Full accessibility tree with labels |
| `snapshot -i` | Interactive elements only (with refs) — recommended |
| `snapshot -i -C` | Include cursor-interactive elements (divs with onclick, cursor:pointer) |
| `snapshot -c` | Compact output |
| `snapshot -d 3` | Limit depth to 3 |
| `snapshot -s "#main"` | Scope to CSS selector |

## Interaction (by ref or CSS selector)

| Command | Description |
|---------|-------------|
| `click <sel>` | Click element |
| `click <sel> --new-tab` | Click and open in new tab |
| `dblclick <sel>` | Double-click element |
| `focus <sel>` | Focus element |
| `fill <sel> "text"` | Clear field and fill (plain text only: name, address, city, email) |
| `type <sel> "text"` | Type into element without clearing (use for masked/formatted fields) |
| `press Enter` | Press key (Tab, Escape, ArrowDown, Control+a) |
| `keyboard type "text"` | Type with real keystrokes at current focus (no selector) |
| `keyboard inserttext "text"` | Insert text without key events (no selector) |
| `keydown <key>` | Hold key down |
| `keyup <key>` | Release key |
| `hover <sel>` | Hover over element |
| `select <sel> "value"` | Select dropdown option (native `<select>` only) |
| `select <sel> "a" "b"` | Select multiple options |
| `check <sel>` | Check checkbox |
| `uncheck <sel>` | Uncheck checkbox |
| `upload <sel> "/path/to/file"` | Upload file |
| `drag <sel1> <sel2>` | Drag from sel1 to sel2 |
| `scrollintoview <sel>` | Scroll element into view (alias: scrollinto) |

Note: `<sel>` can be a ref (`@e1`), CSS selector (`"#firstName"`), or other locator.

## Semantic Locators (alternative to refs)

| Command | Description |
|---------|-------------|
| `find role <role> <action> --name "Name"` | By ARIA role (e.g., `find role button click --name "Submit"`) |
| `find text "Sign In" click` | By text content |
| `find text "Sign In" click --exact` | By exact text match |
| `find label "Email" fill "user@test.com"` | By label |
| `find placeholder "Search" type "query"` | By placeholder |
| `find alt "Logo" click` | By alt text |
| `find title "Close" click` | By title attribute |
| `find testid "submit-btn" click` | By data-testid |
| `find first ".item" click` | First match |
| `find last ".item" click` | Last match |
| `find nth 2 "a" hover` | Nth match |

Actions: `click`, `fill`, `type`, `hover`, `focus`, `check`, `uncheck`, `text`

## Information Retrieval

| Command | Description |
|---------|-------------|
| `get text <sel>` | Get text content |
| `get value <sel>` | Get input field value |
| `get html <sel>` | Get innerHTML |
| `get attr <sel> <attr>` | Get attribute value |
| `get url` | Get current URL |
| `get title` | Get page title |
| `get count <sel>` | Count matching elements |
| `get box <sel>` | Get bounding box |
| `get styles <sel>` | Get computed styles (font, color, bg, etc.) |

## State Checks

| Command | Description |
|---------|-------------|
| `is visible <sel>` | Check visibility |
| `is enabled <sel>` | Check if enabled |
| `is checked <sel>` | Check checkbox state |

## Waiting

| Command | Description |
|---------|-------------|
| `wait <sel>` | Wait for element in DOM |
| `wait 2000` | Wait milliseconds |
| `wait --text "Welcome"` | Wait for text on page |
| `wait --url "**/dashboard"` | Wait for URL pattern |
| `wait --load networkidle` | Wait for network to settle |
| `wait --fn "document.readyState === 'complete'"` | Wait for JS condition |
| `wait --download` | Wait for download |

Load states: `load`, `domcontentloaded`, `networkidle`

## Scrolling

| Command | Description |
|---------|-------------|
| `scroll down 500` | Scroll down pixels (default: down 300px) |
| `scroll up 300` | Scroll up pixels |
| `scroll left 200` | Scroll left |
| `scroll right 200` | Scroll right |
| `scroll down 500 --selector "div.content"` | Scroll within a specific container |
| `scrollintoview <sel>` | Scroll element into view |

## Tabs and Windows

| Command | Description |
|---------|-------------|
| `tab` | List all open tabs |
| `tab new [url]` | Open new tab (optionally with URL) |
| `tab <index>` | Switch to tab by index (e.g., `tab 2`) |
| `tab close` | Close current tab |
| `tab close <index>` | Close tab by index |
| `window new` | Open new window |

## Screenshots and PDF

| Command | Description |
|---------|-------------|
| `screenshot` | Save to temporary directory |
| `screenshot page.png` | Capture viewport to path |
| `screenshot --full page.png` | Capture full page |
| `screenshot --annotate` | Annotated screenshot with numbered element labels |
| `pdf output.pdf` | Save page as PDF |

## Frame Handling

| Command | Description |
|---------|-------------|
| `frame <sel>` | Switch to iframe (e.g., `frame "#iframe"`) |
| `frame main` | Return to main frame |

## Dialogs

| Command | Description |
|---------|-------------|
| `dialog accept [text]` | Accept dialog (optionally with prompt text) |
| `dialog dismiss` | Dismiss dialog |

## Mouse Control

| Command | Description |
|---------|-------------|
| `mouse move <x> <y>` | Move mouse to coordinates |
| `mouse down [button]` | Press mouse button (left/right/middle) |
| `mouse up [button]` | Release mouse button |
| `mouse wheel <dy> [dx]` | Scroll wheel |

## JavaScript Evaluation

| Command | Description |
|---------|-------------|
| `eval "document.title"` | Simple expressions only |
| `eval -b "<base64>"` | Any JavaScript (base64 encoded) — avoids shell escaping issues |
| `eval --stdin` | Read script from stdin |

Use `-b`/`--base64` or `--stdin` for reliable execution with nested quotes or special characters.

## Network

| Command | Description |
|---------|-------------|
| `network route <url>` | Intercept requests |
| `network route <url> --abort` | Block requests |
| `network route <url> --body '{}'` | Mock response |
| `network unroute [url]` | Remove routes |
| `network requests` | View tracked requests |
| `network requests --filter api` | Filter requests |

## Storage & Cookies

| Command | Description |
|---------|-------------|
| `cookies` | List all cookies |
| `cookies set name value` | Set cookie |
| `cookies clear` | Clear all cookies |
| `storage local` | List localStorage |
| `storage local key` | Get localStorage value |
| `storage local set key value` | Set localStorage |
| `storage local clear` | Clear all localStorage |

## Session State

| Command | Description |
|---------|-------------|
| `state save session.json` | Save cookies, storage, auth state |
| `state load session.json` | Load browser state |

## Browser Settings

| Command | Description |
|---------|-------------|
| `set viewport <w> <h> [scale]` | Set viewport size (scale for retina, e.g., 2) |
| `set device "iPhone 14"` | Emulate device (viewport + user agent) |
| `set geo <lat> <lon>` | Set geolocation |
| `set offline on` | Toggle offline mode |
| `set headers '<json>'` | Extra HTTP headers |
| `set credentials <user> <pass>` | HTTP basic auth |
| `set media dark` | Emulate color scheme (dark/light) |
| `set media light reduced-motion` | Light mode + reduced motion |

## Video Recording

| Command | Description |
|---------|-------------|
| `record start ./demo.webm` | Start recording |
| `record stop` | Stop and save video |
| `record restart ./take2.webm` | Stop current + start new |

## Debugging

| Command | Description |
|---------|-------------|
| `--headed open <url>` | Show browser window |
| `console` | View console messages |
| `console --clear` | Clear console |
| `errors` | View page errors |
| `errors --clear` | Clear errors |
| `highlight <sel>` | Highlight element |
| `trace start` | Start recording trace |
| `trace stop trace.zip` | Stop and save trace |

## Diff (Compare Page States)

| Command | Description |
|---------|-------------|
| `diff snapshot` | Compare current vs last snapshot |
| `diff snapshot --baseline before.txt` | Compare current vs saved file |
| `diff screenshot --baseline before.png` | Visual pixel diff |
| `diff url <url1> <url2>` | Compare two pages |

## Global Options

| Option | Description |
|---------|-------------|
| `--session <name>` | Isolated browser session |
| `--json` | JSON output for parsing |
| `--headed` | Show browser window (not headless) |
| `--cdp <port>` | Connect via Chrome DevTools Protocol |
| `-p <provider>` | Cloud browser provider (--provider) |
| `--proxy <url>` | Use proxy server |
| `--ignore-https-errors` | Ignore SSL certificate errors |
