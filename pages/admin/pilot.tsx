import { useEffect, useState } from 'react';

type MetricData = {
  count: number;
  recent: Array<{
    email: string;
    name?: string | null;
    source?: string | null;
    vertical?: string | null;
    use_case?: string | null;
    paid_pilot?: boolean;
    budget_range?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    ts: number;
  }>;
};

export default function PilotAdmin() {
  const [data, setData] = useState<Record<string, MetricData> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const saved = localStorage.getItem('adminToken') || '';
        let token = saved;
        if (!token) {
          token = window.prompt('Admin token for metrics?') || '';
          if (token) localStorage.setItem('adminToken', token);
        }
        const res = await fetch(`/api/pilot-metrics?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        setData(json.data);
      } catch (e: any) {
        setErr(e.message || 'Error');
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Pilot Metrics</h1>
        {err && <p className="text-red-700 mt-4">{err}</p>}
        {!data && !err && <p className="mt-4">Loading…</p>}
        {data && (
          <div className="mt-6 space-y-8">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="rounded border p-4">
                <h2 className="text-xl font-medium">{k}</h2>
                <p className="text-gray-700">Total: {v.count}</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="pr-4 py-1">When</th>
                        <th className="pr-4 py-1">Email</th>
                        <th className="pr-4 py-1">Name</th>
                        <th className="pr-4 py-1">Source</th>
                        <th className="pr-4 py-1">Vertical</th>
                        <th className="pr-4 py-1">Use Case</th>
                        <th className="pr-4 py-1">Paid?</th>
                        <th className="pr-4 py-1">Budget</th>
                        <th className="pr-4 py-1">UTMs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.recent.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="pr-4 py-1">{new Date(r.ts).toLocaleString()}</td>
                          <td className="pr-4 py-1">{r.email}</td>
                          <td className="pr-4 py-1">{r.name || '—'}</td>
                          <td className="pr-4 py-1">{r.source || '—'}</td>
                          <td className="pr-4 py-1">{r.vertical || '—'}</td>
                          <td className="pr-4 py-1">{r.use_case || '—'}</td>
                          <td className="pr-4 py-1">{r.paid_pilot ? 'Yes' : 'No'}</td>
                          <td className="pr-4 py-1">{r.budget_range || '—'}</td>
                          <td className="pr-4 py-1">{[r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(' / ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
