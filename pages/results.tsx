"use client";

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import styles from '../styles/results.module.css';

interface Scores100 {
  overall: number;
  problem: number;
  underserved: number;
  feasibility: number;
  differentiation: number;
  demand_signals: number;
  wtp: number;
  market_quality: number;
  gtm: number;
  execution: number;
  risk: number;
}

interface ValidationResultView {
  status: 'GO' | 'REVIEW' | 'NO-GO';
  scores: Scores100;
  title?: string;
  target_market?: string;
  value_prop?: string;
  guidance?: string[];
}

function pct(x: unknown, fallback = 0): number {
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return fallback;
  // Normalize 0–10 scale to 0–100 if needed
  return n <= 10 ? Math.round(n * 10) : Math.round(n);
}

export default function ResultsPage() {
  const router = useRouter();
  const [view, setView] = useState<ValidationResultView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  function tryFromSession(): unknown | null {
      try {
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem('validationResult') : null;
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }

    function tryFromQuery() {
      try {
        if (!router.isReady) return null;
        const q = router.query || {};
        const scoreStr = typeof q.score === 'string' ? q.score : Array.isArray(q.score) ? q.score[0] : undefined;
        const businessModel = typeof q.businessModel === 'string' ? q.businessModel : Array.isArray(q.businessModel) ? q.businessModel[0] : undefined;
        if (!scoreStr && !businessModel) return null;
        const overall = pct(scoreStr || 0);
        const status: ValidationResultView['status'] = overall >= 65 ? 'GO' : overall >= 40 ? 'REVIEW' : 'NO-GO';
        return {
          status,
          scores: {
            overall,
            problem: 35,
            underserved: 15,
            feasibility: 70,
            differentiation: 46,
            demand_signals: 9,
            wtp: 42,
            market_quality: 50,
            gtm: 50,
            execution: 66,
            risk: Math.max(0, 100 - overall),
          },
          title: 'Business Idea',
          target_market: businessModel || 'General Market',
        } as ValidationResultView;
      } catch {
        return null;
      }
    }

    function mapApiToView(api: unknown): ValidationResultView | null {
      if (!api || typeof api !== 'object') return null;
      const o = api as { [k: string]: unknown };
      const status = typeof o.status === 'string' ? o.status : '';
      const businessModel = (
        typeof o.business_model === 'object' && o.business_model !== null &&
        typeof (o.business_model as { inferred_model?: unknown }).inferred_model === 'string'
      ) ? (o.business_model as { inferred_model?: string }).inferred_model
        : (
          typeof o.business_dna === 'object' && o.business_dna !== null &&
          typeof (o.business_dna as { businessModel?: unknown }).businessModel === 'string'
        ) ? (o.business_dna as { businessModel?: string }).businessModel
          : 'General';
      // prefer explicit overall, fallback to adaptive math
  const s = (typeof o.scores === 'object' && o.scores !== null) ? (o.scores as Record<string, unknown>) : {};
  const adaptive = (typeof o.adaptive_math === 'object' && o.adaptive_math !== null) ? (o.adaptive_math as Record<string, unknown>) : undefined;
  const inputs10 = (adaptive && typeof adaptive.inputs10 === 'object' && adaptive.inputs10 !== null) ? (adaptive.inputs10 as Record<string, unknown>) : {};
  const overallCandidate = (s.overall as unknown) ?? (adaptive?.overall_post_caps as unknown) ?? (adaptive?.overall_pre_caps as unknown);
      const scores: Scores100 = {
        overall: pct(overallCandidate, 0),
        problem: pct(s.problem ?? inputs10.problem ?? 0),
        underserved: pct(s.underserved ?? inputs10.underserved ?? 0),
        feasibility: pct(s.economics ?? inputs10.economics ?? 0),
        differentiation: pct(s.differentiation ?? inputs10.differentiation ?? 0),
        demand_signals: pct(s.demand_signals ?? inputs10.demand ?? 0),
        wtp: pct(s.wtp ?? s.willingness_to_pay ?? inputs10.economics ?? 0),
        market_quality: pct(s.market_quality ?? 50),
        gtm: pct(s.gtm ?? inputs10.gtm ?? 0),
        execution: pct(s.execution ?? 66),
        risk: pct(100 - (typeof overallCandidate === 'number' ? overallCandidate : 0)),
      };
      const computedStatus: ValidationResultView['status'] = scores.overall >= 65 ? 'GO' : scores.overall >= 40 ? 'REVIEW' : 'NO-GO';
      const guidance: string[] = Array.isArray((o as { guidance?: unknown }).guidance)
        ? ((o as { guidance?: string[] }).guidance as string[])
        : (
          typeof (o as { summary_improved?: unknown }).summary_improved === 'object' && (o as { summary_improved?: { next_steps?: unknown } }).summary_improved !== null &&
          Array.isArray((o as { summary_improved?: { next_steps?: unknown } }).summary_improved?.next_steps)
        )
          ? ((o as { summary_improved?: { next_steps?: string[] } }).summary_improved!.next_steps as string[])
          : [];
      return {
        status: (status === 'GO' || status === 'REVIEW' || status === 'NO-GO') ? status : computedStatus,
        scores,
        title: typeof o.title === 'string' ? o.title : 'Business Idea',
        target_market: businessModel,
        value_prop: typeof o.value_prop === 'string' ? o.value_prop : undefined,
        guidance,
      };
    }

    const session = tryFromSession();
    const mapped = session ? mapApiToView(session) : null;
    if (mapped) {
      setView(mapped);
      setLoading(false);
      return;
    }
    const fromQuery = tryFromQuery();
    if (fromQuery) {
      setView(fromQuery);
      setLoading(false);
      return;
    }
    setView(null);
    setLoading(false);
  }, [router]);

  const getStatusColor = useMemo(() => (status: string) => {
    if (status === 'GO') return 'text-green-600';
    if (status === 'REVIEW') return 'text-yellow-600';
    return 'text-red-600';
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Results Found</h1>
          <p className="text-gray-600 mb-6">We couldn&rsquo;t find validation results.</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 py-12 px-4 ${styles.resultsRoot}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <Link href="/" className="text-green-600 hover:text-green-700 mb-4 inline-block">
            ← Back to Home
          </Link>

          <h1 className={`text-4xl font-bold text-green-600 mb-2 ${styles.resultsHeading}`}>Validation Results</h1>

          {/* Overall Score */}
          <div className="flex items-center gap-4 mb-4">
            <div className="text-6xl font-bold text-gray-900">
              {view.scores.overall}%
            </div>
            <div>
              <div className={`text-2xl font-bold ${getStatusColor(view.status)}`}>
                {view.status}
              </div>
              <div className="text-gray-600">
                {view.status === 'GO' && 'Strong potential - proceed with confidence'}
                {view.status === 'REVIEW' && 'Moderate potential - build more evidence'}
                {view.status === 'NO-GO' && 'Significant challenges - consider pivots'}
              </div>
            </div>
          </div>
        </div>

        {/* Scores Breakdown */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6">Score Breakdown</h2>

          <div className="space-y-4">
            {Object.entries(view.scores)
              .filter(([key]) => key !== 'overall')
              .map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold">{value as number}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <progress
                      className="w-full h-2 accent-green-600"
                      value={Number(value) || 0}
                      max={100}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Guidance */}
        {Array.isArray(view.guidance) && view.guidance.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Recommendations</h2>
            <ul className="space-y-3">
              {view.guidance.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-600 mr-3">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Validate Another Idea
          </Link>
        </div>
      </div>
    </div>
  );
}
