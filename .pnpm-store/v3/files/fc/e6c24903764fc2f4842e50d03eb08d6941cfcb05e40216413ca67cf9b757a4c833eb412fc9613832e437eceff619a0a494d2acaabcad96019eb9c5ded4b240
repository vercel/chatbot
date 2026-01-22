// @ts-expect-error typescript doesn't handle ./index.astro properly, but it's needed to generate types
// eslint-disable-next-line import/no-default-export, no-useless-rename -- Exporting everything doesn't yield the desired outcome
export { default as default } from './index.astro';
export type {
  AnalyticsProps,
  BeforeSend,
  BeforeSendEvent,
  // @ts-expect-error this filed is copied to dist, so it's ok to reference the generated index.d.ts
} from '../index.d.ts';
