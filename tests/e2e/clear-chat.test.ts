import { expect, test } from "@playwright/test";

test.describe("Clear chat command", () => {
  test("persists clear by deleting messages for the chat", async ({
    page,
  }) => {
    let deletedChatId: string | null = null;

    await page.route("**/api/messages?**", async (route) => {
      if (route.request().method() === "DELETE") {
        const url = new URL(route.request().url());
        deletedChatId = url.searchParams.get("chatId");
        await route.fulfill({
          body: JSON.stringify({ cleared: true }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await expect(input).toBeVisible();

    await input.fill("/clear");
    await page.getByTestId("send-button").click();

    await expect.poll(() => deletedChatId).not.toBeNull();
    await expect(input).toHaveValue("");
    await expect(page.locator("[data-role='user']")).toHaveCount(0);
    await expect(page.locator("[data-role='assistant']")).toHaveCount(0);
  });
});
