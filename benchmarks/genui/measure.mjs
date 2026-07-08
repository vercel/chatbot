// Render-cost benchmark for generative-UI output styles.
//
// For every sample in ./samples/<name>/index.html this:
//   1. weighs the payload (raw + gzip bytes of the self-contained document),
//   2. loads it in headless Chromium and reads real render cost off the
//      DevTools Performance domain (style recalc, layout, script) plus the
//      first-contentful-paint time,
//   3. screenshots it at a fixed viewport.
// Results (median over RUNS) land in ./out/metrics.json and ./out/*.png, and
// build-gallery.mjs turns them into a side-by-side gallery.
//
// Run: node benchmarks/genui/measure.mjs
// (Playwright is installed globally; this script is launched with
//  NODE_PATH=$(npm root -g) by ./run.sh so `import 'playwright'` resolves.)

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Playwright is installed globally in this environment, and ESM `import`
// ignores NODE_PATH — so resolve it by absolute path from the global root.
const require = createRequire(import.meta.url);
const globalRoot = process.env.NODE_PATH || execSync('npm root -g').toString().trim();
const { chromium } = require(join(globalRoot, 'playwright'));

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(HERE, 'samples');
const OUT = join(HERE, 'out');
const RUNS = 7; // odd → clean median
const VIEWPORT = { width: 1100, height: 800 };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
};

// One cold load in a fresh context; returns render cost + paint timing.
async function measureOnce(browser, fileUrl) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  await page.goto(fileUrl, { waitUntil: 'load' });
  // Let fonts settle + a frame paint so FCP is recorded.
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(60);

  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));

  const fcp = await page.evaluate(() => {
    const e = performance.getEntriesByName('first-contentful-paint')[0];
    return e ? e.startTime : null;
  });
  const domNodes = await page.evaluate(() => document.getElementsByTagName('*').length);

  await context.close();
  return {
    // DevTools durations are seconds → ms.
    recalcStyleMs: (m.RecalcStyleDuration ?? 0) * 1000,
    layoutMs: (m.LayoutDuration ?? 0) * 1000,
    scriptMs: (m.ScriptDuration ?? 0) * 1000,
    fcpMs: fcp,
    domNodes,
  };
}

async function screenshot(browser, fileUrl, pngPath) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(120);
  await page.screenshot({ path: pngPath, fullPage: true });
  await context.close();
}

async function main() {
  const names = readdirSync(SAMPLES).filter((n) =>
    existsSync(join(SAMPLES, n, 'index.html'))
  );
  if (!names.length) {
    console.error('no samples found under', SAMPLES);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const results = [];

  for (const name of names) {
    const htmlPath = join(SAMPLES, name, 'index.html');
    const fileUrl = pathToFileURL(htmlPath).href;
    const bytes = statSync(htmlPath).size;
    const gzip = gzipSync(readFileSync(htmlPath)).length;

    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measureOnce(browser, fileUrl));

    const pngPath = join(OUT, `${name}.png`);
    await screenshot(browser, fileUrl, pngPath);

    const row = {
      name,
      rawBytes: bytes,
      gzipBytes: gzip,
      domNodes: runs[0].domNodes,
      fcpMs: round(median(runs.map((r) => r.fcpMs ?? 0))),
      recalcStyleMs: round(median(runs.map((r) => r.recalcStyleMs))),
      layoutMs: round(median(runs.map((r) => r.layoutMs))),
      scriptMs: round(median(runs.map((r) => r.scriptMs))),
    };
    row.renderMs = round(row.recalcStyleMs + row.layoutMs + row.scriptMs);
    results.push(row);
    console.log(
      `${name.padEnd(22)} ${fmtKB(bytes).padStart(8)} raw  ${fmtKB(gzip).padStart(
        8
      )} gz  FCP ${String(row.fcpMs).padStart(5)}ms  render ${String(
        row.renderMs
      ).padStart(5)}ms  (${row.domNodes} nodes)`
    );
  }

  await browser.close();
  writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(results, null, 2));
  console.log(`\nwrote ${join(OUT, 'metrics.json')} and ${results.length} screenshots`);
}

const round = (x) => Math.round(x * 100) / 100;
const fmtKB = (b) => `${(b / 1024).toFixed(1)}KB`;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
