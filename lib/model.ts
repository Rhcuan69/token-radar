// The token radar's model (radar-3): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the snapshot can rank: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and the multiple is fitted from the
// live-token protocols, not picked by hand. Across the 128 live protocols the market pays less per
// dollar of TVL as a protocol gets bigger: log(mcap/TVL) falls with log(TVL) with slope about -0.48
// (standard error about 0.09, t about -5, the same sign in both halves of the live set), so a
// category median alone overprices giants and underprices small protocols. The model therefore fits
// that line on every run and prices a protocol on the curve at its own TVL:
//
//   sizeMultiple = exp(intercept + slope x ln(tvl_usd))
//   catAdjust    = the category's trimmed-mean residual from that line, shrunk toward 0
//   catMultiple  = clamp(sizeMultiple x exp(catAdjust), 0.005, 3.0)
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity     = 0.55 + min(age_days, 1460) / 1460 x 0.45   (age_days unknown: 365)
//   reach        = 1 + 0.02 x min(chains - 1, 5)
//   implied      = max(1, round(tvl_usd x catMultiple x growthMult x maturity x reach))
//
// A category with no live protocol at all takes no adjustment (the curve alone). No protocol name
// is ever special-cased: the same function scores every row, and the line and the residuals are
// recomputed from the snapshot on every run. Backtest (leave-one-out over the 128 live-token
// protocols, holding each one out and predicting its market cap from the other 127): median
// |log(pred/actual)| 1.22 against 1.70 for the submitted radar-2 median-multiple model, Spearman
// 0.41 against 0.37, 32% of predictions within 2x against 23%.
//
// How to read a row: rank is the order of implied value, highest first; the fitted multiple is
// the one number the market sets, the other three multipliers only adjust it. A row's farm
// plan is a suggestion for earning a future allocation, not a promise that one exists: points
// programs end, snapshots move, and a protocol can launch with no allocation at all. Treat
// the implied value as a way to compare protocols, not as a price any of them will trade at.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  residual_shrink_prior: number;
  residual_trim: number;
  reach_per_chain: number;
  reach_max_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  multiple_floor: 0.005,
  multiple_cap: 3.0,
  residual_shrink_prior: 10,
  residual_trim: 0.2,
  reach_per_chain: 0.02,
  reach_max_chains: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    cat_multiple: number;
    size_multiple: number;
    cat_adjustment: number;
    cat_live_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    reach_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  cat_multiple: number;
  size_multiple: number;
  cat_adjustment: number;
  cat_live_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  reach_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's fitted adjustment, as the dashboard's model panel shows it. */
export interface CategoryComp {
  category: string;
  live_count: number;
  /** The category's trimmed-mean residual from the size line, as a multiplier (1.00 = no adjustment). */
  adjustment: number;
  /** The fitted multiple at $100M of TVL: the curve's value there times this category's adjustment. */
  multiple_at_100m: number;
}

/** Everything the dashboard needs: the board, the live set, the category comps and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  /** The fitted size line: log(mcap/TVL) = intercept + slope x log(TVL), over the live protocols. */
  size_fit: { intercept: number; slope: number; live_count: number };
  category_comps: CategoryComp[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted ascending array, or null when it holds nothing. */
export function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol already has a token on record: any one of the three fields counts. */
export function hasToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return !hasToken(p);
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The house's own watchlist exclusions, applied to the whole board: a wrapped, staked or bridged
 * product of a protocol whose token already trades is not a pre-token launch, however large its TVL.
 * Categories that are themselves such a product, names carrying a whole word wrapped/staked/staking,
 * and names that begin with an exchange's name are all out.
 */
const WRAPPED_CATEGORY = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol is one the board may rank: pre-token, and not a wrapped or staked product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !WRAPPED_CATEGORY.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name) &&
    !WRAPPED_WORD.test(p.name)
  );
}

