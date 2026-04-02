import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { registerBackgroundRouter } from '@/lib/messaging/background-router';

export default defineBackground(() => {
  registerBackgroundRouter();
  console.log('Helios background ready', { id: browser.runtime.id });
});
