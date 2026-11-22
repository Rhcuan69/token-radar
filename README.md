# Token Radar — build the best token launch radar
[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Rhcuan69/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Rhcuan69/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Entry for the make.fun bounty [token-radar-01](https://make.fun/bounty/token-radar-01)
($1,325, entries close 2026-12-14 10:00 UTC). Node 22, standard library only.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`), scores every
pre-token protocol with the radar-3 model in `lib/model.ts`, and writes:

- `board.json` — 198 ranked rows (all 40 watchlist protocols + 158 early ones below the
  $50M floor), each with an implied value and a 7-step farm plan
- `data.js` + `dashboard/` — a static page (no network) with the board, a top-10 chart,
  search / category / chain / TVL / watchlist filters, sorting, a per-protocol detail view,
  a live-token view, and a model sandbox that re-ranks the board live
- `screenshots/` — board, detail view, filtered view (1440×900)
- `dossier.json` — built with the kit's `vendor/makefun-board.ts`

## The model (radar-3)

Implied value follows only from the snapshot's own figures. The multiple is fitted from the
128 live-token protocols, not picked by hand: across them the market pays less per dollar of
TVL as a protocol gets bigger — log(mcap/TVL) falls with log(TVL) with slope about −0.48
(standard error about 0.09, t about −5, the same sign in both halves of the live set) — so a
flat category median overprices giants and underprices small protocols. The model fits that
line on every run, prices each protocol on the curve at its own TVL, then adjusts it by its
category's trimmed-mean residual from the line (shrunk toward zero with a prior of 10):

```
size_multiple = exp(6.96 − 0.48 × ln(tvl_usd))          (fitted on every run)
cat_multiple  = clamp(size_multiple × cat_adjustment, 0.005, 3.0)
implied = round( tvl × cat_multiple
               × (1 + clamp(change_7d, -60, 120)/100 × 0.6)
               × (0.55 + min(age_days, 1460)/1460 × 0.45)
               × (1 + 0.02 × min(chains - 1, 5)) )
```

Backtest: leave-one-out over the 128 live-token protocols, holding each one out and predicting
its market cap from the other 127 — median |log(pred/actual)| 1.22 (radar-2's flat category
median: 1.70), Spearman 0.41 (0.37), 32% of predictions within 2× (23%). The fitted line and
the residuals are recomputed from the snapshot on every run; no protocol name is special-cased.

## How to read the board

Rank is the order of implied value, highest first. The fitted multiple is the one number
the market sets — the size line's value at the protocol's TVL, times its category's
adjustment — and the other three multipliers only adjust it: seven-day growth (clamped to
−60…+120%), maturity (how long the protocol has run with no token, up to four years), and
reach (one extra chain at a time, capped at five). A row's detail view shows every input
that produced its number, and recomputes the row live so the page and `board.json` can be
checked against each other. Wrapped, staked and bridged products of tokens that already
trade are excluded from the board (the house's own watchlist rule, applied to the whole
board), as are exchanges and versioned pools.

## The farm plan

Every row carries a 7-step farm plan (3–12 steps is the gate's range; this entry uses 8).
The plan is derived from the protocol's own record — category, chains, TVL and age — never
from a hand-written list of names, so the same inputs always give the same steps. Capital
scales with TVL ($50–$250) and the hold scales with age (30–60 days). Costs in the plan are
gas only: the capital stays at risk in the position, and a points program is a promise, not
a token. Before depositing, confirm the protocol's own contract address on its official site
and in its own docs — never trust an address pasted in a chat or a search result.

## Reproducibility and limits

The run is deterministic: `main.ts` builds the board twice and refuses to write anything
unless the two runs agree byte for byte, and the grader's double run must produce identical
`/output`. The snapshot is sealed — the model only ever reads its own figures, and a
duplicate slug in it is refused rather than double-counted. What the model cannot know:
whether a protocol will ever launch a token, whether its points program will pay, or what
its token would trade at. 

## Run it locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/token-radar-01-kit/input/snapshot.json
```

Then open `out/dashboard/index.html` in a browser. Screenshots are taken with headless
Chromium via Playwright (see `.shot/shots.mjs`); the local gate replica is `.shot/check-gate.mjs`.
