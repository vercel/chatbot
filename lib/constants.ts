import { generateDummyPassword } from './db/utils';

export const isProductionEnvironment = process.env.ENVIRONMENT === 'prod';
export const isDevelopmentEnvironment = process.env.ENVIRONMENT === 'dev';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

export const DUMMY_PASSWORD = generateDummyPassword();
