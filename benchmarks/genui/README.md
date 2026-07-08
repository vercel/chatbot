# genUI render-cost benchmark

Which generative-UI output style is **fastest** and **prettiest**? This
harness renders the *same* dashboard in each style under headless Chromium,
measures real browser render cost + payload weight, screenshots each, and
assembles a side-by-side gallery so the speed numbers and the looks sit on one
page.

```sh
./benchmarks/genui/run.sh
# → open benchmarks/genui/out/gallery.html
```

## What it measures

For every `samples/<name>/index.html` (self-contained — all CSS/JS inlined, no
network), `measure.mjs`:

- **Payload** — raw + gzip bytes of the document (the weight a genUI artifact
  actually ships).
- **Render cost** — style-recalc + layout + script durations off the DevTools
  Performance domain, plus **first-contentful-paint**, median of 7 cold loads
  in fresh browser contexts.
- **Screenshot** — full page at a fixed 1100×800 viewport, `@2x`.

`build-gallery.mjs` turns `out/metrics.json` + `out/*.png` into
`out/gallery.html` (screenshots embedded as data URIs — self-contained).

## The samples

| Sample | Represents | Stack |
| --- | --- | --- |
| `01-plain-html` | naive "just emit HTML" output (≈ rustra-ui today) | hand-rolled HTML+CSS, no JS |
| `02-v0-shadcn` | **Vercel v0**, rendered statically | shadcn/ui + Tailwind design tokens, SSR'd, no client framework |
| `03-react-genui` | **Thesys C1/Crayon, tambo, AI SDK + AI Elements, assistant-ui** | React runtime inlined, canned spec hydrated client-side |

### Why these three

Research finding: **every** major genUI product renders through open-source
**React** — the closed parts (v0's model, Thesys C1 API, Tambo Cloud) are
*generation* services, irrelevant to render cost. So render cost collapses to
three honest profiles: no framework (baseline), a static CSS design system
(v0's compiled output), and a client-hydrated React runtime (the whole
React-genUI family, which shares the ~45 KB-gz React floor + component CSS).
`03-react-genui` stands in for that family rather than faking several
near-identical React reproductions.

## Honest limitations

- These are **faithful reproductions of each product's documented output
  stack**, not calls to the live services (no API keys, and generation is the
  closed part anyway). Render cost and payload are real; they reflect the
  shipped runtime, not a specific model's generated markup.
- This measures **render/display cost only** — not generation latency or token
  cost, which is usually the dominant real-world cost and needs a live model
  (see the LM Studio adapter / `OpenAiModel`).
- "Prettiest" is deliberately **not scored** — the gallery is the evidence; the
  ranking is yours.

`vendor/` holds the pinned React UMD + htm builds so the React sample is
reproducible offline; `run.sh` re-fetches them if missing. `out/` is generated
and git-ignored.
