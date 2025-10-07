// Statistical helpers to support hypothesis testing and regressions without external deps

export type TTestResult = { t: number; df: number; pApprox: number };

// Two-sample t-test (Welch's approximation). pApprox via survival function of t is approximated.
export function tTestWelch(a: number[], b: number[]): TTestResult {
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  const mA = mean(a), mB = mean(b);
  const varp = (x: number[], m: number) => x.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, x.length - 1);
  const s2a = varp(a, mA), s2b = varp(b, mB);
  const na = a.length, nb = b.length;
  const t = (mA - mB) / Math.sqrt(s2a / na + s2b / nb);
  const df = Math.pow(s2a / na + s2b / nb, 2) / ((s2a * s2a) / (na * na * (na - 1)) + (s2b * s2b) / (nb * nb * (nb - 1)));
  // p-value approximation using normal tail for large df
  const z = Math.abs(t);
  const pApprox = 2 * (1 - normalCdf(z));
  return { t, df, pApprox };
}

// Simple linear regression y = a + b x (least squares)
export type LinRegResult = { a: number; b: number; r2: number };
export function linearRegression(x: number[], y: number[]): LinRegResult {
  const n = Math.min(x.length, y.length);
  const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / Math.max(1, n);
  const my = y.slice(0, n).reduce((s, v) => s + v, 0) / Math.max(1, n);
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx; sxy += dx * dy;
  }
  const b = sxy / Math.max(1e-12, sxx);
  const a = my - b * mx;
  const yhat = x.slice(0, n).map((xi) => a + b * xi);
  const ssTot = y.slice(0, n).reduce((s, yi) => s + (yi - my) * (yi - my), 0);
  const ssRes = y.slice(0, n).reduce((s, yi, i) => s + (yi - yhat[i]) * (yi - yhat[i]), 0);
  const r2 = 1 - ssRes / Math.max(1e-12, ssTot);
  return { a, b, r2 };
}

// Normal CDF approximation (Hart, 1968-inspired polynomial)
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * z);
  const d = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - d * poly;
}
