import { generateId } from "ai";
import { getUnixTime } from "date-fns";

export function generateRandomTestUser() {
  const timestamp = getUnixTime(new Date());
  return {
    email: `test-${timestamp}@playwright.com`,
    password: generateId(),
  };
}

export const generateTestMessage = () => `Test message ${Date.now()}`;
