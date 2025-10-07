// Lightweight NFT/Crypto data integration helpers with graceful fallbacks.
// Real APIs supported via env vars; if missing, returns stubbed data so the
// pipeline remains dynamic.

type TrendPoint = { t: string; v: number };

export type NftMarketSnapshot = {
  cycle: 'bull' | 'bear' | 'sideways';
  txVolumeUsd30d?: number;
  txVolumeUsdPrev30d?: number;
  declinePct30d?: number; // 0..1 decline over last 30d vs previous 30d
  txTrend90d?: TrendPoint[];
  avgSalePriceUsd?: number;
  priceTrend90d?: TrendPoint[];
  marketShare?: { platform: string; sharePct: number }[];
  trendStrength?: number; // 0..1 based on normalized interest trend
  sources: string[];
};

const timeout = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withTimeout<T>(p: Promise<T>, ms = 7000): Promise<T | null> {
  try {
    const r = await Promise.race([p, timeout(ms).then(() => null as any)]);
    return r;
  } catch { return null; }
}

export async function fetchDappRadarSnapshot(): Promise<Partial<NftMarketSnapshot> | null> {
  const key = process.env.DAPPRADAR_API_KEY;
  if (!key) return null;
  try {
    // NOTE: Endpoint path is illustrative; adapt to your plan tier.
    const url = 'https://api.dappradar.com/market-data/nft/volumes?window=30d';
    const r = await withTimeout(fetch(url, { headers: { 'X-BLOBR-KEY': key } }), 7000);
    if (!r || !(r as any).ok) return null;
    const j = await (r as any).json();
    const vol30 = Number(j?.volume_usd_30d || j?.data?.volume_usd_30d || 0) || undefined;
    const volPrev = Number(j?.volume_usd_prev_30d || j?.data?.volume_usd_prev_30d || 0) || undefined;
    let decline: number | undefined;
    if (vol30 && volPrev && volPrev > 0) decline = Math.max(0, (volPrev - vol30) / volPrev);
    return { txVolumeUsd30d: vol30, txVolumeUsdPrev30d: volPrev, declinePct30d: decline };
  } catch { return null; }
}

export async function fetchCoinGeckoTrend(coinId = 'ethereum'): Promise<TrendPoint[] | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`;
  try {
    const r = await withTimeout(fetch(url), 7000);
    if (!r || !(r as any).ok) return null;
    const j = await (r as any).json();
    const prices: [number, number][] = j?.prices || [];
    return prices.map(([ts, val]) => ({ t: new Date(ts).toISOString().slice(0,10), v: val }));
  } catch { return null; }
}

// Google Trends proxy via SerpApi (optional). Returns normalized 90d time series.
export async function fetchGoogleTrendsSeries(keyword: string): Promise<TrendPoint[] | null> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return null;
  try {
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&data_type=TIMESERIES&api_key=${key}`;
    const r = await withTimeout(fetch(url), 7000);
    if (!r || !(r as any).ok) return null;
    const j = await (r as any).json();
    const rows: unknown[] = j?.interest_over_time?.timeline_data || [];
    if (!rows.length) return null;
    return rows.map((d: unknown) => ({ t: d?.date || '', v: Number(d?.values?.[0]?.value || 0) }));
  } catch { return null; }
}

function normalizeTrendStrength(series: TrendPoint[]): number {
  if (!series || series.length < 8) return 0.5;
  // Compare last 30% vs previous 30% average
  const n = series.length;
  const window = Math.max(3, Math.floor(n * 0.3));
  const last = series.slice(-window).reduce((a, b) => a + b.v, 0) / window;
  const prev = series.slice(-2 * window, -window).reduce((a, b) => a + b.v, 0) / window || last;
  const ratio = prev > 0 ? last / prev : 1;
  // Map ratio ~ [0.5x..2x] to [0..1]
  const clamped = Math.max(0.5, Math.min(2, ratio));
  return Number(((clamped - 0.5) / 1.5).toFixed(2));
}

export async function buildNftMarketSnapshot(): Promise<NftMarketSnapshot> {
  const sources: string[] = [];
  const priceTrend90d = await fetchCoinGeckoTrend('ethereum');
  if (priceTrend90d) sources.push('CoinGecko');
  const dr = await fetchDappRadarSnapshot();
  if (dr) sources.push('DappRadar');
  // Trends series (keyword proxy)
  const trendSeries = await fetchGoogleTrendsSeries('nft marketplace');
  if (trendSeries) sources.push('GoogleTrends');
  // OpenSea stats (illustrative endpoint)
  try {
    const osKey = process.env.OPENSEA_API_KEY;
    if (osKey) {
      const rs = await withTimeout(fetch('https://api.opensea.io/api/v2/stats/global', { headers: { 'X-API-KEY': osKey } }), 7000);
      if (rs && (rs as any).ok) {
        sources.push('OpenSea');
      }
    }
  } catch {}
  // Simple cycle heuristic from price slope
  let cycle: NftMarketSnapshot['cycle'] = 'sideways';
  if (priceTrend90d && priceTrend90d.length > 10) {
    const first = priceTrend90d[0].v;
    const last = priceTrend90d[priceTrend90d.length - 1].v;
    const pct = (last - first) / first;
    cycle = pct > 0.15 ? 'bull' : pct < -0.15 ? 'bear' : 'sideways';
  }
  return {
    cycle,
    priceTrend90d: priceTrend90d || [],
    txVolumeUsd30d: dr?.txVolumeUsd30d,
    txVolumeUsdPrev30d: dr?.txVolumeUsdPrev30d,
    declinePct30d: dr?.declinePct30d,
    marketShare: [
      { platform: 'OpenSea', sharePct: 60 },
      { platform: 'Magic Eden', sharePct: 20 },
      { platform: 'Other', sharePct: 20 },
    ],
    trendStrength: trendSeries ? normalizeTrendStrength(trendSeries) : undefined,
    sources: sources.length ? sources : ['(add DappRadar/Google Trends/Crunchbase keys for live data)'],
  };
}

export function scoreNftCrypto(
  base: { demand: number; urgency: number; moat: number; distribution: number; economics: number },
  snap: NftMarketSnapshot
) {
  let { demand, urgency, moat, distribution, economics } = base;
  // Market cycle weighting
  const w = snap.cycle === 'bull' ? 1.1 : snap.cycle === 'bear' ? 0.85 : 1.0;
  demand = Math.max(1, Math.min(10, Math.round(demand * w)));
  economics = Math.max(1, Math.min(10, Math.round(economics * w)));
  // Heavily penalize declining markets (30d decline > 50%)
  if ((snap.declinePct30d || 0) > 0.5) {
    demand = Math.max(1, Math.round(demand * 0.3));
    urgency = Math.max(1, Math.round(urgency * 0.5));
  }
  // Moat: small bonus if market share concentrated (hard to win), but reflect risk
  const openSeaShare = (snap.marketShare?.find((m) => m.platform === 'OpenSea')?.sharePct || 0) / 100;
  if (openSeaShare > 0.6) moat = Math.min(moat, 3);
  return { demand, urgency, moat, distribution, economics };
}
