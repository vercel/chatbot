import { test as baseTest, expect as baseExpect } from "@playwright/test";
import { ChatPage } from "./pages/chat";

type Fixtures = {
  chatPage: ChatPage;
};

export const test = baseTest.extend<Fixtures>({
  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },
});

export const expect = baseExpect;
