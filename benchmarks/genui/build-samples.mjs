// Assemble the self-contained index.html for samples that need a vendored
// runtime inlined (so the measured payload honestly includes the framework
// weight a client-rendered genUI artifact actually ships). Static samples
// (plain HTML, v0/shadcn) are authored directly and skipped here.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const vendor = (f) => readFileSync(join(HERE, 'vendor', f), 'utf8');
const sample = (d, f) => readFileSync(join(HERE, 'samples', d, f), 'utf8');

// --- 03-react-genui: React + htm inlined, hydrated client-side ---
{
  const dir = '03-react-genui';
  const react = vendor('react.production.min.js');
  const reactDom = vendor('react-dom.production.min.js');
  const htm = vendor('htm.js');
  const css = sample(dir, 'style.css');
  const app = sample(dir, 'app.js');

  const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>React genUI — Revenue overview</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>${htm}</script>
<script>${app}</script>
</body>
</html>
`;
  writeFileSync(join(HERE, 'samples', dir, 'index.html'), out);
  console.log(`built ${dir}/index.html (${(out.length / 1024).toFixed(1)} KB)`);
}
