# Dev Tasks Checklist: Regulatory Gate Implementation

Copy/paste these as individual GitHub issues:

---

## 🏗️ Backend Task 1: Create Regulatory Gate Module

**Issue Title:** `[Backend] Create regulatory_gate module with rules, LLM research, and matrix lookup`

**Description:**
Create a comprehensive regulatory gate module that combines static rules, LLM-powered research, and compliance matrix lookups.

**Acceptance Criteria:**
- [ ] Create `src/lib/regulatory/` module structure
- [ ] Implement `runRegulatoryGate()` function from validationFramework.ts
- [ ] Integrate static RED_FLAGS rules with regex pattern matching
- [ ] Add LLM research integration using REGULATORY_RAG_PROMPTS
- [ ] Implement compliance matrix YAML lookup for business types
- [ ] Add platform policy validation (App Store, payment processors)
- [ ] Include HARM ethics scoring with 4-dimension assessment
- [ ] Generate compliant pivot suggestions on failure
- [ ] Return structured RegulatoryGateResult with evidence

**Technical Requirements:**
```typescript
// Expected module exports:
export { runComprehensiveRegulatoryGate } from './regulatory/gate'
export { REGULATORY_RAG_PROMPTS } from './regulatory/prompts'
export { calculateEthicsHARM } from './regulatory/ethics'
export { generateAutoPivots } from './regulatory/pivots'
export { REGULATORY_TEST_CASES } from './regulatory/testing'
```

**Files to Create:**
- `src/lib/regulatory/gate.ts` - Main regulatory analysis
- `src/lib/regulatory/prompts.ts` - LLM research prompts  
- `src/lib/regulatory/ethics.ts` - HARM rubric scoring
- `src/lib/regulatory/pivots.ts` - Compliant alternative generation
- `src/lib/regulatory/testing.ts` - QA test cases

---

## 🗄️ Backend Task 2: Add Regulatory Results Database Column

**Issue Title:** `[Backend] Add validation_results.regulatory jsonb column for Gate 0 persistence`

**Description:**
Add database persistence for regulatory gate analysis results with structured JSONB storage.

**Acceptance Criteria:**
- [ ] Add migration for `validation_results.regulatory` JSONB column
- [ ] Update ValidateResponse type to include regulatory data
- [ ] Persist RegulatoryGateResult in validation API
- [ ] Add database indexes for regulatory status queries
- [ ] Include regulatory data in validation retrieval

**Database Schema:**
```sql
-- Migration: add_regulatory_column.sql
ALTER TABLE validation_results 
ADD COLUMN regulatory JSONB;

-- Index for regulatory status filtering
CREATE INDEX idx_validation_results_regulatory_status 
ON validation_results USING GIN ((regulatory->>'status'));

-- Example stored structure:
{
  "gate_card": {
    "status": "REVIEW",
    "compliance_score": 67,
    "key_issues": ["Data collection without consent"],
    "recommended_action": "Legal review required"
  },
  "ethics_assessment": {
    "total_harm_score": 8,
    "ethics_flag": "MEDIUM",
    "concerns": ["AI bias potential"]
  },
  "compliant_pivots": [...],
  "evidence_precedents": [...]
}
```

**API Updates:**
- Update `POST /api/validate` to include regulatory analysis
- Update `GET /api/validate/:id` to return regulatory data
- Add regulatory filtering to validation list endpoints

---

## 💰 Backend Task 3: Inflate Financial Estimates from Compliance Matrix

**Issue Title:** `[Backend] Inflate startup_cost_estimate & time_to_market based on regulatory compliance costs`

**Description:**
Adjust financial projections based on regulatory compliance requirements using matrix-driven cost inflation.

**Acceptance Criteria:**
- [ ] Create regulatory compliance cost matrix by business type
- [ ] Implement cost inflation logic for different regulatory statuses
- [ ] Update domainFinancials() to include compliance costs
- [ ] Add time_to_market delays for regulatory review processes
- [ ] Include legal/compliance professional costs in estimates

