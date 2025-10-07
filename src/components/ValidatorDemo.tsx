import { useState } from "react";
import { BusinessModelAwarePivotView } from "@/components/BusinessModelAwarePivotView";

type Scores = {
  demand: number;
  urgency: number;
  moat: number;
  distribution: number;
  economics: number;
};

export default function ValidatorDemo() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<Scores | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [showAlternatives, setShowAlternatives] = useState(false);

  function validate() {
    if (!idea.trim()) return;
    setLoading(true);

    // simulate API
    setTimeout(() => {
      const rand = () => Math.floor(Math.random() * 10) + 1;
      const s: Scores = {
        demand: rand(),
        urgency: rand(),
        moat: rand(),
        distribution: rand(),
        economics: rand(),
      };
      const a = Math.round((Object.values(s).reduce((x, y) => x + y, 0) / 50) * 100);
      setScores(s);
      setAvg(a);
      setStatus(
        a >= 70
          ? "Strong potential! Worth pursuing."
          : a >= 40
          ? "Moderate potential. Consider a pivot."
          : "High risk detected. Explore alternatives."
      );
      // Auto-suggest alternatives when overall score is weak
      setShowAlternatives(a < 40);
      setLoading(false);
    }, 900);
  }

  return (
    <div className="demo">
      <div className="demo-head">
        <h3>Try a free validation</h3>
        <span className="live">LIVE</span>
      </div>

      <input
        className="demo-input"
        type="text"
  placeholder="Describe your idea in one sentence"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? validate() : null)}
        aria-label="Your idea"
      />
      <button className="btn-primary" onClick={validate} disabled={loading}>
        {loading ? "Validating…" : "Validate my idea"}
      </button>

      {avg !== null && scores && (
        <div className="validation" aria-live="polite">
          <div className="score-number">{avg}%</div>
          {/* Segmented progress bar (20 segments) to avoid inline width styles */}
          <div className="score-bar">
            <div className="flex gap-0.5">
              {Array.from({ length: 20 }).map((_, i) => {
                const filled = i < Math.max(0, Math.min(20, Math.round((avg / 100) * 20)));
                return <span key={i} className={`${filled ? 'bg-emerald-500' : 'bg-slate-200'} h-2 flex-1 rounded-sm`} />;
              })}
            </div>
          </div>
          <p className="score-msg">{status}</p>

          {/* Toggle to explore alternative opportunities (pivots) */}
          <div className="report-cta mt-3">
            <button
              className="btn-primary"
              onClick={() => setShowAlternatives((v) => !v)}
            >
              {showAlternatives ? "Hide alternative opportunities" : "Explore alternative opportunities"}
            </button>
            {avg < 40 && (
              <p className="mini-note">Your score is low — pivots may offer a better path.</p>
            )}
          </div>

          <div className="report-cta">
            <button
              className="btn-primary"
              onClick={() =>
                document.getElementById("modalOverlay")?.setAttribute("style", "display:flex")
              }
            >
              Download full report (PDF)
            </button>
            <p className="mini-note">
              We’ll ask your name & email, then a short 60-second survey.
            </p>
          </div>

          <div className="rubric">
            {Object.entries(scores).map(([k, v]) => (
              <div className="rubric-card" key={k}>
                <div className="rubric-label">{k}</div>
                <div className="rubric-value">{v}/10</div>
              </div>
            ))}
          </div>

          {showAlternatives && avg !== null && (
            <div className="mt-5">
              <BusinessModelAwarePivotView
                validationRequest={{
                  ideaText: idea,
                  currentValidation: { overall: avg, dimensions: scores },
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
