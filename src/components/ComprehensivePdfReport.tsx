import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { ComprehensiveReportGenerator } from '@/lib/comprehensiveReportGenerator';
import type { 
  ScoreSummaryInput, 
  FinancialRealityInput, 
  PivotSuggestionBundle 
} from '@/lib/comprehensiveReportGenerator';

export interface SurveyData {
  name?: string;
  email?: string;
  userType?: string;
  biggestChallenge?: string;
  usedAITools?: string;
  wouldTryApp?: string;
  businessBarriers?: string[];
  platformFeatures?: string[];
  mustHaveFeature?: string;
  suggestions?: string;
}

export interface ValidationScores {
  overall?: number;
  demand?: number;
  urgency?: number;
  moat?: number;
  economics?: number;
  distribution?: number;
}

export interface ValidationApiData {
  summary?: {
    headline?: string;
    immediate_action?: string[];
  };
  recommendedPivotStrategies?: string[];
  benchmarks_comparison?: {
    current_category_score?: number;
    successful_verticals_score?: number;
    note?: string;
  };
  [key: string]: unknown; // Allow other properties
}

export interface ComprehensivePdfReportProps {
  idea: string;
  avg: number | null;
  status: 'GO' | 'REVIEW' | 'NO-GO' | undefined;
  highlights: string[];
  scores?: ValidationScores;
  survey: SurveyData;
  logoUrl?: string;
  rawApi?: ValidationApiData; // More specific typing with fallback
}

const styles = StyleSheet.create({
  page: { 
    padding: 36, 
    fontSize: 11, 
    fontFamily: 'Helvetica',
    color: '#1f2937'
  },
  
  // Header styles
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '2px solid #3b82f6',
    backgroundColor: '#ffffff',
    position: 'relative',
    zIndex: 10,
    overflow: 'hidden'
  },
  logo: { 
    width: 32, 
    height: 32, 
    marginRight: 12 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#0f172a',
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 2,
    zIndex: 20,
    position: 'relative'
  },
  subtitle: { 
    fontSize: 12, 
    color: '#64748b', 
    backgroundColor: '#ffffff',
    paddingVertical: 2,
    paddingHorizontal: 2,
    zIndex: 15,
    position: 'relative'
  },
  
  // Executive summary styles
  executiveSummary: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20
  },
  decisionBanner: {
    textAlign: 'center',
    marginBottom: 12,
    padding: 12,
    borderRadius: 6
  },
  decisionText: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  confidenceText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: 'semibold'
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 8
  },
  
  // Section styles - Enhanced professional layout
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '2px solid #3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  
  // Content styles - Enhanced spacing and readability
  contentBox: { 
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
  },
  
  // Score styles - Enhanced for professional look
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8
  },
  scoreCard: {
    width: '48%',
    padding: 4
  },
  scoreInner: {
    backgroundColor: '#ffffff',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    padding: 16,
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  scoreDimension: {
    fontSize: 11,
    color: '#374151',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8
  },
  scoreExplanation: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.4,
    textAlign: 'center'
  },
  
  // List styles
  bulletList: {
    marginLeft: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  bulletItem: {
    marginBottom: 4,
    fontSize: 11,
    lineHeight: 1.4,
    color: '#374151',
  },
  
  // Financial styles (Enhanced for benchmarks)
  financialGrid: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  financialItem: {
    flex: 1,
    marginRight: 12,
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  
  // Warning styles
  warningBox: { 
    border: '1px solid #fed7aa', 
    backgroundColor: '#fef3c7', 
    borderRadius: 6, 
    padding: 12, 
    marginTop: 12 
  },
  warningText: { 
    color: '#92400e', 
    fontSize: 10,
    lineHeight: 1.4
  },
  
  // Pivot styles
  pivotCard: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12
  },
  pivotTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0c4a6e',
    marginBottom: 6
  },
  pivotReasoning: {
    fontSize: 11,
    color: '#0369a1',
    lineHeight: 1.4,
    marginBottom: 8
  },
  
  // Footer styles - Enhanced professional design
  footer: { 
    position: 'absolute',
    bottom: 30,
    left: 36,
    right: 36,
    borderTop: '2px solid #e5e7eb', 
    paddingTop: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9,
    color: '#6b7280'
  }
});

function getDecisionColor(status: string) {
  switch (status) {
    case 'GO': return { backgroundColor: '#dcfce7', color: '#166534' };
    case 'REVIEW': return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'NO-GO': return { backgroundColor: '#fee2e2', color: '#dc2626' };
    default: return { backgroundColor: '#f1f5f9', color: '#475569' };
  }
}

