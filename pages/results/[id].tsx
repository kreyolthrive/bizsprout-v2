import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { GetServerSideProps, GetServerSidePropsContext, InferGetServerSidePropsType } from 'next';

import { getKV } from '@/lib/redis';
import { getSupabaseAdmin } from '@/lib/db';

type ScoreMap = Record<string, number>;
interface Adjustment { dimension: string; kind: string; reason?: string }
interface ResultData {
  scores?: ScoreMap;
  highlights?: string[];
  risks?: string[];
  guidance?: string[];
  adjustments?: Adjustment[];
  flags?: string[];
  status?: 'GO' | 'REVIEW' | 'NO-GO' | string;
  value_prop?: string;
  title?: string;
  target_market?: string;
  businessModel?: {
    primaryType?: string;
    confidence?: number; // 0-1 confidence score
  };
}
type ApiResult = Partial<ResultData> & { result_data?: ResultData | string };

type ServerProps = {
  initial?: ApiResult | null;
};

export default function ResultsDetailPage(
  props: InferGetServerSidePropsType<typeof getServerSideProps>
) {
  const router = useRouter();
  const { id } = router.query;
  const [result, setResult] = useState<ApiResult | null>(props.initial || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute share URL early to keep hooks order stable
  const shareUrl = useMemo(() => {
    try {
      const idStr = String(Array.isArray(id) ? id[0] : id || '');
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      return idStr ? `${base}/results/${encodeURIComponent(idStr)}` : '';
    } catch {
      return '';
    }
  }, [id]);

  useEffect(() => {
    const idStr = Array.isArray(id) ? id[0] : id;
    // If we already have server-provided initial data for this id, skip client re-fetch
    if (!idStr) return;
    if (props.initial && typeof (props.initial as { id?: unknown }).id === 'string' && (props.initial as { id?: string }).id === idStr) {
      setLoading(false);
      setError(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/results/${encodeURIComponent(String(idStr))}`);
        if (!res.ok) throw new Error('Failed to fetch validation result');
        const json = await res.json();
        // If DB returns stringified JSON under result_data, parse it
        if (json && typeof json.result_data === 'string') {
          try {
            json.result_data = JSON.parse(json.result_data);
          } catch {
            // ignore parse errors; fall back to raw
          }
        }
        setResult(json as ApiResult);
        setError(null);
      } catch {
        setError('Could not load validation results');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, props.initial]);

  const handleDownloadPDF = () => {
    try {
      window.print();
    } catch {}
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 py-10 px-4">
        <div className="max-w-3xl mx-auto text-center p-10">
          <p className="text-slate-700">Loading full report...</p>
        </div>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="min-h-screen bg-slate-100 py-10 px-4">
        <div className="max-w-3xl mx-auto text-center p-10">
          <p className="text-red-600 mb-5">{error || 'Report not found'}</p>
          <Link href="/" className="text-emerald-600 underline">
            Go Back Home
          </Link>
        </div>
      </main>
    );
  }

  // Extract richer payload regardless of KV or DB source
  const data: ResultData =
    (result?.result_data && typeof result.result_data === 'object')
      ? (result.result_data as ResultData)
      : (result as ResultData) || {};
  const scores: ScoreMap = data.scores || (result?.scores as ScoreMap) || {};
  const highlights: string[] = data.highlights || result?.highlights || [];
  const risks: string[] = data.risks || result?.risks || [];
  const guidance: string[] = data.guidance || result?.guidance || [];
  const adjustments: Adjustment[] = data.adjustments || result?.adjustments || [];
  const flags: string[] = data.flags || result?.flags || [];

  const statusClass =
    data.status === 'GO'
      ? 'text-emerald-600'
      : data.status === 'REVIEW'
      ? 'text-amber-500'
      : 'text-red-600';

  const handleCopyLink = async () => {
    try {
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard');
    } catch {}
  };

  return (
    <>
      <main className="min-h-screen bg-slate-100 py-10 px-4">
        <div className="max-w-5xl mx-auto">
        <Link href="/" className="text-emerald-600 underline inline-block mb-5">
          ← Back to Home
        </Link>

        {/* Header Card */}
        <section className="bg-white border border-slate-200 rounded-lg p-10 mb-5">
          <h1 className="text-4xl font-bold text-emerald-600 mb-2">Validation Results</h1>
          <p className="text-sm text-slate-500 mb-8">Report ID: {String(Array.isArray(id) ? id[0] : id)}</p>

          <div className="flex items-center gap-6 mb-8">
            <div className="text-6xl font-bold text-black">{Number(scores?.overall ?? 0)}%</div>
            <div>
              <div className={`text-2xl font-bold ${statusClass}`}>{data.status || 'NO-GO'}</div>
              <div className="text-base text-slate-600">
                {data.value_prop || 'Business validation complete'}
              </div>
            </div>
          </div>

          {/* Share/Copy actions */}
          <div className="flex flex-wrap gap-3 mb-2">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-white text-emerald-600 font-medium rounded border border-emerald-600 hover:bg-emerald-50"
            >
              Copy Share Link
            </button>
          </div>

          {data.title && (
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-black mb-2">Business Idea</h3>
              <p className="text-base text-slate-700">{data.title}</p>
            </div>
          )}

          {data.target_market && (
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-black mb-2">Target Market</h3>
              <p className="text-base text-slate-700">{data.target_market}</p>
            </div>
          )}
          {/* Business Model Classification */}
          {data.businessModel && (
            <section className="bg-white border border-slate-200 rounded-lg p-10 mb-5">
              <h2 className="text-2xl font-bold text-black mb-4">Business Model</h2>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">
                      Type: {data.businessModel.primaryType?.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-blue-700 text-sm">
                      Confidence: {Math.round((data.businessModel.confidence || 0) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </section>

        {/* Detailed Scores Grid */}
        <section className="bg-white border border-slate-200 rounded-lg p-10 mb-5">
          <h2 className="text-2xl font-bold text-black mb-6">Detailed Score Breakdown</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(scores)
              .filter(([k]) => k !== 'overall')
              .map(([k, v]) => (
                <div key={k} className="p-5 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-semibold text-black capitalize">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xl font-bold text-emerald-600">{Number(v)}/100</span>
                  </div>
                  <progress
                    value={Number(v)}
                    max={100}
                    className="w-full h-2 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-emerald-600 rounded"
                  ></progress>
                </div>
              ))}
          </div>
        </section>

        {/* Strategic Recommendations */}
        {guidance.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-lg p-10 mb-5">
            <h2 className="text-2xl font-bold text-black mb-5">Strategic Recommendations</h2>
            <ul className="space-y-4">
              {guidance.map((g, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-4 bg-emerald-50 rounded-md border-l-4 border-emerald-600"
                >
                  <span className="text-emerald-600 font-bold text-lg leading-none pt-0.5">{i + 1}</span>
                  <span className="text-base text-slate-800 leading-relaxed">{g}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Highlights & Risks */}
        {(highlights.length > 0 || risks.length > 0) && (
          <section className="grid gap-5 md:grid-cols-2 mb-5">
            {highlights.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-8">
                <h3 className="text-xl font-bold text-emerald-600 mb-4">✓ Highlights</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {highlights.map((h, i) => (
                    <li key={i} className="text-slate-700">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {risks.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-8">
                <h3 className="text-xl font-bold text-red-600 mb-4">⚠ Risks & Challenges</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {risks.map((r, i) => (
                    <li key={i} className="text-slate-700">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Adjustments & Flags */}
        {(adjustments.length > 0 || flags.length > 0) && (
          <section className="bg-white border border-slate-200 rounded-lg p-8 mb-5">
            {adjustments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-black mb-3">Score Adjustments</h3>
                <div className="space-y-3">
                  {adjustments.map((adj, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded">
                      <div className="font-semibold text-slate-800 mb-1">
                        {adj.dimension} • {adj.kind}
                      </div>
                      {adj.reason && <div className="text-sm text-slate-500">{adj.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {flags.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-black mb-3">Market Flags</h3>
                <div className="flex flex-wrap gap-2">
                  {flags.map((f, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-amber-100 text-amber-900 rounded text-sm font-medium"
                    >
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Actions */}
        <section className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-black mb-4">Ready for the next step?</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-emerald-600 text-white font-semibold rounded hover:bg-emerald-700"
            >
              Validate Another Idea
            </Link>
            <button
              onClick={handleDownloadPDF}
              className="px-6 py-3 bg-white text-emerald-600 font-semibold rounded border-2 border-emerald-600 hover:bg-emerald-50"
            >
              Download PDF
            </button>
          </div>
        </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ServerProps> = async (
  ctx: GetServerSidePropsContext
) => {
  const { id } = ctx.query || {};
  const idStr = Array.isArray(id) ? id[0] : id;
  if (!idStr || typeof idStr !== 'string') {
    return { notFound: true };
  }

  // Recursively remove undefined (Next.js cannot serialize undefined) and any functions/symbols
  function deepSanitize<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      // Filter out explicit undefined entries for arrays but keep length semantics minimal by mapping
      return value.map(v => deepSanitize(v)).filter(v => v !== undefined) as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
      out[k] = deepSanitize(v);
    }
    return out as T;
  }
  try {
    // Try KV cache first
    try {
      const kv = getKV();
      const cached = await kv.get<Record<string, unknown>>(`validation:result:${idStr}`);
      if (cached) {
        return { props: { initial: deepSanitize(cached) as ApiResult } };
      }
    } catch {}

    // Fallback to DB if available
    try {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('validation_results')
          .select('*')
          .eq('id', idStr)
          .limit(1)
          .maybeSingle();
        if (error) {
          // Silently fall through to notFound on DB error
        } else if (data) {
          // Parse result_data if stringified
          type DbRow = Record<string, unknown> & { result_data?: unknown };
          const row: DbRow = data as unknown as DbRow;
          if (row && typeof row.result_data === 'string') {
            try { row.result_data = JSON.parse(row.result_data as string); } catch {}
          }
          return { props: { initial: deepSanitize(row) as unknown as ApiResult } };
        }
      }
    } catch {}

    return { notFound: true };
  } catch {
    return { notFound: true };
  }
};