**Cost Matrix Implementation:**
```typescript
export const REGULATORY_COST_MATRIX = {
  'health': {
    'REVIEW': { cost_multiplier: 2.5, time_delay_months: 6 },
    'FAIL': { cost_multiplier: 5.0, time_delay_months: 12 }
  },
  'fin': {
    'REVIEW': { cost_multiplier: 2.0, time_delay_months: 4 },
    'FAIL': { cost_multiplier: 4.0, time_delay_months: 8 }
  },
  'marketplace': {
    'REVIEW': { cost_multiplier: 1.8, time_delay_months: 3 },
    'FAIL': { cost_multiplier: 3.5, time_delay_months: 9 }
  }
  // ... other business types
}
```

**Financial Adjustments:**
- Legal consultation costs ($10k-$50k based on complexity)
- Compliance tool/system costs (SOC2, HIPAA, etc.)
- Regulatory filing fees and ongoing compliance
- Extended development time for compliance features
- Professional liability insurance premium increases

---

## 📊 Backend Task 4: Implement Regulatory Score Capping

**Issue Title:** `[Backend] Cap validation scores when regulatory.status !== 'PASS'`

**Description:**
Implement score capping logic to ensure regulatory failures appropriately limit overall validation scores.

**Acceptance Criteria:**
- [ ] Implement applyRegulatoryScoreCaps() function
- [ ] Cap demand ≤ 5 for REVIEW/FAIL status
- [ ] Cap moat ≤ 4 for regulatory uncertainty
- [ ] Cap distribution ≤ 3 for FAIL status (scaling difficulty)
- [ ] Cap economics ≤ 4 for FAIL status (compliance costs)
- [ ] Hard cap overall score ≤ 39 to force NO-GO/NEED WORK buckets
- [ ] Update decision logic to force NO-GO on regulatory FAIL

**Implementation:**
```typescript
// In validation scoring pipeline:
const regulatoryResult = await runComprehensiveRegulatoryGate(idea, businessType);
const regulatoryStatus = regulatoryResult.gate_card.status;

// Apply caps before final scoring
const cappedScores = applyRegulatoryScoreCaps(rawScores, regulatoryStatus);
const finalScore = overallScoreWithRegulatoryCaps(cappedScores, regulatoryStatus);
const decision = decisionWithRegulatory({ scores: cappedScores }, regulatoryStatus);
```

**Score Capping Rules:**
- PASS: No score modifications
- REVIEW: Demand ≤ 5, Moat ≤ 4, Overall ≤ 60
- FAIL: All caps + Distribution ≤ 3, Economics ≤ 4, Overall ≤ 39

---

## 📋 Backend Task 5: Update Report API with Regulatory Pages

**Issue Title:** `[Backend] Add "Product Scope" + Regulatory pages with citations to Report API`

**Description:**
Enhance the validation report API to include comprehensive regulatory analysis with legal citations and precedents.

**Acceptance Criteria:**
- [ ] Add regulatory section to PDF/report generation
- [ ] Include Product Scope page with regulatory considerations
- [ ] Add Evidence & Precedents section with clickable citations
- [ ] Include compliant pivot recommendations
- [ ] Add regulatory status stoplight visualization
- [ ] Disable/grey out downstream sections when Gate 0 fails

**Report Structure Updates:**
```typescript
export type ValidationReport = {
  // ... existing fields
  regulatory_section: {
    gate_card: RegulatoryGateCard;
    compliance_score: number;
    key_findings: string[];
    legal_citations: LegalCitation[];
    case_precedents: CaseStudy[];
    compliant_pivots?: CompliantPivot[];
    recommended_actions: string[];
  };
  product_scope: {
    regulatory_considerations: string[];
    compliance_requirements: string[];
    estimated_legal_costs: FinancialRange;
    time_to_compliance: string;
  };
}
```

**PDF Template Updates:**
- Gate 0 status card with red/yellow/green indicator
- Legal citations with proper formatting and links
- Case study precedents with outcomes and lessons
- Compliance cost breakdown
- Professional disclaimer for legal advice

---

## 🧪 Quality Assurance Tasks

### QA Task 1: Implement Red Team Testing Suite

**Issue Title:** `[QA] Implement automated red team testing for regulatory gate`

**Acceptance Criteria:**
- [ ] Implement REGULATORY_TEST_CASES automated testing
- [ ] Add negative test cases (data broker, biometric surveillance, etc.)
- [ ] Add positive control tests (anonymous benchmarking)
- [ ] Generate weekly QA metrics reports
- [ ] Track false positive/negative rates
- [ ] Set up manual spot-check validation process

### QA Task 2: Create Regulatory Compliance Dashboard

