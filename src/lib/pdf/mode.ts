import type { PdfModeResolution } from './types';

// Resolve active PDF mode based on query params + test override flags.
// Priority: fast > slow > real.
export function resolvePdfMode(opts: { searchParams?: URLSearchParams; allowFastOverride?: boolean; allowSlowOverride?: boolean; nodeEnv?: string }): PdfModeResolution {
  const { searchParams, allowFastOverride = false, allowSlowOverride = false, nodeEnv = process.env.NODE_ENV || 'development' } = opts;
  const qp = searchParams || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined);
  const fastParam = qp?.get('pdfTestFast');
  const slowParam = qp?.get('pdfTestSlow');
  const fast = (nodeEnv !== 'production' || allowFastOverride) && fastParam === '1';
  const slow = slowParam === '1' && !fast; // always honor slow when requested unless fast already active
  return { mode: fast ? 'fast' : slow ? 'slow' : 'real', fastFlag: fastParam === '1', slowFlag: slowParam === '1' };
}
