import React from "react";

export default function ScoreCard({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 10;
  const pct = Math.max(0, Math.min(100, Math.round((safeValue / safeMax) * 100)));

  return (
    <div className="scorecard">
      <div className="scorecard-label">{label}</div>
      <div className="scorecard-value">{safeValue}/{safeMax}</div>
      <div className="scorecard-meter" aria-hidden="true">
        <div className="scorecard-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
