#!/usr/bin/env bash
# Run the genUI render-cost benchmark. Playwright is installed globally in this
# environment, so expose the global module path to Node, then build the
# vendored-runtime samples, measure everything, and assemble the gallery.
set -euo pipefail
cd "$(dirname "$0")"

export NODE_PATH="$(npm root -g)"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# The React sample inlines a vendored runtime. If vendor/ is missing (fresh
# checkout that didn't commit it), fetch it — needs network this once.
if [ ! -f vendor/react-dom.production.min.js ]; then
  echo "fetching vendored runtime..."
  mkdir -p vendor
  curl -sSL -o vendor/react.production.min.js https://unpkg.com/react@18/umd/react.production.min.js
  curl -sSL -o vendor/react-dom.production.min.js https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
  curl -sSL -o vendor/htm.js https://unpkg.com/htm@3/dist/htm.js
fi

node build-samples.mjs
node measure.mjs
node build-gallery.mjs
echo "open benchmarks/genui/out/gallery.html"
