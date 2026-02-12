import { generateDummyPassword } from './db/utils';

// Use NEXT_PUBLIC_ prefix so these work in both server and client components
const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT;
export const isProductionEnvironment = environment === 'prod';
export const isDevelopmentEnvironment = environment === 'dev';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

export const DUMMY_PASSWORD = generateDummyPassword();
