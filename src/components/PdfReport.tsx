import { Document, Page, Text, View, Image, StyleSheet, Svg, Path, Defs, LinearGradient, Stop, G } from '@react-pdf/renderer';

export type Scores = {
  demand: number;
  urgency: number;
  moat: number;
  distribution: number;
  economics: number;
};

export interface SurveyData {
  name: string;
  email: string;
  userType: string;
  biggestChallenge: string;
  usedAITools: string;
  wouldTryApp: string;
  businessBarriers: string[];
  platformFeatures: string[];
  mustHaveFeature: string;
  suggestions: string;
}

export interface PdfReportProps {
  idea: string;
  avg: number | null;
  status: 'GO' | 'REVIEW' | 'NO-GO' | undefined;
  highlights: string[];
  scores?: Scores | null;
  survey: SurveyData;
  logoUrl?: string;
  /** Force using inline vector mark even if a custom external logoUrl is supplied */
  forceInlineBrand?: boolean;
  rawApi?: Record<string, unknown> & {
    scores?: Record<string, unknown> & { overall?: number };
    market_intelligence?: Record<string, unknown> & {
      marketCategory?: string;
      saturationPct?: number;
      timelineMonthsToMVP?: number;
      timelineMonthsToFirstRevenue?: number;
      suggestedTeam?: string[];
      buildCostRange?: [number, number];
    };
    summary_improved?: { next_steps?: string[] };
    summary?: { immediate_action?: string[] };
    key_insights?: string[];
    risks?: string[];
    guidance?: string[];
  } | null;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  logo: { width: 28, height: 28, marginRight: 10 },
  title: { fontSize: 20, fontWeight: 700, color: '#0b1220' },
  subtitle: { fontSize: 11, color: '#475569', marginTop: 2 },
  hr: { borderBottom: '2px solid #3b82f6', marginTop: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 13, marginTop: 14, marginBottom: 6, fontWeight: 700, color: '#0b1220' },
  label: { color: '#475569' },
  box: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginTop: 6 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingRight: 8, paddingTop: 8 },
  statCard: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 8 },
  statLabel: { fontSize: 10, color: '#64748b' },
  statValue: { fontSize: 16, fontWeight: 700, color: '#0b1220' },
  bigScore: { fontSize: 42, fontWeight: 800, color: '#2563eb' },
  status: { fontSize: 12, fontWeight: 700, marginTop: 6 },
  warnBox: { border: '1px solid #FFEDD5', backgroundColor: '#FFF7ED', borderRadius: 8, padding: 12, marginTop: 8 },
  warnText: { color: '#9A3412', fontSize: 11 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 10, color: '#64748b', borderTop: '1px solid #e5e7eb', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
});

function fmt100(x: unknown): string {
  if (x == null || Number.isNaN(Number(x))) return '—';
  return `${Math.round(Number(x))}/100`;
}

