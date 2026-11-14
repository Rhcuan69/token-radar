# Token Radar — build the best token launch radar

Entry for the make.fun bounty [token-radar-01](https://make.fun/bounty/token-radar-01)
($1,325, entries close 2026-12-14 10:00 UTC). Node 22, standard library only.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`), scores every
pre-token protocol with the radar-2 model in `lib/model.ts`, and writes:

- `board.json` — 198 ranked rows (all 40 watchlist protocols + 158 early ones below the
  $50M floor), each with an implied value and a 7-step farm plan
- `data.js` + `dashboard/` — a static page (no network) with the board, a top-10 chart,
  search / category / chain / TVL / watchlist filters, sorting, a per-protocol detail view,
  a live-token view, and a model sandbox that re-ranks the board live
- `screenshots/` — board, detail view, filtered view (1440×900)
- `dossier.json` — built with the kit's `vendor/makefun-board.ts`

## The model (radar-2)

Implied value follows only from the snapshot's own figures. A category's multiple is the
median market-cap-to-TVL ratio of the live-token protocols in that same category, shrunk
toward the global median where a category has few comparables, clamped to 0.05–2.5x:

```
implied = round( tvl × cat_multiple
               × (1 + clamp(change_7d, -60, 120)/100 × 0.6)
               × (0.55 + min(age_days, 1460)/1460 × 0.45)
               × (1 + 0.02 × min(chains - 1, 5)) )
```

Wrapped, staked and bridged products of tokens that already trade are excluded from the
board (the house's own watchlist rule, applied to the whole board), as are exchanges and
versioned pools. No protocol name is special-cased.

## Run it locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/token-radar-01-kit/input/snapshot.json
```

Then open `out/dashboard/index.html` in a browser. Screenshots are taken with headless
Chromium via Playwright (see `.shot/shots.mjs`); the local gate replica is `.shot/check-gate.mjs`.