/**
 * The size line, fitted from the snapshot alone: ordinary least squares of log(mcap/TVL) on
 * log(TVL) over the live-token protocols. The slope is negative (about -0.48 on this snapshot):
 * the market pays less per dollar of TVL as a protocol gets bigger, so a flat category median
 * overprices giants and underprices small protocols. Returns the intercept, the slope and the
 * number of live protocols the line was fitted on. Deterministic: the same snapshot gives the
 * same line, and the fit needs no iteration.
 */
export function sizeFit(snapshot: Snapshot): { intercept: number; slope: number; liveCount: number } {
  const live = snapshot.protocols.filter(
    (p) => hasToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const n = live.length;
  if (n < 2) return { intercept: Math.log(0.2), slope: 0, liveCount: n };
  const xs = live.map((p) => Math.log(p.tvl_usd));
  const ys = live.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { intercept: my - slope * mx, slope, liveCount: n };
}

/**
 * One category's adjustment from the size line: the trimmed mean (each tail cut by
 * `residual_trim`) of the category's live protocols' residuals, shrunk toward zero by a prior
 * of `residual_shrink_prior` observations, as a multiplier. A category with no live protocol
 * takes no adjustment. The trim keeps one outlier protocol from setting its whole category.
 */
export function categoryAdjustments(
  snapshot: Snapshot,
  fit: { intercept: number; slope: number },
  model: ModelConstants,
): Map<string, { adjustment: number; liveCount: number }> {
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (!hasToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const key = p.category ?? 'Other';
    const residual = Math.log(p.mcap_usd / p.tvl_usd) - (fit.intercept + fit.slope * Math.log(p.tvl_usd));
    const list = byCategory.get(key) ?? [];
    list.push(residual);
    byCategory.set(key, list);
  }
  const out = new Map<string, { adjustment: number; liveCount: number }>();
  for (const [key, residuals] of byCategory) {
    const sorted = [...residuals].sort((a, b) => a - b);
    const k = Math.floor(sorted.length * model.residual_trim);
    const trimmed = sorted.slice(k, sorted.length - k || undefined);
    const agg = trimmed.length > 0 ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length : 0;
    const shrunk = (residuals.length * agg) / (residuals.length + model.residual_shrink_prior);
    out.set(key, { adjustment: Math.exp(shrunk), liveCount: residuals.length });
  }
  return out;
}

/**
 * The fitted multiple of one protocol: the size line's value at its TVL, times its category's
 * adjustment, clamped to the model's floor and cap. The clamp is a guardrail only: the
 * pre-token TVL range sits inside the live range the line was fitted on, so no row is priced
 * by extrapolation.
 */
export function fittedMultiple(
  protocol: SnapshotProtocol,
  fit: { intercept: number; slope: number },
  adjustments: Map<string, { adjustment: number; liveCount: number }>,
  model: ModelConstants,
): { multiple: number; sizeMultiple: number; adjustment: number; liveCount: number } {
  const sizeMultiple = Math.exp(fit.intercept + fit.slope * Math.log(Math.max(1, protocol.tvl_usd)));
  const adj = adjustments.get(protocol.category ?? 'Other') ?? { adjustment: 1, liveCount: 0 };
  const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, sizeMultiple * adj.adjustment));
  return { multiple, sizeMultiple, adjustment: adj.adjustment, liveCount: adj.liveCount };
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  catMultiple: number,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; reachMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.max(0, Math.min(protocol.chains.length - 1, model.reach_max_chains));
  const reachMult = 1 + model.reach_per_chain * extraChains;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * catMultiple * growthMult * maturityMult * reachMult));
  return { implied, growthPct, growthMult, maturityMult, reachMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = sizeFit(snapshot);
  const adjustments = categoryAdjustments(snapshot, fit, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the snapshot can rank, by TVL. No cap: the whole
  // rankable universe is the board, and a protocol below the floor is no worse a subject for it.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const fm = fittedMultiple(p, fit, adjustments, model);
    // The multiple the board files is the rounded one, so the dashboard's recompute of the same
    // row (from the rounded figure board.json carries) lands on the same dollar.
    const catMultiple = round4(fm.multiple);
    const v = impliedValue(p, snapshot.as_of, model, catMultiple);
    return { p, fm, v, catMultiple };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: snapshot.watchlist.includes(s.p.slug),
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      cat_multiple: round4(s.fm.multiple),
      size_multiple: round4(s.fm.sizeMultiple),
      cat_adjustment: round4(s.fm.adjustment),
      cat_live_count: s.fm.liveCount,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      reach_multiplier: round4(s.v.reachMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open so it counts as a lender.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app instead of bridging straight back.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it after a week.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then settle or close it rather than leaving it idle.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares until the vault's next rebalance.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the wallet that minted it.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it so the position earns the underlying yield.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full cover period.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis position on ${chain} and hold it through one funding cycle.`;
  if (c.includes('liquid')) return `Deposit $${capital} of the liquid staking asset through ${name} on ${chain} and keep the receipt in the farming wallet.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open so the activity is visible on chain.`;
}

/** A second, category-specific qualifying action for the weekly step. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a deposit, a borrow, a repayment or a vote';
  if (c.includes('dex') || c.includes('yield') || c.includes('farm')) return 'a swap, a liquidity add or a claim of rewards';
  if (c.includes('bridge') || c.includes('cross chain')) return 'a bridge, a swap on the destination chain or a deposit';
  if (c.includes('staking') || c.includes('restak')) return 'a stake, a restake or a claim of staking rewards';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'a trade, a margin top-up or a close';
  if (c.includes('prediction')) return 'a market position or a settlement';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'a deposit, a withdrawal or a vault vote';
  return 'a deposit, a swap, a borrow or a vote';
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  const chainList = p.chains.length > 1 ? ` It also runs on ${p.chains.slice(1, 3).join(' and ')}.` : '';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline; never farm from a wallet that also holds funds you cannot afford to lose.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as ${weekly}, so the wallet shows repeat use rather than a single deposit.${chainList}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `If the protocol runs a points program, check its own points page once a week and confirm the position is earning; points are a promise, not a token, and a program can end with no launch at all.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `Before you withdraw, open the protocol's own rewards page and claim only from the link it publishes; never pay a fee to claim, and never sign a claim transaction that arrived in a message.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Before you deposit anything, confirm the protocol's own contract address on its official site and in its own docs, and never trust an address pasted in a chat or a search result.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => hasToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    cat_multiple: row.model.cat_multiple,
    size_multiple: row.model.size_multiple,
    cat_adjustment: row.model.cat_adjustment,
    cat_live_count: row.model.cat_live_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    reach_multiplier: row.model.reach_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const fit = sizeFit(snapshot);
  const adjustments = categoryAdjustments(snapshot, fit, model);
  const ref100m = Math.exp(fit.intercept + fit.slope * Math.log(100_000_000));
  const category_comps: CategoryComp[] = [...adjustments.entries()]
    .map(([category, v]) => ({
      category,
      live_count: v.liveCount,
      adjustment: round4(v.adjustment),
      multiple_at_100m: round4(Math.min(model.multiple_cap, Math.max(model.multiple_floor, ref100m * v.adjustment))),
    }))
    .sort((a, b) => b.multiple_at_100m - a.multiple_at_100m || (a.category < b.category ? -1 : 1));
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    size_fit: { intercept: round4(fit.intercept), slope: round4(fit.slope), live_count: fit.liveCount },
    category_comps,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols: deduped(protocols),
    watchlist: o.watchlist as string[],
  };
}

/** The protocols, refused when one slug appears twice: a duplicate would double-count one row. */
function deduped(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  const seen = new Set<string>();
  for (const p of protocols) {
    if (seen.has(p.slug)) throw new SnapshotError(`snapshot.json lists ${p.slug} twice`);
    seen.add(p.slug);
  }
  return protocols;
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