function formatCurrency(amount: unknown): string {
  if (typeof amount === 'number') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: amount >= 1000000 ? 'compact' : 'standard'
    }).format(amount);
  }
  return '—';
}

export function ComprehensivePdfReport({ 
  idea, 
  avg, 
  status, 
  logoUrl = '/brand-logo.svg', 
  rawApi 
}: ComprehensivePdfReportProps) {
  
  // Safely access nested properties with type assertion
  const apiData = (rawApi as ValidationApiData) || {};
  const scoresData = (apiData.scores || {}) as Record<string, number>;
  const financialData = (apiData.financial_analysis || {}) as Record<string, unknown>;
  
  // Generate comprehensive report using the report generator
  const comprehensiveReport = ComprehensiveReportGenerator.generateFullReport(
    idea,
    { 
      overall: scoresData.overall || avg || 0, // Prioritize API's overall score over calculated average
      // Map to live site 5-dimension format
      demand: scoresData.demand_signals || scoresData.problem || 0,
      urgency: scoresData.underserved || scoresData.urgency || 0,
      moat: scoresData.differentiation || scoresData.moat || 0,
      distribution: scoresData.gtm || scoresData.distribution || 0,
      economics: scoresData.wtp || scoresData.economics || 0
    } as ScoreSummaryInput,
    apiData.market_intelligence || {},
    {
      unitEconomics: financialData.unitEconomics,
      breakeven: financialData.breakeven,
      realisticModel: financialData.realisticModel,
      warnings: financialData.warnings
    } as FinancialRealityInput,
    apiData.pivot_recommendations as PivotSuggestionBundle
  );

  const date = new Date().toLocaleDateString();
  const decisionStyle = getDecisionColor(status || 'REVIEW');

  // Live site style score mapping - scores are already 0-100 from API
  const liveScores = [
    { dimension: 'DEMAND', score: scoresData.demand_signals || scoresData.problem || 0 },
    { dimension: 'URGENCY', score: scoresData.underserved || scoresData.urgency || 0 },
    { dimension: 'MOAT', score: scoresData.differentiation || scoresData.moat || 0 },
    { dimension: 'DISTRIBUTION', score: scoresData.gtm || scoresData.distribution || 0 },
    { dimension: 'ECONOMICS', score: scoresData.wtp || scoresData.economics || 0 }
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.logo} src={logoUrl} />
          <View style={{ flex: 1, backgroundColor: '#ffffff', position: 'relative' }}>
            <Text style={styles.title}>Business Validation Report</Text>
            <Text style={styles.subtitle}>Generated on {date} • BizSproutAI</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <View style={styles.executiveSummary}>
          <View style={[styles.decisionBanner, decisionStyle]}>
            <Text style={styles.decisionText}>
              {status || 'REVIEW'}
            </Text>
            <Text style={styles.confidenceText}>
              Confidence: {Math.round(scoresData.overall || avg || 0)}%
            </Text>
          </View>
          
          <Text style={styles.summaryText}>
            <Text style={{ fontWeight: 'bold' }}>Business Idea: </Text>
            {idea}
          </Text>
          
          <Text style={styles.summaryText}>
            <Text style={{ fontWeight: 'bold' }}>One-Line Summary: </Text>
            {comprehensiveReport.executiveSummary.oneLineSummary}
          </Text>
          
          {comprehensiveReport.executiveSummary.keyFinding && (
            <Text style={styles.summaryText}>
              <Text style={{ fontWeight: 'bold' }}>Key Finding: </Text>
              {comprehensiveReport.executiveSummary.keyFinding}
            </Text>
          )}
        </View>

        {/* Detailed Scoring - Live Site Format */}
        <Text style={styles.sectionTitle}>Detailed Scoring Analysis</Text>
        <View style={styles.scoreGrid}>
          {liveScores.map((scoreData, index) => (
            <View key={index} style={styles.scoreCard}>
              <View style={styles.scoreInner}>
                <Text style={styles.scoreDimension}>{scoreData.dimension}</Text>
                <Text style={styles.scoreValue}>{scoreData.score.toFixed(1)}/100</Text>
                <Text style={styles.scoreExplanation}>
                  {comprehensiveReport.detailedScores.find(s => 
                    s.dimension.toUpperCase().includes(scoreData.dimension)
                  )?.reasoning || (() => {
                    switch(scoreData.dimension) {
                      case 'DEMAND': return 'Market demand analysis based on search volume, competitor presence, and customer validation signals';
                      case 'URGENCY': return 'Assessment of market timing, pain point severity, and competitive urgency factors';
                      case 'MOAT': return 'Competitive differentiation analysis including barriers to entry and unique value proposition';
                      case 'DISTRIBUTION': return 'Go-to-market viability assessment covering channels, customer acquisition, and scalability';
                      case 'ECONOMICS': return 'Unit economics evaluation including pricing power, cost structure, and profitability potential';
                      default: return 'Comprehensive market and business model analysis across multiple validation criteria';
                    }
                  })()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Market Intelligence */}
        <Text style={styles.sectionTitle}>Market Intelligence</Text>
        <View style={styles.contentBox}>
          <View style={styles.financialGrid}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Market Size</Text>
              <Text style={styles.financialValue}>
                {comprehensiveReport.marketIntelligence.overview.size || 'Unknown'}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Growth Rate</Text>
              <Text style={styles.financialValue}>
                {comprehensiveReport.marketIntelligence.overview.growth || 'Unknown'}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Saturation</Text>
              <Text style={styles.financialValue}>
                {comprehensiveReport.marketIntelligence.overview.saturation || 'Unknown'}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Avg CAC</Text>
              <Text style={styles.financialValue}>
                {comprehensiveReport.marketIntelligence.overview.avgCAC}
              </Text>
            </View>
          </View>
          
          {comprehensiveReport.marketIntelligence.competitors.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Key Competitors</Text>
              <View style={styles.bulletList}>
                {comprehensiveReport.marketIntelligence.competitors.slice(0, 4).map((competitor, index) => (
                  <Text key={index} style={styles.bulletItem}>
                    • {competitor.name} - {competitor.valuation} ({competitor.marketShare})
                  </Text>
                ))}
              </View>
            </>
          )}
          
          {comprehensiveReport.marketIntelligence.barriers.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Market Barriers</Text>
              <View style={styles.bulletList}>
                {comprehensiveReport.marketIntelligence.barriers.slice(0, 5).map((barrier, index) => (
                  <Text key={index} style={styles.bulletItem}>• {barrier}</Text>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Financial Reality */}
        <Text style={styles.sectionTitle}>Financial Analysis</Text>
        <View style={styles.contentBox}>
          {comprehensiveReport.financialReality.startupCosts && (
            <>
              <Text style={styles.subsectionTitle}>Startup Costs</Text>
              <Text style={styles.bulletItem}>
                Estimated startup investment: {formatCurrency(comprehensiveReport.financialReality.startupCosts)}
              </Text>
            </>
          )}
          
          {comprehensiveReport.financialReality.unitEconomics && (
            <>
              <Text style={styles.subsectionTitle}>Unit Economics</Text>
              <View style={styles.financialGrid}>
                {comprehensiveReport.financialReality.unitEconomics.calculations?.paybackMonths && (
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>Payback Period</Text>
                    <Text style={styles.financialValue}>
                      {comprehensiveReport.financialReality.unitEconomics.calculations.paybackMonths} months
                    </Text>
                  </View>
                )}
                {comprehensiveReport.financialReality.unitEconomics.calculations?.ltvCacRatio && (
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>LTV:CAC Ratio</Text>
                    <Text style={styles.financialValue}>
                      {comprehensiveReport.financialReality.unitEconomics.calculations.ltvCacRatio.toFixed(1)}:1
                    </Text>
                  </View>
                )}
                {comprehensiveReport.financialReality.unitEconomics.calculations?.monthlyRevenue && (
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>Monthly Revenue</Text>
                    <Text style={styles.financialValue}>
                      {formatCurrency(comprehensiveReport.financialReality.unitEconomics.calculations.monthlyRevenue)}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
          
          {comprehensiveReport.financialReality.breakeven && (
            <>
              <Text style={styles.subsectionTitle}>Breakeven Analysis</Text>
              <View style={styles.financialGrid}>
                {comprehensiveReport.financialReality.breakeven.timeMonths && (
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>Time to Breakeven</Text>
                    <Text style={styles.financialValue}>
                      {comprehensiveReport.financialReality.breakeven.timeMonths} months
                    </Text>
                  </View>
                )}
                {comprehensiveReport.financialReality.breakeven.customerCount && (
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>Customers Needed</Text>
                    <Text style={styles.financialValue}>
                      {comprehensiveReport.financialReality.breakeven.customerCount.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
          
          {comprehensiveReport.financialReality.warnings.length > 0 && (
            <View style={styles.warningBox}>
              <Text style={[styles.warningText, { fontWeight: 'bold', marginBottom: 4 }]}>
                Financial Warnings
              </Text>
              {comprehensiveReport.financialReality.warnings.slice(0, 3).map((warning, index) => (
                <Text key={index} style={styles.warningText}>• {warning}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Recommended Actions */}
        <Text style={styles.sectionTitle}>Recommended Action Plan</Text>
        <View style={styles.contentBox}>
          <Text style={[styles.subsectionTitle, { color: '#dc2626' }]}>
            Timeline: {comprehensiveReport.recommendedActions.timeline}
          </Text>
          
          {'immediate' in comprehensiveReport.recommendedActions && (
            <>
              <Text style={styles.subsectionTitle}>Immediate Actions</Text>
              <View style={styles.bulletList}>
                {comprehensiveReport.recommendedActions.immediate.map((action, index) => (
                  <Text key={index} style={styles.bulletItem}>• {action}</Text>
                ))}
              </View>
            </>
          )}
          
          {'firstWeek' in comprehensiveReport.recommendedActions && comprehensiveReport.recommendedActions.firstWeek && (
            <>
              <Text style={styles.subsectionTitle}>First Week</Text>
              <View style={styles.bulletList}>
                {comprehensiveReport.recommendedActions.firstWeek.map((action, index) => (
                  <Text key={index} style={styles.bulletItem}>• {action}</Text>
                ))}
              </View>
            </>
          )}
          
          {'next30Days' in comprehensiveReport.recommendedActions && comprehensiveReport.recommendedActions.next30Days && (
            <>
              <Text style={styles.subsectionTitle}>Next 30 Days</Text>
              <View style={styles.bulletList}>
                {comprehensiveReport.recommendedActions.next30Days.map((action, index) => (
                  <Text key={index} style={styles.bulletItem}>• {action}</Text>
                ))}
              </View>
            </>
          )}
          
          {'monthOne' in comprehensiveReport.recommendedActions && comprehensiveReport.recommendedActions.monthOne && (
            <>
              <Text style={styles.subsectionTitle}>Month One</Text>
              <View style={styles.bulletList}>
                {comprehensiveReport.recommendedActions.monthOne.map((action, index) => (
                  <Text key={index} style={styles.bulletItem}>• {action}</Text>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Pivot Recommendations - Live Site Style */}
        {(status === 'NO-GO' || comprehensiveReport.pivotOpportunities) && (
          <>
            <Text style={styles.sectionTitle}>Pivot Recommendations</Text>
            <View style={styles.contentBox}>
              <Text style={[styles.subsectionTitle, { color: '#dc2626' }]}>
                NO-GO: Pivot before investing more
              </Text>
              <Text style={[styles.summaryText, { marginBottom: 12 }]}>
                {apiData.summary?.headline || 'Current market constraints suggest exploring alternative approaches'}
              </Text>
              
              {apiData.recommendedPivotStrategies && apiData.recommendedPivotStrategies.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Recommended Pivot Strategies</Text>
                  <View style={styles.bulletList}>
                    {apiData.recommendedPivotStrategies.slice(0, 4).map((strategy: string, index: number) => (
                      <Text key={index} style={styles.bulletItem}>• {strategy}</Text>
                    ))}
                  </View>
                </>
              )}

              {apiData.summary?.immediate_action && apiData.summary.immediate_action.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Immediate Actions</Text>
                  <View style={styles.bulletList}>
                    {apiData.summary.immediate_action.slice(0, 3).map((action: string, index: number) => (
                      <Text key={index} style={styles.bulletItem}>• {action}</Text>
                    ))}
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* Benchmarks - Live Site Style */}
        {apiData.benchmarks_comparison && (
          <>
            <Text style={styles.sectionTitle}>Benchmarks</Text>
            <View style={styles.contentBox}>
              <View style={styles.financialGrid}>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>You now</Text>
                  <Text style={[styles.financialValue, { fontSize: 18, color: '#dc2626' }]}>
                    {Math.round(scoresData.overall || avg || 0)}%
                  </Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Successful verticals</Text>
                  <Text style={[styles.financialValue, { fontSize: 18, color: '#10b981' }]}>
                    {apiData.benchmarks_comparison?.successful_verticals_score || 75}%
                  </Text>
                </View>
              </View>
              {apiData.benchmarks_comparison.note && (
                <Text style={[styles.summaryText, { marginTop: 8, fontSize: 10, color: '#6b7280' }]}>
                  {apiData.benchmarks_comparison.note}
                </Text>
              )}
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>© {new Date().getFullYear()} BizSproutAI</Text>
          <Text>bizsproutai.com • Comprehensive Validation Report</Text>
        </View>
      </Page>
    </Document>
  );
}

export default ComprehensivePdfReport;