// Turn out/metrics.json + out/*.png into a single self-contained gallery:
// a sortable metrics table plus a screenshot of every sample side by side, so
// "fastest" (the numbers) and "prettiest" (your eyes) sit on one page.
//
// Run after measure.mjs:  node benchmarks/genui/build-gallery.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');

const metrics = JSON.parse(readFileSync(join(OUT, 'metrics.json'), 'utf8'));
const labels = JSON.parse(readFileSync(join(HERE, 'labels.json'), 'utf8'));

const label = (n) => labels[n]?.title ?? n;
const note = (n) => labels[n]?.note ?? '';
const dataUri = (n) => {
  const p = join(OUT, `${n}.png`);
  if (!existsSync(p)) return '';
  return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
};

const fmtKB = (b) => `${(b / 1024).toFixed(1)} KB`;
const ms = (x) => `${x} ms`;

// Rank helpers: lowest is best for every metric here.
const best = (key) => Math.min(...metrics.map((m) => m[key]));
const isBest = (m, key) => m[key] === best(key);

const rows = [...metrics].sort((a, b) => a.renderMs - b.renderMs);

const byName = Object.fromEntries(metrics.map((m) => [m.name, m]));
const lightest = [...metrics].sort((a, b) => a.gzipBytes - b.gzipBytes)[0];
const heaviest = [...metrics].sort((a, b) => b.gzipBytes - a.gzipBytes)[0];
const weightX = (heaviest.gzipBytes / lightest.gzipBytes).toFixed(0);
const v0 = byName['02-v0-shadcn'];
const react = byName['03-react-genui'];

// Verdict: the whole point of "fastest AND prettiest" is the tradeoff.
const verdict = `
<div class="verdict">
  <h2>The read: <span class="hl">${label('02-v0-shadcn')}</span> is the fastest-<em>and</em>-pretty pick</h2>
  <ul>
    <li><strong>Fastest &amp; still polished →</strong> the static shadcn/Tailwind output (v0) paints in
      <strong>${v0?.fcpMs} ms</strong> at <strong>${(v0?.gzipBytes/1024).toFixed(1)} KB</strong> gzip —
      within noise of raw hand-written HTML, but production-grade looking. No client framework to execute before paint.</li>
    <li><strong>Prettiest, but it pays a tax →</strong> the client-rendered React family
      (Crayon/C1, tambo, AI Elements, assistant-ui) can look the richest (gradient charts, interactive components),
      but ships <strong>~${weightX}×</strong> the bytes (${(react?.gzipBytes/1024).toFixed(0)} KB gzip) and roughly
      doubles first paint and render cost — a framework runtime must parse and hydrate before anything shows.</li>
    <li><strong>Take it when →</strong> reach for static shadcn output for read-only artifacts (dashboards, reports, forms);
      spend the React runtime only when the UI genuinely needs client interactivity or token-streaming.</li>
  </ul>
  <p class="fine">"Prettiest" is your call — the screenshots below are the evidence. Speed numbers are median-of-7 cold renders in headless Chromium; lowest is best.</p>
</div>`;

const cell = (m, key, fmt) =>
  `<td class="num${isBest(m, key) ? ' best' : ''}">${fmt(m[key])}</td>`;

const table = `
<table>
  <thead>
    <tr>
      <th>genUI style</th>
      <th class="num">Payload (raw)</th>
      <th class="num">Payload (gzip)</th>
      <th class="num">DOM nodes</th>
      <th class="num">First paint</th>
      <th class="num">Style+layout+script</th>
    </tr>
  </thead>
  <tbody>
    ${rows
      .map(
        (m) => `<tr>
      <td><strong>${label(m.name)}</strong><div class="muted">${note(m.name)}</div></td>
      ${cell(m, 'rawBytes', fmtKB)}
      ${cell(m, 'gzipBytes', fmtKB)}
      ${cell(m, 'domNodes', (x) => x)}
      ${cell(m, 'fcpMs', ms)}
      ${cell(m, 'renderMs', ms)}
    </tr>`
      )
      .join('')}
  </tbody>
</table>`;

const cards = rows
  .map(
    (m) => `<figure class="card">
    <figcaption>
      <h3>${label(m.name)}</h3>
      <div class="chips">
        <span class="chip">${fmtKB(m.gzipBytes)} gz</span>
        <span class="chip">FCP ${m.fcpMs} ms</span>
        <span class="chip">render ${m.renderMs} ms</span>
      </div>
    </figcaption>
    <div class="shot"><img loading="lazy" alt="${label(m.name)} screenshot" src="${dataUri(m.name)}" /></div>
  </figure>`
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>genUI render-cost gallery</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fafafa; color: #16181d; line-height: 1.5; }
  @media (prefers-color-scheme: dark) { body { background: #0e1013; color: #e7e9ee; } }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .lede { color: #6b7280; margin: 0 0 24px; max-width: 68ch; }
  .verdict { border: 1px solid #e3e5e9; border-left: 3px solid #7c3aed; border-radius: 10px; padding: 18px 22px; margin: 0 0 32px; background: canvas; }
  @media (prefers-color-scheme: dark) { .verdict { border-color: #23262d; border-left-color: #a78bfa; } }
  .verdict h2 { font-size: 17px; margin: 0 0 10px; }
  .verdict .hl { color: #7c3aed; }
  @media (prefers-color-scheme: dark) { .verdict .hl { color: #a78bfa; } }
  .verdict ul { margin: 0; padding-left: 20px; }
  .verdict li { margin: 6px 0; font-size: 14px; }
  .verdict .fine { color: #8a909b; font-size: 12.5px; margin: 12px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 40px; background: canvas; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #e3e5e9; text-align: left; }
  @media (prefers-color-scheme: dark) { th, td { border-bottom-color: #23262d; } }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #8a909b; font-size: 12px; font-weight: 400; }
  .best { color: #157347; font-weight: 700; }
  @media (prefers-color-scheme: dark) { .best { color: #4ade80; } }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
  .card { margin: 0; border: 1px solid #e3e5e9; border-radius: 12px; overflow: hidden; background: canvas; }
  @media (prefers-color-scheme: dark) { .card { border-color: #23262d; } }
  figcaption { padding: 14px 16px; }
  figcaption h3 { margin: 0 0 8px; font-size: 15px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #eef0f3; color: #4b5563; font-variant-numeric: tabular-nums; }
  @media (prefers-color-scheme: dark) { .chip { background: #1b1e24; color: #aeb4bf; } }
  .shot { background: #f4f5f7; border-top: 1px solid #e3e5e9; max-height: 460px; overflow: auto; }
  @media (prefers-color-scheme: dark) { .shot { background: #16181d; border-top-color: #23262d; } }
  .shot img { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>genUI render-cost gallery</h1>
    <p class="lede">One dashboard, rendered in each generative-UI output style, measured cold in headless Chromium (median of 7). Green marks the best value in each column. Lowest is best throughout. Screenshots are for judging the "prettiest" axis by eye.</p>
    ${verdict}
    ${table}
    <div class="grid">
      ${cards}
    </div>
  </div>
</body>
</html>`;

writeFileSync(join(OUT, 'gallery.html'), html);
console.log('wrote', join(OUT, 'gallery.html'));
