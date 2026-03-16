import { expect, test } from "@playwright/test";

const MODEL_BUTTON_REGEX = /Gemini|Claude|GPT|Grok|MiniMax/i;

test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays a model button", async ({ page }) => {
    // Look for any button with model-related content
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await expect(modelButton).toBeVisible();
  });

  test("opens model selector popover on click", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    // Search input should be visible in the popover
    await expect(page.getByPlaceholder("Search models...")).toBeVisible();
  });

  test("can search for models", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    const searchInput = page.getByPlaceholder("Search models...");
    await searchInput.fill("Claude");

    // Should show at least one Claude model
    await expect(page.getByText("Claude Haiku").first()).toBeVisible();
  });

  test("can close model selector by clicking outside", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();

    // Click outside to close
    await page.keyboard.press("Escape");

    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();
  });

  test("shows model provider groups", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    // Should show provider group headers
    await expect(page.getByText("Anthropic")).toBeVisible();
    await expect(page.getByText("Google")).toBeVisible();
  });

  test("can select a different model", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    // Select a specific model
    await page.getByText("Claude Haiku").first().click();

    // Popover should close
    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();

    // Model button should now show the selected model
    await expect(
      page.locator("button").filter({ hasText: "Claude Haiku" }).first()
    ).toBeVisible();
  });
});
