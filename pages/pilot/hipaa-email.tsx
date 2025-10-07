import { useState } from 'react';

export default function HipaaEmailPilotPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [pain, setPain] = useState('');
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [budget, setBudget] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utm_source = urlParams.get('utm_source') || undefined;
      const utm_medium = urlParams.get('utm_medium') || undefined;
      const utm_campaign = urlParams.get('utm_campaign') || undefined;

      const res = await fetch('/api/pilot-interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          name: role,
          idea: pain,
          vertical: 'healthcare',
          use_case: 'hipaa_email_dispatch',
          source: 'pilot:hipaa-email',
          paid_pilot: paid,
          budget_range: budget || undefined,
          utm_source,
          utm_medium,
          utm_campaign,
          referrer: document.referrer || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Submission failed');
      setMsg('Thanks! We’ll reach out to schedule a 15–20 min call.');
      setEmail('');
      setRole('');
  setPain('');
  setPaid(false);
  setBudget('');
    } catch (e: any) {
      setErr(e.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">HIPAA‑Compliant Email Dispatch Pilot</h1>
        <p className="mt-4 text-lg text-gray-700">
          Reduce PHI exposure risk in patient communications. We bundle software with hands‑on onboarding and
          quarterly compliance audits so you can ship safely and confidently.
        </p>

        <ul className="mt-6 list-disc pl-6 space-y-2 text-gray-800">
          <li>Discovery of PHI touchpoints and risky copy patterns</li>
          <li>Secure template recommendations and tokenization patterns</li>
          <li>Policy preflight with red flags and shipability score</li>
          <li>Quarterly compliance drift scan and incident playbook</li>
        </ul>

        <div className="mt-10 rounded-lg border p-6 shadow-sm">
          <h2 className="text-2xl font-medium">Request a 15–20 min interview</h2>
          <p className="mt-2 text-gray-700">Tell us the single biggest pain you’d pay to remove.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium">Work email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@clinic.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Role / Clinic</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ops Manager @ Sunshine Dental"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">What’s the single most painful workflow?</label>
              <textarea
                value={pain}
                onChange={(e) => setPain(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Appointment reminders include identifiers; reconciling emails with EHR is manual; etc."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                <span className="text-sm">Open to a paid pilot</span>
              </label>
              <div>
                <label className="block text-sm font-medium">Budget range (optional)</label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="$1k–$5k, $5k–$10k, …"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Submitting…' : 'Request interview'}
            </button>
            {msg && <p className="text-green-700">{msg}</p>}
            {err && <p className="text-red-700">{err}</p>}
          </form>
        </div>

        <p className="mt-8 text-sm text-gray-600">
          Looking to join a paid pilot? Mention it in the form — we’re offering limited slots with priority setup.
        </p>
      </section>
    </main>
  );
}
