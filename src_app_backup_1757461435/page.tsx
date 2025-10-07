"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Scores = Record<string, number>;
type ValidateResponse = {
  id: string;
  status: "GO" | "REVIEW" | "NO-GO";
  value_prop: string;
  highlights: string[];
  risks: string[];
  scores: Scores;
  target_market: string;
  title?: string;
  created_at?: string;
};

export default function Home() {
  // waitlist
  const [email, setEmail] = useState("");
  const [signedUp, setSignedUp] = useState(false);
  const signing = useRef(false);

  // live validation demo
  const [idea, setIdea] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // recent list (reads your /api/projects)
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(setRecent).catch(() => {});
  }, []);

  // rotating placeholder for idea box
  useEffect(() => {
    const samples = [
      "AI for contractor invoices",
      "Meal prep for diabetics",
      "Shopify app to auto-bundle",
      "Local sports highlights summarizer",
    ];
    let i = 0;
    const id = setInterval(() => {
      const el = document.getElementById("ideaInput") as HTMLInputElement | null;
      if (el && !el.value) el.placeholder = samples[i++ % samples.length];
    }, 2200);
    return () => clearInterval(id);
  }, []);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (signing.current) return;
    signing.current = true;
    setSignedUp(false);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) console.warn("waitlist endpoint not ready yet");
      setSignedUp(true);
      setEmail("");
    } catch {
      setSignedUp(true); // optimistic
    } finally {
      signing.current = false;
    }
  }

  async function runValidation() {
    if (!idea.trim()) return;
    setValidating(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: idea.slice(0, 60),
          idea,
          target_market: "founders",
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "validation failed");
      }
      const data: ValidateResponse = await r.json();
      setResult(data);
      // refresh recent
      const latest = await fetch("/api/projects").then(r => r.json());
      setRecent(latest);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setValidating(false);
    }
  }

  const avg = useMemo(() => {
    if (!result?.scores) return null;
    const vals = Object.values(result.scores);
    if (!vals.length) return null;
    const outOf100 = Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 10)) * 100);
    return Math.max(0, Math.min(100, outOf100));
  }, [result]);

  return (
    <>
      <header className="site-header">
        <nav className="nav">
          <div className="brand">
            <img src="/brand-logo.svg" alt="BizSproutAI" width={28} height={28} />
            <span>BizSproutAI</span>
          </div>
          <ul className="nav-links">
            <li><a href="#how">How it works</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#recent">Recent</a></li>
          </ul>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-copy">
              <h1>
                Validate your idea. <em>Launch with confidence.</em>
              </h1>
              <p className="subtitle">
                Our AI validates your idea in minutes—then helps you launch when it’s a GO.
              </p>

              <form className="email-form" onSubmit={handleWaitlist}>
                <input
                  type="email"
                  required
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="btn-primary" type="submit">Get early access</button>
              </form>
              <p className="microtrust">No spam. 1-click unsubscribe. We’ll never sell your data.</p>
              {signedUp && (
                <div className="success">
                  🎉 You’re on the list! We’ll send your free validation guide shortly.
                </div>
              )}

              <div className="logo-strip">
                <span>Trusted by builders from</span>
                <i>YC alum</i>
                <i>Product Hunt</i>
                <i>Indie Makers</i>
              </div>
            </div>

            {/* LIVE DEMO */}
            <div className="demo">
              <div className="demo-head">
                <h3>Try a free validation</h3>
                <span className="live">LIVE</span>
              </div>

              <input
                id="ideaInput"
                className="demo-input"
                type="text"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your idea in one sentence"
              />
              <button className="btn-primary" onClick={runValidation} disabled={validating}>
                {validating ? "Validating…" : "Validate my idea"}
              </button>

              {(result || validating || error) && (
                <div className="validation">
                  {typeof avg === "number" && (
                    <>
                      <div className="score-number">{avg}%</div>
                      <div className="score-bar"><div className="score-fill" style={{ width: `${avg}%` }} /></div>
                      <p className="score-msg">
                        {result?.status === "GO" && "Strong potential! Worth pursuing."}
                        {result?.status === "REVIEW" && "Moderate potential. Consider a pivot."}
                        {result?.status === "NO-GO" && "High risk detected. Explore alternatives."}
                        {!result && validating && "Crunching signals…"}
                        {error && `Error: ${error}`}
                      </p>
                    </>
                  )}

                  {result?.scores && (
                    <div className="rubric">
                      {Object.entries(result.scores).slice(0, 5).map(([k, v]) => (
                        <div key={k} className="rubric-card">
                          <div className="rubric-label">{k}</div>
                          <div className="rubric-value">{v}/100</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result?.highlights?.length ? (
                    <>
                      <h4 className="mini-h">Highlights</h4>
                      <ul className="mini-list">
                        {result.highlights.slice(0, 3).map((h, i) => <li key={i}>{h}</li>)}
                      </ul>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="problem">
          <div className="content">
            <h2>The brutal truth about starting up</h2>
            <p className="muted">Most founders learn these the hard way. You don’t have to.</p>
            <div className="stats">
              <div className="stat"><div className="num">90%</div><div className="lbl">Fail within 5 years</div></div>
              <div className="stat"><div className="num">35%</div><div className="lbl">No market need</div></div>
              <div className="stat"><div className="num">$50K</div><div className="lbl">Avg lost per failed startup</div></div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how" id="how">
          <div className="content">
            <h2>From idea to business in 3 steps</h2>
            <p className="muted">What took months now takes minutes.</p>
            <div className="steps">
              <div className="step"><div className="bubble">1</div><h3>Enter your idea</h3><p>We assess demand, competition, distribution, and basics.</p></div>
              <div className="step"><div className="bubble">2</div><h3>Get a decision</h3><p>GO / REVIEW / NO-GO with a transparent rubric.</p></div>
              <div className="step"><div className="bubble">3</div><h3>Launch</h3><p>If GO, generate brand, site, and go-to-market assets.</p></div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features" id="features">
          <div className="content">
            <h2>Everything you need to launch & grow</h2>
            <div className="features-grid">
              <div className="feature"><div className="icon" /><div><h3>AI validation framework</h3><p>Scored across demand, urgency, moat, distribution, and unit economics.</p></div></div>
              <div className="feature"><div className="icon" /><div><h3>Branding kit</h3><p>Logo, palette, type, and voice—consistent and ready to ship.</p></div></div>
              <div className="feature"><div className="icon" /><div><h3>Ready-to-launch site</h3><p>SEO-optimized, responsive, conversion-focused with copy included.</p></div></div>
              <div className="feature"><div className="icon" /><div><h3>Marketing automation</h3><p>Emails, socials, ad copy, and a 90-day content plan.</p></div></div>
            </div>
          </div>
        </section>

        {/* RECENT */}
        <section className="recent" id="recent">
          <div className="content">
            <h2>Recent validations</h2>
            {recent?.length ? (
              <ul className="recent-list">
                {recent.map((p: any) => (
                  <li key={p.id} className="recent-card">
                    <div className="rc-title">{p.title || p.id}</div>
                    {p.created_at && (
                      <div className="rc-time">{new Date(p.created_at).toLocaleString()}</div>
                    )}
                    <div className="rc-status">Status: <strong>{p.status}</strong></div>
                    {p.value_prop && <div className="rc-vp">{p.value_prop}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">No projects yet.</div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="faq" id="faq">
          <div className="content">
            <h2>Frequently asked questions</h2>
            <div className="faq-grid">
              <details>
                <summary>What does the validation actually check?</summary>
                <p>
                  We score demand, urgency, competition/moat, distribution, and basic unit economics using your input plus
                  public signals. You’ll see a transparent rubric and an overall score.
                </p>
              </details>
              <details>
                <summary>What do GO / REVIEW / NO-GO mean?</summary>
                <p>
                  <strong>GO</strong> = strong indicators; proceed and we’ll generate launch assets.{" "}
                  <strong>REVIEW</strong> = moderate; consider narrowing the niche or adjusting the offer.{" "}
                  <strong>NO-GO</strong> = high risk; we’ll suggest adjacent ideas worth testing.
                </p>
              </details>
              <details>
                <summary>Do I need to pay to try it?</summary>
                <p>No—this landing page gives you a free, lightweight validation demo to test the flow.</p>
              </details>
              <details>
                <summary>What happens to my email?</summary>
                <p>Only updates and early access. No spam. You can unsubscribe anytime with one click.</p>
              </details>
              <details>
                <summary>Can it generate my brand and website?</summary>
                <p>
                  Yes—when your idea is a GO, BizSproutAI can generate a brand kit, copy, and a launch-ready site, plus a
                  starter go-to-market plan.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <div className="content">
            <h2>Validate with confidence. Build what matters.</h2>
            <p className="muted">Join founders using BizSproutAI to choose better ideas, faster.</p>
            <button className="btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Claim early access
            </button>
          </div>
        </section>
      </main>

      <footer className="foot">
        <p>© {new Date().getFullYear()} BizSproutAI. Built by entrepreneurs, for entrepreneurs.</p>
      </footer>

      <style jsx>{`
        :root{
          --green:#10B981; --green-700:#059669; --purple:#8B5CF6; --purple-700:#6D28D9;
          --dark:#0F0F1E; --light:#FAFAFA; --text:#0B1220; --muted:#6B7280; --line:#E5E7EB;
          --grad:linear-gradient(135deg,var(--green),var(--purple));
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0}
        body{color:var(--text);background:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial}
        .site-header{position:sticky;top:0;background:rgba(255,255,255,.95);backdrop-filter:blur(10px);z-index:50;border-bottom:1px solid var(--line)}
        .nav{max-width:1200px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
        .brand{display:flex;gap:10px;align-items:center;font-weight:800}
        .brand span{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .nav-links{display:flex;gap:18px;list-style:none;padding:0;margin:0}
        .nav-links a{color:var(--text);text-decoration:none;font-weight:600}
        .nav-links a:hover{color:var(--green-700)}
        .hero{background:linear-gradient(135deg,#F0FDF4,#EFE9FF); padding:88px 20px 44px}
        .hero-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
        h1{font-family:"General Sans",Inter,ui-sans-serif;font-size:54px;line-height:1.05;margin:0 0 14px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        h2{font-family:"General Sans",Inter,ui-sans-serif;font-size:32px;line-height:1.15;margin:0}
        h3{font-size:20px;margin:0}
        .subtitle{color:var(--muted);font-size:18px;margin-bottom:18px}
        .email-form{display:flex;gap:10px;margin-top:10px}
        .email-form input{flex:1;padding:14px 16px;border:2px solid var(--line);border-radius:12px;font-size:16px}
        .btn-primary{padding:12px 18px;border:none;border-radius:12px;background:var(--grad);color:#fff;font-weight:800;cursor:pointer;transition:transform .04s ease,box-shadow .2s ease;box-shadow:0 10px 30px rgba(139,92,246,.25)}
        .btn-primary:hover{transform:translateY(-1px)}
        .btn-primary:active{transform:translateY(0)}
        .btn-primary:disabled{opacity:.7;cursor:not-allowed}
        .microtrust{font-size:12px;color:var(--muted);margin-top:6px}
        .success{margin-top:10px;background:#10B981;color:#fff;padding:10px 12px;border-radius:10px}
        .logo-strip{display:flex;gap:18px;align-items:center;margin-top:16px;color:var(--muted);flex-wrap:wrap}
        .logo-strip i{opacity:.75;font-style:normal;background:#fff;padding:4px 8px;border:1px solid var(--line);border-radius:8px}
        .demo{background:#fff;padding:20px;border-radius:18px;box-shadow:0 14px 44px rgba(0,0,0,.08)}
        .demo-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .live{color:var(--green-700);font-weight:800;letter-spacing:.04em}
        .demo-input{width:100%;padding:14px 16px;border:2px solid var(--line);border-radius:12px;margin:8px 0 12px;font-size:16px}
        .validation{margin-top:12px;background:#FAFAFA;padding:14px;border-radius:14px}
        .score-number{font-size:44px;font-weight:900;text-align:center;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .score-bar{height:10px;background:var(--line);border-radius:8px;overflow:hidden;margin:10px 0}
        .score-fill{height:100%;background:var(--grad);transition:width .8s ease}
        .score-msg{text-align:center;color:#111827;font-weight:600}
        .rubric{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:10px}
        .rubric-card{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
        .rubric-label{font-size:12px;color:var(--muted);text-transform:capitalize}
        .rubric-value{font-weight:800}
        .problem{background:#fff;padding:52px 20px}
        .content{max-width:1200px;margin:0 auto;text-align:center}
        .muted{color:var(--muted)}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px}
        .stat{padding:22px;background:#FAFAFA;border-radius:14px}
        .num{font-size:36px;font-weight:900;color:#8B5CF6}
        .lbl{color:var(--muted);margin-top:6px}
        .how{background:linear-gradient(135deg,#F0FDF4,#EFE9FF);padding:52px 20px}
        .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:26px}
        .step{text-align:center;padding:12px}
        .bubble{width:56px;height:56px;border-radius:50%;background:var(--grad);color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 10px}
        .features{background:#fff;padding:52px 20px}
        .features-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:26px;margin-top:26px;text-align:left}
        .feature{display:flex;gap:14px}
        .icon{width:46px;height:46px;border-radius:12px;background:var(--grad);flex-shrink:0}
        .recent{background:#fff;padding:40px 20px}
        .recent-list{list-style:none;display:grid;gap:12px;max-width:900px;margin:14px auto 0;padding:0}
        .recent-card{border:1px solid var(--line);border-radius:12px;padding:12px{text-align:left}}
        .faq{background:#fff;padding:48px 20px}
        .faq-grid{max-width:900px;margin:18px auto 0;text-align:left;display:grid;gap:12px}
        details{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#FAFAFA}
        details>summary{cursor:pointer;list-style:none;font-weight:700}
        details>summary::-webkit-details-marker{display:none}
        .cta{background:var(--dark);color:#fff;text-align:center;padding:52px 20px}
        .foot{background:#FAFAFA;color:var(--muted);text-align:center;padding:22px}
        @media (max-width:900px){
          .hero-grid{grid-template-columns:1fr}
          .stats,.steps,.features-grid{grid-template-columns:1fr}
          .nav-links{display:none}
          h1{font-size:40px}
        }
      `}</style>
    </>
  );
}
