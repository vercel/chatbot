import { createServer, type ServerResponse } from "node:http";
import { expect, test } from "@playwright/test";

test("stop button stays available after the first streamed text", async ({
  page,
}) => {
  let socket: ServerResponse | undefined;
  const server = createServer((req, res) => {
    const origin = req.headers.origin ?? "*";
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    res.setHeader("vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, {
      "cache-control": "no-cache",
      "content-type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    });
    res.flushHeaders();
    socket = res;
    req.resume();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("fixture did not bind");
  }
  const fixtureUrl = `http://127.0.0.1:${address.port}`;

  try {
    await page.addInitScript((url: string) => {
      const orig = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const raw = input instanceof Request ? input.url : String(input);
        const target = new URL(raw, location.href);
        const method =
          init?.method ?? (input instanceof Request ? input.method : "GET");
        if (target.pathname === "/api/chat" && method === "POST") {
          if (input instanceof Request) {
            return orig(new Request(url, input), init);
          }
          return orig(url, init);
        }
        return orig(input, init);
      };
    }, fixtureUrl);

    await page.goto("/");
    await page.getByTestId("multimodal-input").fill("Write two sentences.");
    await page.getByTestId("send-button").click();

    const stopButton = page.getByTestId("stop-button");
    await expect(stopButton).toBeVisible({ timeout: 30_000 });

    const held = await new Promise<ServerResponse>((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (socket) {
          clearInterval(timer);
          resolve(socket);
          return;
        }
        if (Date.now() - started > 5000) {
          clearInterval(timer);
          reject(new Error("fixture did not receive the chat request"));
        }
      }, 50);
    });

    const messageId = "c1832-stop-stream";
    for (const event of [
      { messageId, type: "start" },
      { id: "t", type: "text-start" },
      { delta: "First sentence.", id: "t", type: "text-delta" },
    ]) {
      held.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    await expect(
      page.getByTestId("message-content").filter({ hasText: "First sentence." })
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(250);

    await expect(stopButton).toBeVisible({ timeout: 5000 });
    await expect(stopButton).toBeEnabled();
  } finally {
    socket?.end();
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