export function PdfReport({ idea, avg, status, highlights, survey, logoUrl = (process.env.NEXT_PUBLIC_LOGO_URL || '/brand-logo.svg'), forceInlineBrand = false, rawApi }: PdfReportProps) {
  const date = new Date().toLocaleDateString();
  const sc = rawApi?.scores || {};
  const overall100 = typeof sc.overall === 'number' ? Math.round(sc.overall) : (typeof avg === 'number' ? Math.round(avg) : null);
  const statusColor = status === 'GO' ? '#10b981' : status === 'REVIEW' ? '#f59e0b' : '#ef4444';
  const ctx = rawApi?.market_intelligence || {};
  const summaryImp = rawApi?.summary_improved || {};
  const guidance: string[] = Array.isArray(rawApi?.summary?.immediate_action) ? rawApi.summary.immediate_action : (Array.isArray(rawApi?.guidance) ? rawApi.guidance : []);
  const notesJoin = [
    ...(Array.isArray(rawApi?.risks) ? (rawApi.risks as string[]) : []),
    ...(Array.isArray(highlights) ? (highlights as string[]) : []),
  ].map((s: string) => String(s || '').toLowerCase()).join(' ');
  const crowded = /saturation|crowded|red ocean|too many competitors|undifferentiated/.test(notesJoin);
  const lowScore = typeof overall100 === 'number' && overall100 < 35;

  // Keep pivot strategies out of Immediate Next Steps in the PDF
  const splitGuidance = (lines: string[] = []) => {
    const immediate: string[] = [];
    const verticalization: string[] = [];
    const truePivots: string[] = [];
    const verticalRe = /(construction|contractor|job site|field service|osha|safety|healthcare|hipaa|clinic|hospital|nurse|compliance|phi|ehr|emr|vertical|industry|city|geo|niche|legal|law|attorney|litigation|firm|matter|finance|fintech|insurtech|manufacturing|retail|hospitality|template|integration|workflow|landing page|migration|roi calculator)/i;
    const pivotRe = /(\bpivot\b|switch\s+(to|towards|away)|move\s+(to|towards)|reposition\s+as|website builder|freelancer|freelance|marketplace|staffing|hiring platform|ecommerce|crm\s+outside\s+pm|outside\s+pm|non[-\s]?pm)/i;
    for (const raw of lines) {
      const line = (raw || '').trim();
      if (!line) continue;
      const isTruePivot = pivotRe.test(line);
      const isVerticalization = verticalRe.test(line);
      if (isTruePivot) truePivots.push(line);
      else if (isVerticalization) verticalization.push(line);
      else immediate.push(line);
    }
    return { immediate, verticalization, truePivots };
  };

  const allSteps: string[] = (Array.isArray(summaryImp?.next_steps) && summaryImp.next_steps.length ? summaryImp.next_steps : guidance) as string[];
  const { immediate: immediateSteps, verticalization: verticalizationSteps, truePivots: truePivotSteps } = splitGuidance(allSteps || []);

  // Guard to ensure only true pivots are displayed (exclude within-PM improvement actions)
  const filterTruePivots = (items: string[] = []) => {
    const excludeRe = /(landing\s?page|workflow|template|integration|within\s+pm|vertical(?!\s+outside)|migration|roi calculator)/i;
    return (items || []).filter((s) => s && !excludeRe.test(s));
  };

  // Personalization mismatch: user wants website/branding while idea validates PM
  const categoryName: string = String(ctx?.marketCategory || '').toLowerCase();
  const isPM = /project|project management|task|team|collaboration|kanban|sprint/.test(categoryName);
  const wantsWebsite = /website|branding/.test(String(survey?.biggestChallenge || '').toLowerCase())
    || (Array.isArray(survey?.platformFeatures) && survey.platformFeatures.includes('Website builder'));
  const mismatchNote = isPM && wantsWebsite
    ? 'We noticed your challenges lean toward website/branding and website builder features, while this idea validates a project management tool. You can proceed improving PM or consider a website/branding path—just know they’re distinct tracks.'
    : null;

  const shouldInline = forceInlineBrand || /\/brand-logo\.svg$/i.test(String(logoUrl || ''));

  const InlineBrandMark = () => (
    <Svg width={28} height={28} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id="grad-up" x1="0" y1="512" x2="512" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0EA968" />
          <Stop offset="1" stopColor="#0C7C5A" />
        </LinearGradient>
        <LinearGradient id="grad-leaf" x1="120" y1="420" x2="360" y2="92" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#11C784" />
          <Stop offset="1" stopColor="#0B5F3F" />
        </LinearGradient>
      </Defs>
      <G>
        <Path d="M270 80c8-14 28-14 36 0l120 210c7 12-2 26-16 26h-68v92c0 11-9 20-20 20h-68c-11 0-20-9-20-20V316h-68c-14 0-23-14-16-26L270 80z" fill="url(#grad-up)" />
        <Path d="M118 310c-42-148 74-226 164-246-60 40-84 108-60 154 20 38 68 58 112 52-38 70-138 122-216 40z" fill="url(#grad-leaf)" />
      </G>
    </Svg>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* Decorative logo for PDF header */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {shouldInline ? <InlineBrandMark /> : (logoUrl ? <Image style={styles.logo} src={logoUrl} /> : null)}
          <View>
            <Text style={styles.title}>BizSproutAI Validation Report</Text>
            <Text style={styles.subtitle}>Generated: {date}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Overall Assessment</Text>
          <View style={styles.hr} />
          <View style={styles.box}>
            <Text><Text style={styles.label}>Business Idea:</Text> {idea || '—'}</Text>
            <View style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={styles.bigScore}>{overall100 != null ? `${overall100}/100` : '—'}</Text>
              <Text style={[styles.status, { color: statusColor }]}>Recommendation: {status || '—'}</Text>
            </View>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <View style={styles.hr} />
          <View style={styles.grid2}>
            {[{k:'overall',label:'Overall'},
              {k:'problem',label:'Problem'},
              {k:'underserved',label:'Underserved'},
              {k:'differentiation',label:'Differentiation'},
              {k:'demand_signals',label:'Demand'},
              {k:'wtp',label:'Economics'},
              {k:'gtm',label:'GTM'},
              {k:'execution',label:'Execution'},
              {k:'risk',label:'Risk'}].map((it, idx) => (
              <View key={idx} style={styles.cell}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>{it.label}</Text>
                  <Text style={styles.statValue}>{fmt100(sc?.[it.k])}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {(Array.isArray(rawApi?.key_insights) && rawApi.key_insights.length) || highlights?.length ? (
          <View>
            <Text style={styles.sectionTitle}>Key Insights</Text>
            <View style={styles.hr} />
            <View style={styles.box}>
              {(Array.isArray(rawApi?.key_insights) && rawApi.key_insights.length ? rawApi.key_insights : highlights).slice(0,6).map((h: string, idx: number) => (
                <Text key={idx}>• {h}</Text>
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionTitle}>Market Context</Text>
          <View style={styles.hr} />
          <View style={styles.box}>
            {ctx?.marketCategory ? <Text><Text style={styles.label}>Category:</Text> {ctx.marketCategory}</Text> : null}
            {ctx?.saturationPct != null ? <Text><Text style={styles.label}>Market Saturation:</Text> {Math.round(ctx.saturationPct)}%</Text> : null}
            {rawApi?.market_intelligence?.timelineMonthsToMVP != null ? <Text><Text style={styles.label}>Timeline to MVP:</Text> {rawApi.market_intelligence.timelineMonthsToMVP} months</Text> : null}
            {rawApi?.market_intelligence?.timelineMonthsToFirstRevenue != null ? <Text><Text style={styles.label}>Time to First Revenue:</Text> {rawApi.market_intelligence.timelineMonthsToFirstRevenue} months</Text> : null}
            {Array.isArray(rawApi?.market_intelligence?.suggestedTeam) ? <Text><Text style={styles.label}>Suggested Team:</Text> {rawApi.market_intelligence.suggestedTeam.join(', ')}</Text> : null}
            {Array.isArray(rawApi?.market_intelligence?.buildCostRange) ? <Text><Text style={styles.label}>Estimated Build Cost:</Text> ${rawApi.market_intelligence.buildCostRange[0]}–${rawApi.market_intelligence.buildCostRange[1]}</Text> : null}
          </View>
          {(lowScore || crowded) ? (
            <View style={styles.warnBox}>
              <Text style={[styles.warnText, { fontWeight: 700 }]}>Why ROI can be high while the score is low</Text>
              <Text style={styles.warnText}>
                High ROI models often reflect controlled pilot assumptions (focused teams, strong champions). Your overall validation score
                accounts for market realities like saturation, differentiation, and acquisition difficulty. Use pilots to prove repeatability—don’t equate
                a single pilot’s ROI with market‑wide viability yet.
              </Text>
            </View>
          ) : null}
          {mismatchNote ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>{mismatchNote}</Text>
            </View>
          ) : null}
        </View>

        {(immediateSteps && immediateSteps.length && (rawApi?.render_mode !== 'pivot')) ? (
          <View>
            <Text style={styles.sectionTitle}>Immediate Next Steps</Text>
            <View style={styles.hr} />
            <View style={styles.box}>
              {immediateSteps.slice(0,6).map((s: string, idx: number) => (
                <Text key={idx}>• {s}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {(verticalizationSteps && verticalizationSteps.length && (rawApi?.render_mode !== 'pivot')) ? (
          <View>
            <Text style={styles.sectionTitle}>Verticalization (within PM)</Text>
            <View style={styles.hr} />
            <View style={styles.box}>
              {verticalizationSteps.slice(0,6).map((s: string, idx: number) => (
                <Text key={idx}>• {s}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {(truePivotSteps && truePivotSteps.length && (rawApi?.render_mode === 'pivot' || status === 'NO-GO')) ? (
          <View>
            <Text style={styles.sectionTitle}>Pivot Strategies</Text>
            <View style={styles.hr} />
            <View style={styles.box}>
              <Text style={{ color: '#475569', marginBottom: 6 }}>These are fundamental pivots, not improvement steps. If you want vertical landing pages or workflows, see the Improvement sections.</Text>
              {filterTruePivots(truePivotSteps).slice(0,6).map((s: string, idx: number) => (
                <Text key={idx}>• {s}</Text>
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionTitle}>Personalized Context</Text>
          <View style={styles.hr} />
          <View style={styles.box}>
            <Text><Text style={styles.label}>User Type:</Text> {survey.userType || '—'}</Text>
            <Text><Text style={styles.label}>Biggest Challenge:</Text> {survey.biggestChallenge || '—'}</Text>
            <Text><Text style={styles.label}>Used AI Tools:</Text> {survey.usedAITools || '—'}</Text>
            <Text><Text style={styles.label}>Would Try App:</Text> {survey.wouldTryApp || '—'}</Text>
            {!!survey.platformFeatures?.length && (
              <Text><Text style={styles.label}>Desired Features:</Text> {survey.platformFeatures.join(', ')}</Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>© {new Date().getFullYear()} BizSproutAI</Text>
          <Text>bizsproutai.com</Text>
        </View>
      </Page>
    </Document>
  );
}

export default PdfReport;
