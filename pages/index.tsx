"use client";

import Head from "next/head";
import Image from "next/image";
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
      setModalStep(3);
      setDownloadReady(true);
      
      // Generate and download the PDF report
      await generateAndDownloadPdf();
    } catch {
      setModalStep(3);
      setDownloadReady(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function generateAndDownloadPdf() {
    try {
      // Import the PDF generation function
      const { generatePdfReport, resolvePdfMode } = await import('@/lib/pdf/generate');
      
      // Prepare the data for PDF generation
      const surveyData = {
        name,
        email,
        userType: survey.stage || '',
        biggestChallenge: survey.goal.join(', ') || '',
        usedAITools: survey.features.join(', ') || '',
        wouldTryApp: survey.pay || '',
        businessBarriers: survey.goal || [],
        platformFeatures: survey.features || [],
        mustHaveFeature: survey.comments || '',
        suggestions: survey.comments || ''
      };

      // Use real mode to generate comprehensive PDF report
      const input = {
        diagnostics: { enabled: true, push: (s: string) => console.log('[PDF]', s) },
        modeResolution: resolvePdfMode({ nodeEnv: 'development' }), // This will default to 'real' mode
        idea: idea,
        avg: avg,
        status: result?.status,
        highlights: result?.highlights || [],
        scores: result?.scores,
        survey: surveyData,
        logoUrl: rawLogo,
        rawApi: result,
        simulateFailure: false
      };

      // Generate the PDF
      const pdfResult = await generatePdfReport(input);
      
      if (!pdfResult.success) {
        console.error('PDF generation failed:', pdfResult.error);
        setToast("PDF generation failed. Please try again.");
        setTimeout(() => setToast(null), 4000);
      } else {
        console.log('PDF generated successfully');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      setToast("Error generating PDF. Please try again.");
      setTimeout(() => setToast(null), 4000);
    }
  }

  // Note: static report download is handled inline in submitSurvey step 3.

  const avg = useMemo(() => {
    if (!result?.scores) return null;
    // Use the API's calculated overall score instead of averaging all dimensions
    if (result.scores.overall !== undefined) {
      return Math.max(0, Math.min(100, Math.round(result.scores.overall)));
    }
    // Fallback to averaging if overall score not provided (legacy)
    const vals = Object.values(result.scores).filter((n) => typeof n === "number");
    if (!vals.length) return null;
    const average = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return Math.max(0, Math.min(100, average));
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
            <span>bizsproutai</span>
          </div>
          <ul className="nav-links">
            <li><a href="#validation">Free Validation</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="hero-container">
            <div className="hero-content">
              <h1>Validate your idea. Launch with confidence.</h1>
              <p className="hero-subtitle">Our AI validates your idea in minutes—then helps you launch it.</p>
              <a href="#validation" className="btn-primary hero-cta">Get Free Validation</a>
            </div>
          </div>
        </section>

        {/* STOP BUILDING BUSINESSES THAT FAIL */}
        <section className="failure-section">
          <div className="container">
            <h2>Stop Building<br/>Businesses That Fail</h2>
            <p className="failure-text">
              90% of startups fail. Our AI validates your idea, redefines it if it's a NO-GO,
              and builds everything you need to launch. One prompt. Complete business. Fully
              modifiable to fit your vision.
            </p>
            <div className="demo-section">
              <h3>Try a free validation</h3>
              <p>See how our AI analyzes business ideas</p>
              <span className="live-badge">LIVE DEMO</span>
            </div>
          </div>
        </section>

        {/* GET FREE VALIDATION */}
        <section id="validation" className="validation-section">
          <div className="container">
            <h2>Get Free Validation</h2>
            <div className="validation-grid">
              <div className="validation-form">
                <textarea
                  id="ideaInput"
                  className="idea-input"
                  rows={6}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Describe Your Business Idea"
                />
                <button
                  className="validate-btn"
                  onClick={handleValidate}
                  disabled={!idea.trim() || validating}
                >
                  {validating ? 'Analyzing...' : 'Validate My Idea'}
                </button>
                <p className="validation-note">
                  Add a little more detail for better signal (min 10 chars).<br/>
                  Your idea is analyzed instantly. No credit card required.
                </p>
              </div>

              {/* RESULTS */}
              {(result || validating || error) && (
                <div className="validation-results">
                  {typeof avg === "number" && (
                    <>
                      <div className="score-number">{avg}%</div>
                      {(() => { const bucket = Math.min(100, Math.max(0, Math.round((avg || 0)/5)*5)); return (
                        <div className="score-bar"><div className={`score-fill w-pct-${bucket}`} /></div>
                      ); })()}
                      <p className="score-msg">
                        {avg >= 70 && "Strong potential! Worth pursuing."}
                        {avg >= 40 && avg < 70 && "Moderate potential. Consider a pivot or niche."}
                        {avg < 40 && "High risk detected. Explore alternatives."}
                        {!result && validating && "Crunching signals…"}
                        {error && `Error: ${error}`}
                      </p>
                    </>
                  )}

                  {/* Download report CTA */}
                  {result && (
                    <div className="report-cta">
                      <button 
                        className="btn-primary" 
                        onClick={() => setShowModal(true)}
                      >
                        Download full report (PDF)
                      </button>
                      <p className="mini-note">We'll ask your name & email, then a quick 60-second survey.</p>
                    </div>
                  )}

                  {result?.scores && (
                    <div className="rubric">
                      {/* Map API scores to live site 5-dimension format */}
                      {[
                        { label: 'DEMAND', value: result.scores.demand_signals || result.scores.problem || 0 },
                        { label: 'URGENCY', value: result.scores.underserved || result.scores.urgency || 0 },
                        { label: 'MOAT', value: result.scores.differentiation || result.scores.moat || 0 },
                        { label: 'DISTRIBUTION', value: result.scores.gtm || result.scores.distribution || 0 },
                        { label: 'ECONOMICS', value: result.scores.wtp || result.scores.economics || 0 }
                      ].map(({ label, value }) => (
                        <div key={label} className="rubric-card">
                          <div className="rubric-label">{label}</div>
                          <div className="rubric-value">{value.toFixed(1)}/100</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FEATURES - Everything you need to launch & grow */}
        <section id="features" className="features-section">
          <div className="container">
            <h2>Everything you need to launch & grow</h2>
            <p className="section-subtitle">From validation to launch, we build your complete business foundation.</p>
            <div className="features-grid">
              <div className="feature">
                <div className="feature-icon">🎯</div>
                <h3>AI Validation Framework</h3>
                <p>Comprehensive analysis across demand, competition, market timing, and unit economics with transparent scoring.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🎨</div>
                <h3>Complete Brand Identity</h3>
                <p>Logo design, color palette, typography, brand voice, and style guidelines—all cohesive and launch-ready.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🌐</div>
                <h3>Launch-Ready Website + LLM Optimization</h3>
                <p>SEO-optimized, mobile-responsive site with conversion-focused copy and your complete brand applied.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">📢</div>
                <h3>Marketing Automation</h3>
                <p>Email sequences, social media content, ad copy, and a complete 90-day go-to-market strategy.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">📊</div>
                <h3>Business Metrics & Analytics</h3>
                <p>KPI tracking, conversion funnels, and growth metrics dashboard to measure your success.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🎓</div>
                <h3>Business Education & Guidance</h3>
                <p>Step-by-step courses, best practices, and ongoing support to help you grow your validated business.</p>
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM COMING SOON */}
        <section className="platform-section">
          <div className="container">
            <h2>Complete business building platform coming soon</h2>
            <p className="platform-subtitle">
              Based on your validation feedback, we&apos;re building the full AI platform to create
              your entire business foundation.
            </p>
            <div className="platform-content">
              <h4>Help us build what you need</h4>
              <p>
                Your validation responses and feature requests directly influence our platform
                development. Get free validation today and help shape the future of AI business
                building.
              </p>
              <a href="#validation" className="btn-primary">Get free validation now</a>
              <p className="language-note">Spanish, French, and Haitian Creole coming soon! Próximamente en español, français et kreyòl ayisyen!</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="faq-section">
          <div className="container">
            <h2>Frequently asked questions</h2>
            <p className="section-subtitle">Everything you need to know about BizSproutAI.</p>
            <div className="faq-list">
              <div className="faq-item">
                <h3>What does the AI validation actually check?</h3>
                <p>Our AI analyzes market demand, competition intensity, timing factors, unit economics, and overall business viability using multiple data sources and proven frameworks.</p>
              </div>
              <div className="faq-item">
                <h3>Is the validation really free?</h3>
                <p>Yes! Our basic validation is completely free with no credit card required. We believe every entrepreneur deserves access to quality business insights.</p>
              </div>
              <div className="faq-item">
                <h3>How accurate is the AI validation?</h3>
                <p>Our AI provides data-driven insights based on market signals, but it&apos;s designed to complement, not replace, real customer validation and market research.</p>
              </div>
              <div className="faq-item">
                <h3>What happens to my data and ideas?</h3>
                <p>Your data is secure and private. We never share your ideas with third parties and you retain full ownership of all intellectual property.</p>
              </div>
              <div className="faq-item">
                <h3>When will the full business-building platform launch?</h3>
                <p>We&apos;re actively developing based on user feedback. Join our validation program to get early access and help shape the features we build.</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <Image src={logoSrc} alt="BizSproutAI" width={28} height={28} />
              <span>bizsproutai</span>
              <p>Validate your business ideas with AI-powered insights. Built by entrepreneurs, for entrepreneurs.</p>
              <div className="social-links">
                <a href="https://x.com/bizsproutai" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
                <a href="https://www.linkedin.com/in/wagner-desir/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                <a href="https://facebook.com/bizsproutai" target="_blank" rel="noopener noreferrer">Facebook</a>
                <a href="https://youtube.com/@bizsproutai" target="_blank" rel="noopener noreferrer">YouTube</a>
                <a href="https://www.reddit.com/r/bizsproutai" target="_blank" rel="noopener noreferrer">Reddit</a>
                <a href="https://instagram.com/bizsproutai" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="mailto:hello@bizsproutai.com">Email</a>
              </div>
            </div>
            <div className="footer-links">
              <div className="footer-section">
                <h4>Product</h4>
                <ul>
                  <li><a href="#validation">Free Validation</a></li>
                  <li><a href="#features">Features</a></li>
                  <li><a href="#" className="coming-soon">Business Builder (Coming Soon)</a></li>
                </ul>
              </div>
              <div className="footer-section">
                <h4>Support</h4>
                <ul>
                  <li><a href="mailto:support@bizsproutai.com">Contact Support</a></li>
                  <li><a href="/help">Help Center</a></li>
                  <li><a href="/feedback">Send Feedback</a></li>
                </ul>
              </div>
              <div className="footer-section">
                <h4>Legal</h4>
                <ul>
                  <li><a href="/privacy">Privacy Policy</a></li>
                  <li><a href="/terms">Terms of Service</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 BizSproutAI</p>
            <div className="footer-badges">
              <span className="beta-badge">BETA</span>
              <span>Built with ❤️ by entrepreneurs, for entrepreneurs.</span>
              <span>Made in Miami 🌴</span>
              <span className="status">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* === MODAL === */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {/* Professional Header */}
            <div className="modal-header">
              <div className="modal-steps" aria-label="Steps">
                <span className={modalStep >= 1 ? "on" : ""}>1</span>
                <span className={modalStep >= 2 ? "on" : ""}>2</span>
                <span className={modalStep >= 3 ? "on" : ""}>3</span>
              </div>
              <h3 className="modal-title">
                {modalStep === 1 && "Get Your Validation Report"}
                {modalStep === 2 && "60-Second Survey"}
                {modalStep === 3 && "Report Ready!"}
              </h3>
              <p className="modal-subtitle">
                {modalStep === 1 && "We'll send your comprehensive analysis to your email"}
                {modalStep === 2 && "Help us improve BizSproutAI's validation accuracy"}
                {modalStep === 3 && "Your personalized business validation report"}
              </p>
            </div>

            {modalStep === 1 && (
              <>
                <div className="modal-content">
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
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                  <button className="btn-primary" onClick={submitLead} disabled={submitting}>
                    {submitting ? "Saving…" : "Continue"}
                  </button>
                </div>
              </>
            )}

            {modalStep === 2 && (
              <>
                <div className="modal-content">
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
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn-primary" onClick={submitSurvey} disabled={submitting}>
                    {submitting ? "Submitting…" : "Finish & get report"}
                  </button>
                  <button className="btn-secondary" onClick={() => setModalStep(1)} disabled={submitting}>Back</button>
                </div>
              </>
            )}

            {modalStep === 3 && (
              <>
                <div className="modal-content">
                  <div className="done">
                    <h3>Thanks! Your report is ready.</h3>
                    <p className="muted">We also sent a copy to your email.</p>
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    className={`btn-primary ${downloadReady ? "" : "disabled"}`}
                    onClick={downloadReady ? generateAndDownloadPdf : undefined}
                    disabled={!downloadReady}
                  >
                    {downloadReady ? "Download PDF" : "Preparing…"}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
