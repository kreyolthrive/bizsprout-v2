import React, { useMemo, useState } from 'react';

type RoiMode = 'validated' | 'pilot' | 'hypothetical';
type RoiVariant = 'saas' | 'marketplace' | 'product' | string;

export type RoiCalculatorProps = {
  mode?: RoiMode;
  variant?: RoiVariant;
  disclaimer?: string;
  disabledExport?: boolean;
  blocked?: boolean;
  blockedNote?: string;
  recommendedAcquisitionCost?: number;
  // Marketplace/product exploration presets
  presetMonthlyProjects?: number;
  presetTakeRatePct?: number;
  presetOpsCostPerProject?: number;
  presetRetentionMonths?: number;
  presetAvgProjectValue?: number;
  presetsNote?: string;
};

export default function RoiCalculator(props: RoiCalculatorProps = {}) {
  // SaaS/time-savings fields (legacy/default)
  const [mrr, setMrr] = useState<string>('500'); // $ / team / month
  const [teams, setTeams] = useState<string>('1');
  const [hoursSaved, setHoursSaved] = useState<string>('8'); // per team / month
  const [hourlyRate, setHourlyRate] = useState<string>('60'); // $
  const [pilotFee, setPilotFee] = useState<string>('2000');
  const [retentionMonths, setRetentionMonths] = useState<string>(String(props.presetRetentionMonths ?? 12));

  // Marketplace fields
  const [avgProjectValue, setAvgProjectValue] = useState<string>(String(props.presetAvgProjectValue ?? 1000));
  const [monthlyProjects, setMonthlyProjects] = useState<string>(String(props.presetMonthlyProjects ?? 5));
  const [takeRatePct, setTakeRatePct] = useState<string>(String(props.presetTakeRatePct ?? 15));
  const [opsCostPerProject, setOpsCostPerProject] = useState<string>(String(props.presetOpsCostPerProject ?? 100));
  const [buyerCAC, setBuyerCAC] = useState<string>(props.recommendedAcquisitionCost != null ? String(props.recommendedAcquisitionCost) : '0');
  const [sellerCAC, setSellerCAC] = useState<string>(props.recommendedAcquisitionCost != null ? String(props.recommendedAcquisitionCost) : '0');
  const [buyersAcquiredPerMonth, setBuyersAcquiredPerMonth] = useState<string>('0');
  const [sellersAcquiredPerMonth, setSellersAcquiredPerMonth] = useState<string>('0');

  const parsed = useMemo(() => {
    const p = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const _mrr = Math.max(0, p(mrr));
    const _teams = Math.max(0, Math.floor(p(teams)));
    const _hours = Math.max(0, p(hoursSaved));
    const _rate = Math.max(0, p(hourlyRate));
    const _fee = Math.max(0, p(pilotFee));
    const _months = Math.max(0, Math.floor(p(retentionMonths)));
    const _avgProjectValue = Math.max(0, p(avgProjectValue));
    const _monthlyProjects = Math.max(0, Math.floor(p(monthlyProjects)));
    const _takeRatePct = Math.max(0, p(takeRatePct));
    const _opsCostPerProject = Math.max(0, p(opsCostPerProject));
    const _buyerCAC = Math.max(0, p(buyerCAC));
    const _sellerCAC = Math.max(0, p(sellerCAC));
    const _buyersAcquired = Math.max(0, Math.floor(p(buyersAcquiredPerMonth)));
    const _sellersAcquired = Math.max(0, Math.floor(p(sellersAcquiredPerMonth)));
    return {
      _mrr, _teams, _hours, _rate, _fee, _months,
      _avgProjectValue, _monthlyProjects, _takeRatePct, _opsCostPerProject,
      _buyerCAC, _sellerCAC, _buyersAcquired, _sellersAcquired
    };
  }, [mrr, teams, hoursSaved, hourlyRate, pilotFee, retentionMonths, avgProjectValue, monthlyProjects, takeRatePct, opsCostPerProject, buyerCAC, sellerCAC, buyersAcquiredPerMonth, sellersAcquiredPerMonth]);

  const metrics = useMemo(() => {
    if ((props.variant || 'saas') === 'marketplace') {
      const gmvMonthly = parsed._avgProjectValue * parsed._monthlyProjects; // Gross marketplace volume
      const platformRevenue = gmvMonthly * (parsed._takeRatePct / 100);
      const opsCostMonthly = parsed._opsCostPerProject * parsed._monthlyProjects;
      const acquisitionSpendMonthly = (parsed._buyerCAC * parsed._buyersAcquired) + (parsed._sellerCAC * parsed._sellersAcquired);
      const netMonthlyContribution = platformRevenue - opsCostMonthly - acquisitionSpendMonthly;
      const contributionOverRetention = netMonthlyContribution * Math.max(1, parsed._months);
      const roas = acquisitionSpendMonthly > 0 ? (platformRevenue / acquisitionSpendMonthly) : null;
      const grossMarginPct = platformRevenue > 0 ? Math.round(((platformRevenue - opsCostMonthly) / platformRevenue) * 100) : null;
      return {
        mode: 'marketplace' as const,
        gmvMonthly,
        platformRevenue,
        opsCostMonthly,
        acquisitionSpendMonthly,
        netMonthlyContribution,
        contributionOverRetention,
        roas,
        grossMarginPct,
      };
    }
    // SaaS/time-savings (default)
    const revenue = parsed._mrr * parsed._teams; // monthly
    const timeSavings = parsed._hours * parsed._rate * parsed._teams; // $/month
    const totalMonthlyValue = revenue + timeSavings;
    const paybackMonths = totalMonthlyValue > 0 ? Math.ceil(parsed._fee / totalMonthlyValue) : null;
    const twelveMonthValue = totalMonthlyValue * Math.max(1, parsed._months);
    const roiPct = parsed._fee > 0 ? Math.round(((twelveMonthValue - parsed._fee) / parsed._fee) * 100) : null;
    return { mode: 'saas' as const, revenue, timeSavings, totalMonthlyValue, paybackMonths, twelveMonthValue, roiPct };
  }, [parsed, props.variant]);

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [['Metric', 'Value']];
    if ((props.variant || 'saas') === 'marketplace' && (metrics as any).mode === 'marketplace') {
      rows.push(
        ['Avg project value ($)', avgProjectValue],
        ['Monthly projects', monthlyProjects],
        ['Take rate (%)', takeRatePct],
        ['Ops cost / project ($)', opsCostPerProject],
        ['Buyer CAC ($)', buyerCAC],
        ['New buyers / mo', buyersAcquiredPerMonth],
        ['Seller CAC ($)', sellerCAC],
        ['New sellers / mo', sellersAcquiredPerMonth],
        ['Retention months', retentionMonths],
        ['GMV / month ($)', String((metrics as any).gmvMonthly.toFixed(2))],
        ['Platform revenue / month ($)', String((metrics as any).platformRevenue.toFixed(2))],
        ['Ops cost / month ($)', String((metrics as any).opsCostMonthly.toFixed(2))],
        ['Acquisition spend / month ($)', String((metrics as any).acquisitionSpendMonthly.toFixed(2))],
        ['Net monthly contribution ($)', String((metrics as any).netMonthlyContribution.toFixed(2))],
        ['Contribution over retention ($)', String((metrics as any).contributionOverRetention.toFixed(2))],
        ['Gross margin (%)', (metrics as any).grossMarginPct == null ? 'n/a' : String((metrics as any).grossMarginPct)],
        ['ROAS (rev/acq)', (metrics as any).roas == null ? 'n/a' : String((metrics as any).roas.toFixed(2))],
      );
    } else {
      rows.push(
        ['MRR per team ($)', mrr],
        ['Teams', teams],
        ['Hours saved / team / mo', hoursSaved],
        ['Hourly rate ($)', hourlyRate],
        ['Pilot fee ($)', pilotFee],
        ['Retention months', retentionMonths],
        ['Monthly revenue ($)', String((metrics as any).revenue.toFixed(2))],
        ['Monthly time savings ($)', String((metrics as any).timeSavings.toFixed(2))],
        ['Total monthly value ($)', String((metrics as any).totalMonthlyValue.toFixed(2))],
        ['Payback (months)', (metrics as any).paybackMonths == null ? 'n/a' : String((metrics as any).paybackMonths)],
        ['Value over retention ($)', String((metrics as any).twelveMonthValue.toFixed(2))],
        ['ROI (%)', (metrics as any).roiPct == null ? 'n/a' : String((metrics as any).roiPct)],
      );
    }
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roi-calculator.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isMarketplace = (props.variant || 'saas') === 'marketplace';

  return (
    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, marginTop: 10 }}>
      {props.blocked && (
        <div style={{ marginBottom: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#7F1D1D', borderRadius: 8, padding: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>ROI temporarily disabled</div>
          <div style={{ fontSize: 12 }}>{props.blockedNote || 'Structural barrier detected. Explore pivots, then revisit ROI.'}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>ROI calculator{props.variant ? ` · ${props.variant}` : ''}</div>
        <button onClick={exportCsv} disabled={!!props.disabledExport} style={{ fontSize: 12, background: props.disabledExport ? '#9CA3AF' : '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: props.disabledExport ? 'not-allowed' : 'pointer' }}>Export CSV</button>
      </div>
      {props.disclaimer && (
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>{props.disclaimer}</div>
      )}
      {isMarketplace ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Avg project value ($)</span>
              <input value={avgProjectValue} onChange={(e) => setAvgProjectValue(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Monthly projects</span>
              <input value={monthlyProjects} onChange={(e) => setMonthlyProjects(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Platform take rate (%)</span>
              <input value={takeRatePct} onChange={(e) => setTakeRatePct(e.target.value)} type="number" min={0} max={100} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Ops cost / project ($)</span>
              <input value={opsCostPerProject} onChange={(e) => setOpsCostPerProject(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Buyer CAC ($)</span>
              <input value={buyerCAC} onChange={(e) => setBuyerCAC(e.target.value)} placeholder={props.recommendedAcquisitionCost != null ? String(props.recommendedAcquisitionCost) : undefined} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>New buyers / month</span>
              <input value={buyersAcquiredPerMonth} onChange={(e) => setBuyersAcquiredPerMonth(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Seller CAC ($)</span>
              <input value={sellerCAC} onChange={(e) => setSellerCAC(e.target.value)} placeholder={props.recommendedAcquisitionCost != null ? String(props.recommendedAcquisitionCost) : undefined} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>New sellers / month</span>
              <input value={sellersAcquiredPerMonth} onChange={(e) => setSellersAcquiredPerMonth(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Retention (months)</span>
              <input value={retentionMonths} onChange={(e) => setRetentionMonths(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 10 }}>
            <Metric label="GMV / month" value={`$${(metrics as any).gmvMonthly.toFixed(0)}`} />
            <Metric label="Platform revenue / month" value={`$${(metrics as any).platformRevenue.toFixed(0)}`} />
            <Metric label="Ops cost / month" value={`$${(metrics as any).opsCostMonthly.toFixed(0)}`} />
            <Metric label="Acquisition spend / month" value={`$${(metrics as any).acquisitionSpendMonthly.toFixed(0)}`} />
            <Metric label="Net monthly contribution" value={`$${(metrics as any).netMonthlyContribution.toFixed(0)}`} />
            <Metric label="Contribution over retention" value={`$${(metrics as any).contributionOverRetention.toFixed(0)}`} />
            <Metric label="Gross margin" value={(metrics as any).grossMarginPct == null ? 'n/a' : `${(metrics as any).grossMarginPct}%`} />
            <Metric label="ROAS (rev/acq)" value={(metrics as any).roas == null ? 'n/a' : `${(metrics as any).roas.toFixed(2)}x`} />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>MRR / team ($)</span>
              <input value={mrr} onChange={(e) => setMrr(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Teams</span>
              <input value={teams} onChange={(e) => setTeams(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Hours saved / team / mo</span>
              <input value={hoursSaved} onChange={(e) => setHoursSaved(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Hourly rate ($)</span>
              <input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Pilot fee ($)</span>
              <input value={pilotFee} onChange={(e) => setPilotFee(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Retention (months)</span>
              <input value={retentionMonths} onChange={(e) => setRetentionMonths(e.target.value)} type="number" min={0} style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 10 }}>
            <Metric label="Monthly revenue" value={`$${(metrics as any).revenue.toFixed(0)}`} />
            <Metric label="Monthly time savings" value={`$${(metrics as any).timeSavings.toFixed(0)}`} />
            <Metric label="Total monthly value" value={`$${(metrics as any).totalMonthlyValue.toFixed(0)}`} />
            <Metric label="Payback (months)" value={(metrics as any).paybackMonths == null ? 'n/a' : String((metrics as any).paybackMonths)} />
            <Metric label="Value over retention" value={`$${(metrics as any).twelveMonthValue.toFixed(0)}`} />
            <Metric label="ROI" value={(metrics as any).roiPct == null ? 'n/a' : `${(metrics as any).roiPct}%`} />
          </div>
        </>
      )}
      {props.presetsNote && (
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>{props.presetsNote}</div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string; }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{value}</div>
    </div>
  );
}
