import React from 'react';
import type { RiskAssessment } from '@/lib/riskAssessment';

export interface RiskBreakdownProps {
  assessment: RiskAssessment;
  maxDrivers?: number;
}

export function RiskBreakdown({ assessment, maxDrivers = 4 }: RiskBreakdownProps) {
  const drivers = assessment.drivers || [];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 8 }}>
        <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Risk score</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{assessment.scores.risk != null ? `${assessment.scores.risk}/100` : '—'}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Execution score</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{assessment.scores.execution != null ? `${assessment.scores.execution}/100` : '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Top drivers and reduction strategies</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {drivers.slice(0, maxDrivers).map((d, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>
                  {d.label}{' '}
                  {d.severity === 'high' ? (
                    <span style={{ fontSize: 11, background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>High</span>
                  ) : d.severity === 'medium' ? (
                    <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Medium</span>
                  ) : (
                    <span style={{ fontSize: 11, background: '#ECFDF5', color: '#065F46', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Info</span>
                  )}
                </div>
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {d.strategies.slice(0, 3).map((s, j) => (
                    <li key={j} style={{ color: '#374151', marginBottom: 4 }}>{s}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default RiskBreakdown;