**Issue Title:** `[Frontend] Create regulatory compliance monitoring dashboard`

**Acceptance Criteria:**
- [ ] Show weekly block rates (% REVIEW/FAIL)
- [ ] Display test accuracy metrics
- [ ] Track top regulatory concerns
- [ ] Alert on unusual patterns or test failures
- [ ] Enable manual override for edge cases

---

## 🎨 Frontend Tasks

### Frontend Task 1: Regulatory Gate UI Components

**Issue Title:** `[Frontend] Implement regulatory gate stoplight UI with pivot pills`

**Acceptance Criteria:**
- [ ] Create RegulatoryGateCard component with status colors
- [ ] Implement CompliantPivot pills with one-click re-evaluation
- [ ] Add Evidence & Precedents section with citations
- [ ] Disable downstream tabs when Gate 0 fails
- [ ] Add loading states for LLM research calls

### Frontend Task 2: Enhanced Validation Report UI

**Issue Title:** `[Frontend] Add regulatory section to validation report interface`

**Acceptance Criteria:**
- [ ] Add regulatory tab to validation results
- [ ] Display compliance score and key issues
- [ ] Show legal citations with proper formatting
- [ ] Include case study precedents
- [ ] Add pivot suggestion interface with re-evaluation buttons

---

## 📚 Documentation Tasks

### Doc Task 1: Regulatory Framework Documentation

**Issue Title:** `[Docs] Document regulatory validation framework and compliance matrix`

**Acceptance Criteria:**
- [ ] Document HARM ethics rubric methodology
- [ ] Explain regulatory score capping logic
- [ ] Provide compliance cost matrix documentation
- [ ] Create legal citation formatting guidelines
- [ ] Add troubleshooting guide for regulatory edge cases

### Doc Task 2: API Documentation Updates

**Issue Title:** `[Docs] Update API documentation for regulatory endpoints`

**Acceptance Criteria:**
- [ ] Document regulatory data structures
- [ ] Add example API responses with regulatory data
- [ ] Explain score capping behavior
- [ ] Document pivot generation API
- [ ] Add legal disclaimer requirements

---

## 🚀 Deployment Tasks

### Deploy Task 1: Database Migration and Rollback Plan

**Issue Title:** `[DevOps] Plan regulatory column migration with rollback strategy`

**Acceptance Criteria:**
- [ ] Create forward and backward migration scripts
- [ ] Test migration on staging environment
- [ ] Plan zero-downtime deployment strategy
- [ ] Prepare rollback procedures
- [ ] Monitor regulatory analysis performance impact

### Deploy Task 2: Feature Flag Implementation

**Issue Title:** `[DevOps] Implement feature flags for regulatory gate rollout`

**Acceptance Criteria:**
- [ ] Add regulatory gate feature flag
- [ ] Enable gradual rollout by user percentage
- [ ] Add bypass flag for development/testing
- [ ] Monitor regulatory gate adoption metrics
- [ ] Plan full rollout strategy

---

## ⚡ Priority Order

1. **High Priority:** Backend Tasks 1, 2, 4 (Core functionality)
2. **Medium Priority:** Backend Tasks 3, 5 + Frontend Task 1 (Complete feature)
3. **Low Priority:** QA Tasks + Documentation (Quality & maintenance)

## 🔗 Dependencies

- Backend Task 1 → Backend Task 2 (Module before persistence)
- Backend Task 4 → Backend Task 1 (Score capping needs regulatory results)
- Frontend Task 1 → Backend Tasks 1, 2 (UI needs backend API)
- All QA Tasks → Backend Task 1 (Testing needs core functionality)

## ⏱️ Estimated Timeline

- **Sprint 1 (Week 1-2):** Backend Tasks 1, 2
- **Sprint 2 (Week 3-4):** Backend Tasks 3, 4 + Frontend Task 1
- **Sprint 3 (Week 5-6):** Backend Task 5 + QA Tasks + Documentation
- **Sprint 4 (Week 7-8):** Deployment + Monitoring + Refinements

## 🎯 Success Metrics

- [ ] 95%+ accuracy on negative test cases (risky ideas flagged)
- [ ] <5% false positive rate on positive controls
- [ ] <2s average regulatory analysis time
- [ ] 100% of FAIL status ideas blocked from proceeding
- [ ] Legal team approval of citation accuracy and recommendations
