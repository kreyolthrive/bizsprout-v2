"use client";

import Head from "next/head";
import Image from "next/image";
import type { GetStaticProps } from "next";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import {
  // (you can surface these in the UI later if you want)
  decision,
  overallScore,
  formatLocal,
  type ValidateResponse,
} from "@/lib/validationFramework";
import type { BusinessModelClassification } from '@/lib/contextualPivots';

// If you want phases/rules/red flags elsewhere, they’re still available:
// import { VALIDATION_PHASES, QC_RULES, RED_FLAGS } from "@/lib/validationFramework";

type SurveyAnswers = {
  stage: string;
  goal: string[];
  budget: string;
  timeframe: string;
  pay: string;
  features: string[];
  comments: string;
};

// small util for idempotency keys (server can dedupe by header)
function makeIdem(): string {
  return `idem-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// Main landing page component
export default function Home() {
  const REPORT_PATH = "/reports/bizsproutai-validation-sample.pdf";

  // --- primary state used throughout the page ---
  const [idea, setIdea] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [previousClassification, setPreviousClassification] = useState<BusinessModelClassification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ id?: string; title?: string; created_at?: string }>>([]);
  const [mounted, setMounted] = useState(false);
  const signing = useRef(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [signedUp, setSignedUp] = useState(false);

  // --- toast ---
  const [toast, setToast] = useState<string | null>(null);

  // --- modal flow ---
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [survey, setSurvey] = useState<SurveyAnswers>({
    stage: "",
    goal: [],
    budget: "",
    timeframe: "",
    pay: "",
    features: [],
    comments: "",
  });

  // --- bot honeypot ---
  const hpRef = useRef<HTMLInputElement | null>(null); // hidden field

  // --- effects ---
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    const samples = [
      "AI that drafts Etsy product descriptions",
      "Meal prep subscription for diabetics",
      "Shopify app to auto-bundle accessories",
      "Summarize local sports highlights for parents",
      "Handmade leather bags DTC brand",
    ];
    let i = 0;
    const id = setInterval(() => {
      const el = document.getElementById("ideaInput") as HTMLInputElement | null;
      if (el && !el.value) el.placeholder = samples[i++ % samples.length];
    }, 1800);
    return () => clearInterval(id);
  }, []);

  // --- handlers ---
  async function handleWaitlist(e: FormEvent) {
    e.preventDefault();
    if (signing.current) return;
    signing.current = true;
    setSignedUp(false);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": makeIdem() },
        body: JSON.stringify({ email }),
      });
      // Treat non-OK as soft success so UI doesn't block early users
      if (!r.ok) console.warn("waitlist endpoint not ready yet");
      setSignedUp(true);
      setEmail("");
    } catch {
      setSignedUp(true);
    } finally {
      signing.current = false;
    }
  }

  async function runValidation() {
    if (!idea.trim()) return;
    setValidating(true);
    setError(null);
    setResult(null);

    // 30s timeout using AbortController
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30_000);

    try {
      const r = await fetch("/api/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: idea.slice(0, 60),
          idea,
          // keep this if your API expects it; remove if you’ve moved to richer inputs
          target_market: "founders",
        }),
        signal: ac.signal,
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "validation failed");
      }
      const data: ValidateResponse = await r.json();
      setResult(data);
      const maybeClass: unknown = (data as any)?.classification;
      if (maybeClass && typeof maybeClass === 'object') {
        const c = maybeClass as Partial<BusinessModelClassification>;
        if (typeof c.primaryType === 'string' && Array.isArray(c.indicators)) {
          setPreviousClassification(c as BusinessModelClassification);
        }
      }
      const latest = await fetch("/api/projects").then((x) => x.json());
      setRecent(latest);
    } catch (e) {
      const err = e as { name?: string; message?: string };
      setError(
        err?.name === "AbortError"
          ? "Validation timed out. Please try again."
          : err?.message || "Something went wrong"
      );
    } finally {
      clearTimeout(to);
      setValidating(false);
    }
  }

  // Wrapper for new button handler naming (preserves existing logic)
  const handleValidate = () => {
    if (!idea.trim() || validating) return;
    void runValidation();
  };

  function onSurveyChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const name = target.name as keyof SurveyAnswers;
    const value = target.value;
    const type = (target as HTMLInputElement).type;
    const isCheckbox = type === "checkbox";
    setSurvey((prev) => {
      if (isCheckbox) {
        const list = new Set(prev[name] as unknown as string[]);
        const checked = (target as HTMLInputElement).checked;
        if (checked) {
          list.add(value);
        } else {
          list.delete(value);
        }
        return { ...prev, [name]: Array.from(list) } as SurveyAnswers;
      }
      return { ...prev, [name]: value } as SurveyAnswers;
    });
  }

  async function submitLead() {
    // honeypot: bots often fill hidden "website" field
    if (hpRef.current?.value) {
      return; // silently drop
    }
    // inline validation
    if (!name.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setToast("Please enter a valid name and email.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setSubmitting(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": makeIdem() },
        body: JSON.stringify({
          name,
          email,
          source: "landing_report_cta",
          idea,
          result,
        }),
      });
      setModalStep(2);
    } catch {
      setModalStep(2); // proceed anyway
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSurvey() {
    if (!survey.stage || survey.goal.length === 0) {
      setToast("Please select your stage and at least one goal.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setSubmitting(true);
    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": makeIdem() },
        body: JSON.stringify({
          name,
          email,
          survey,
          idea,
          result,
        }),
      });
      // Move to "download" step, but DO NOT auto-download (ensures survey gate)
      setModalStep(3);
      setDownloadReady(true);
      // optional: auto-download after a tick
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = REPORT_PATH;
        a.download = "BizSproutAI-Validation-Report.pdf";
        a.click();
      }, 300);
    } catch {
      setModalStep(3);
      setDownloadReady(true);
    } finally {
      setSubmitting(false);
    }
  }

  // Note: static report download is handled inline in submitSurvey step 3.

  const avg = useMemo(() => {
    if (!result?.scores) return null;
    const vals = Object.values(result.scores).filter((n) => typeof n === "number");
    if (!vals.length) return null;
    const outOf100 = Math.round(
      (vals.reduce((a, b) => a + b, 0) / (vals.length * 10)) * 100
    );
    return Math.max(0, Math.min(100, outOf100));
  }, [result]);

  // Compute cache-busted logo once per mount to avoid stale caching when this legacy page is used
  const rawLogo = (process.env.NEXT_PUBLIC_LOGO_URL as string) || "/brand-logo.svg";
  const logoSrc = useMemo(() => rawLogo + (rawLogo.includes("?") ? "&" : "?") + "_v=" + Date.now(), [rawLogo]);

  return (
    <>
      <Head>
        <title>BizSproutAI — Validate your idea, launch with confidence</title>
        <meta
          name="description"
          content="Validate your business idea in minutes. Get a GO/REVIEW/NO-GO call plus the assets to launch when it’s a GO."
        />
        <meta property="og:title" content="BizSproutAI — Validate your idea, launch with confidence" />
        <meta property="og:description" content="Score your idea across demand, urgency, moat, distribution, and economics." />
        <meta property="og:image" content="/og-image.png" />
  {/* External Google Fonts removed; using self-hosted fonts via global CSS import. */}
      </Head>

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" aria-live="polite" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      <header className="site-header">
        <nav className="nav">
          <div className="brand">
            <Image src={logoSrc} alt="BizSproutAI" width={28} height={28} priority />
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
              <h1>Validate your idea. <em>Launch with confidence.</em></h1>
              <p className="subtitle">Our AI validates your idea in minutes—then helps you launch when it’s a GO.</p>
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
              {signedUp && <div className="success">🎉 You’re on the list! We’ll send your free validation guide shortly.</div>}
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
              <textarea
                id="ideaInput"
                className="validation-input"
                rows={5}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your business idea in detail... Include your target market, pricing, revenue model, and what makes it unique."
              />
              <div className="mt-14px">
                <button
                  className="validate-button"
                  onClick={handleValidate}
                  disabled={!idea.trim() || validating}
                >
                  {validating ? 'Analyzing...' : 'Validate My Idea'}
                </button>
              </div>

              {(result || validating || error) && (
                <div className="validation">
                  {typeof avg === "number" && (
                    <>
                      <div className="score-number">{avg}%</div>
                      {(() => { const bucket = Math.min(100, Math.max(0, Math.round((avg || 0)/5)*5)); return (
                        <div className="score-bar"><div className={`score-fill w-pct-${bucket}`} /></div>
                      ); })()}
                  <p className="score-msg">
                    {result?.status === "GO" && "Strong potential! Worth pursuing."}
                    {result?.status === "REVIEW" && "Moderate potential. Consider a pivot."}
                    {result?.status === "NO-GO" && "High risk detected. Explore alternatives."}
                    {!result && validating && "Crunching signals…"}
                    {error && `Error: ${error}`}
                  </p>
                    </>
                  )}

                  {/* Download report CTA */}
                  <div className="report-cta hidden" id="reportCta">
                    <button className="btn-primary" id="downloadReportBtn">
                      Download full report (PDF)
                    </button>
                    <p className="mini-note">We’ll ask your name & email, then a quick 60-second survey.</p>
                  </div>

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
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Keep your HOW / FEATURES / RECENT / FAQ / CTA sections below.
            Tip for Recent:
            {p.created_at && <div className="rc-time">{formatLocal(p.created_at)}</div>} */}
      </main>

      <footer className="foot">
        <p>© {new Date().getFullYear()} BizSproutAI. Built by entrepreneurs, for entrepreneurs.</p>
      </footer>

      {/* === MODAL === */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {/* Stepper header */}
            <div className="modal-steps" aria-label="Steps">
              <span className={modalStep >= 1 ? "on" : ""}>1</span>
              <span className={modalStep >= 2 ? "on" : ""}>2</span>
              <span className={modalStep >= 3 ? "on" : ""}>3</span>
            </div>

            {modalStep === 1 && (
              <div>
                <h3>Get your full validation report</h3>
                <p className="muted">Tell us where to send it. Then a quick 60-second survey will appear.</p>

                {/* Honeypot — visually hidden field */}
                <input
                  ref={hpRef}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="visually-hidden"
                />

                <div className="form-grid">
                  <input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    aria-label="Your name"
                  />
                  <input
                    placeholder="Your email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    aria-label="Your email"
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-primary" onClick={submitLead} disabled={submitting}>
                    {submitting ? "Saving…" : "Continue"}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                </div>
              </div>
            )}

            {modalStep === 2 && (
              <div>
                <h3>60-second survey</h3>
                <p className="muted">Help us improve BizSproutAI’s validation accuracy.</p>

                <div className="survey">
                  <label>What stage is your business in? <span className="req">*</span></label>
                  <div className="opts">
                    {["Idea", "Researching", "Building MVP", "Launching", "Operating", "Scaling"].map(v => (
                      <label key={v}><input type="radio" name="stage" value={v} checked={survey.stage===v} onChange={onSurveyChange}/> {v}</label>
                    ))}
                  </div>

                  <label>Top goals for validation (select at least one) <span className="req">*</span></label>
                  <div className="opts">
                    {["Market demand", "Investor readiness", "Guide product scope", "Decide to pivot", "Understand competition", "Price testing"].map(v => (
                      <label key={v}><input type="checkbox" name="goal" value={v} checked={survey.goal.includes(v)} onChange={onSurveyChange}/> {v}</label>
                    ))}
                  </div>

                  <label>What’s your initial budget?</label>
                  <div className="opts">
                    {["<$100", "$100–$500", "$500–$2k", "$2k–$10k", "$10k+"].map(v => (
                      <label key={v}><input type="radio" name="budget" value={v} checked={survey.budget===v} onChange={onSurveyChange}/> {v}</label>
                    ))}
                  </div>

                  <label>When do you want to launch?</label>
                  <div className="opts">
                    {["This month", "1–3 months", "3–6 months", "6+ months"].map(v => (
                      <label key={v}><input type="radio" name="timeframe" value={v} checked={survey.timeframe===v} onChange={onSurveyChange}/> {v}</label>
                    ))}
                  </div>

                  <label>Would you pay for a full auto-build (logo → brand → site → content → socials)?</label>
                  <div className="opts">
                    {["Yes", "Maybe", "Not now"].map(v => (
                      <label key={v}><input type="radio" name="pay" value={v} checked={survey.pay===v} onChange={onSurveyChange}/> {v}</label>
                    ))}
                  </div>

                  <label>Which features matter most? (select all)</label>
                  <div className="opts">
                    {["Brand kit", "Website + copy", "Social posts", "Email sequences", "CRM basics", "Analytics dashboard"].map(v => (
                      <label key={v}><input type="checkbox" name="features" value={v} checked={survey.features.includes(v)} onChange={onSurveyChange}/> {v}</label>
                    ))}
                  </div>

                  <label>Anything else we should know?</label>
                  <textarea name="comments" rows={3} placeholder="Your use case, niche, or needs…" value={survey.comments} onChange={onSurveyChange} />

                  <div className="modal-actions">
                    <button className="btn-primary" onClick={submitSurvey} disabled={submitting}>
                      {submitting ? "Submitting…" : "Finish & get report"}
                    </button>
                    <button className="btn-secondary" onClick={() => setModalStep(1)} disabled={submitting}>Back</button>
                  </div>
                </div>
              </div>
            )}

            {modalStep === 3 && (
              <div className="done">
                <h3>Thanks! Your report is ready.</h3>
                <p className="muted">We also sent a copy to your email.</p>
                <a
                  className={`btn-primary ${downloadReady ? "" : "disabled"}`}
                  href="/reports/bizsproutai-validation-sample.pdf"
                  download="BizSproutAI-Validation-Report.pdf"
                  onClick={(e) => !downloadReady && e.preventDefault()}
                >
                  {downloadReady ? "Download PDF" : "Preparing…"}
                </a>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

  <style jsx global>{`
  :root {
          --sprout:#10B981; --iris:#8B5CF6; --ink:#0B1220; --muted:#667085; --line:#E6E8EE; --surface:#FBFBFE;
          --grad:linear-gradient(135deg,var(--sprout),var(--iris));
          --grad-soft:radial-gradient(1200px 600px at 10% -10%, rgba(16,185,129,.16), transparent 60%),
                       radial-gradient(1100px 520px at 120% 10%, rgba(139,92,246,.18), transparent 55%);
          --ring:0 0 0 3px rgba(16,185,129,.25);
          --shadow-lg:0 22px 50px rgba(25,33,61,.12); --shadow-sm:0 10px 30px rgba(102,112,133,.12);
  }
        *{box-sizing:border-box} html,body{margin:0;padding:0}
        body{color:var(--ink);background:var(--surface);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial}

        /* Toast */
        .toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--iris);
          color: #fff;
          padding: 12px 18px;
          border-radius: 10px;
          font-weight: 600;
          box-shadow: var(--shadow-sm);
          z-index: 300;
          animation: fadein .3s ease;
          cursor: pointer;
        }
        @keyframes fadein {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        .site-header{position:sticky;top:0;background:rgba(255,255,255,.9);backdrop-filter:blur(10px);z-index:50;border-bottom:1px solid var(--line)}
        .nav{max-width:1200px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
        .brand{display:flex;gap:10px;align-items:center;font-weight:800}
        .brand span{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .nav-links{display:flex;gap:20px;list-style:none;margin:0;padding:0}
        .nav-links a{color:var(--ink);text-decoration:none;font-weight:600}
        .nav-links a:hover{color:var(--sprout)}

        .hero{background:var(--grad-soft);padding:92px 20px 48px}
        .hero-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
        h1{font-family:"General Sans",Inter,ui-sans-serif;font-size:54px;line-height:1.05;margin:0 0 14px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        h2{font-family:"General Sans",Inter,ui-sans-serif;font-size:32px;line-height:1.15;margin:0}
        h3{font-size:20px;margin:0}
        .subtitle{color:var(--muted);font-size:18px;margin-bottom:18px}
        .email-form{display:flex;gap:10px;margin-top:12px}
        .email-form input{flex:1;padding:14px 16px;border:2px solid var(--line);border-radius:12px;font-size:16px;transition:border .2s, box-shadow .2s}
        .email-form input:focus{outline:none;border-color:var(--sprout);box-shadow:var(--ring)}
        .btn-primary{padding:12px 18px;border:none;border-radius:12px;background:var(--grad);color:#fff;font-weight:800;cursor:pointer;box-shadow:var(--shadow-sm)}
        .btn-primary:hover{transform:translateY(-1px)} .btn-primary:active{transform:translateY(0)}
        .btn-primary.disabled{opacity:.6;pointer-events:none}
        .btn-secondary{padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:#fff;color:#0b1220;font-weight:700}
        .microtrust{font-size:12px;color:var(--muted);margin-top:6px}
        .success{margin-top:10px;background:var(--sprout);color:#fff;padding:10px 12px;border-radius:10px}
  .logo-strip{display:flex;gap:18px;align-items:center;margin-top:16px;color:var(--muted);flex-wrap:wrap}
  .logo-strip i{opacity:.85;font-style:normal;background:#fff;padding:4px 8px;border:1px solid var(--line);border-radius:8px}

  .demo{background:#fff;padding:20px;border-radius:18px;box-shadow:var(--shadow-lg)}
  .demo-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .live{color:#059669;font-weight:800;letter-spacing:.04em}
        .demo-input{width:100%;padding:14px 16px;border:2px solid var(--line);border-radius:12px;margin:8px 0 12px;font-size:16px;transition:border .2s, box-shadow .2s}
        .demo-input:focus{outline:none;border-color:var(--sprout);box-shadow:var(--ring)}
        .validation{margin-top:12px;background:#FAFAFA;padding:14px;border-radius:14px}
        .score-number{font-size:44px;font-weight:900;text-align:center;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .score-bar{height:10px;background:var(--line);border-radius:8px;overflow:hidden;margin:10px 0}
        .score-fill{height:100%;background:var(--grad);transition:width .8s ease}
        .score-msg{text-align:center;color:#111827;font-weight:600}
        .rubric{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:10px}
        .rubric-card{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
        .rubric-label{font-size:12px;color:var(--muted);text-transform:capitalize}
        .rubric-value{font-weight:800}
  .report-cta{margin-top:12px;display:flex;align-items:center;gap:12px}
  .mini-note{margin:0;color:var(--muted);font-size:12px}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(12,18,32,.55);display:grid;place-items:center;padding:20px;z-index:1000}
        .modal{width:min(720px,100%);background:#fff;border-radius:16px;padding:20px;box-shadow:var(--shadow-lg)}
        .modal-steps{display:flex;gap:8px;margin-bottom:10px}
        .modal-steps span{width:28px;height:28px;border-radius:50%;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#667085}
        .modal-steps .on{background:var(--grad);color:#fff;border:none}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
        .form-grid input, .survey textarea{padding:12px 14px;border:2px solid var(--line);border-radius:12px}
        .form-grid input:focus, .survey textarea:focus{outline:none;border-color:var(--sprout);box-shadow:var(--ring)}
        .modal-actions{margin-top:14px;display:flex;gap:10px;justify-content:flex-end}
        .survey{display:grid;gap:12px;margin-top:8px}
        .survey .opts{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
        .survey .req{color:#dc2626;font-weight:700}
        .done{display:grid;gap:12px;justify-items:start}

        @media (max-width:720px){ .form-grid{grid-template-columns:1fr} }
      `}</style>
    </>
  );
}

// --- Static generation + ISR: serve the page from the CDN, revalidate hourly
export const getStaticProps: GetStaticProps = async () => {
  return { props: {}, revalidate: 3600 };
};
