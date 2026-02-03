# Agent-Browser Command Reference

Complete reference for all agent-browser commands. Load this when you need details beyond the core workflow.

## Navigation

| Command | Description |
|---------|-------------|
| `open <url>` | Navigate to URL (aliases: goto, navigate) |
| `back` | Go back in history |
| `forward` | Go forward in history |
| `reload` | Refresh current page |
| `close` | Close browser |

## Snapshot

| Command | Description |
|---------|-------------|
| `snapshot` | Full accessibility tree with refs |
| `snapshot -i` | Interactive elements only (RECOMMENDED for forms) |
| `snapshot -c` | Compact output |
| `snapshot -s "#main"` | Scope to CSS selector |

## Interaction

| Command | Description |
|---------|-------------|
| `click @e1` | Click element by ref |
| `dblclick @e1` | Double-click element |
| `fill @e1 "text"` | Clear field and fill |
| `type @e1 "text"` | Type into element (appends) |
| `press Enter` | Press key (Tab, Escape, ArrowDown, Control+a) |
| `hover @e1` | Hover over element |
| `select @e1 "value"` | Select dropdown option |
| `check @e1` | Check checkbox |
| `uncheck @e1` | Uncheck checkbox |
| `upload @e1 "/path/to/file"` | Upload file |
| `drag @e1 @e2` | Drag from e1 to e2 |

## Information Retrieval

| Command | Description |
|---------|-------------|
| `get text @e1` | Get text content |
| `get value @e1` | Get input field value |
| `get html @e1` | Get innerHTML |
| `get attr @e1 href` | Get attribute value |
| `get url` | Get current URL |
| `get title` | Get page title |
| `get count @e1` | Count matching elements |
| `get box @e1` | Get bounding box |

## State Checks

| Command | Description |
|---------|-------------|
| `is visible @e1` | Check visibility |
| `is enabled @e1` | Check if enabled |
| `is checked @e1` | Check checkbox state |

## Waiting

| Command | Description |
|---------|-------------|
| `wait @e1` | Wait for element in DOM |
| `wait 2000` | Wait milliseconds |
| `wait --text "Welcome"` | Wait for text on page |
| `wait --url "**/dashboard"` | Wait for URL pattern |
| `wait --load networkidle` | Wait for network to settle |
| `wait --fn "document.readyState === 'complete'"` | Wait for JS condition |
| `wait --download` | Wait for download |

## Scrolling

| Command | Description |
|---------|-------------|
| `scroll down 500` | Scroll down pixels |
| `scroll up 300` | Scroll up pixels |
| `scroll left 200` | Scroll left |
| `scroll right 200` | Scroll right |
| `scrollintoview @e1` | Scroll element into view |

## Screenshots

| Command | Description |
|---------|-------------|
| `screenshot page.png` | Capture viewport |
| `screenshot --full page.png` | Capture full page |

## Tab Management

| Command | Description |
|---------|-------------|
| `tab` | List open tabs |
| `tab new https://...` | Open new tab |
| `tab 2` | Switch to tab 2 |
| `tab close` | Close current tab |

## Frame Handling

| Command | Description |
|---------|-------------|
| `frame @e1` | Switch to iframe |
| `frame main` | Return to main frame |

## Storage & Cookies

| Command | Description |
|---------|-------------|
| `cookies` | List all cookies |
| `cookies set name value` | Set cookie |
| `cookies clear` | Clear all cookies |
| `storage local` | List localStorage |
| `storage local key` | Get localStorage value |
| `storage local set key value` | Set localStorage |

## Session State

| Command | Description |
|---------|-------------|
| `state save session.json` | Save browser state |
| `state load session.json` | Load browser state |
