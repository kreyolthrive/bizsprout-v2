// Types for the Hybrid Business Validation System

export type RecommendationStatus = 'GO' | 'REVIEW' | 'NO-GO';

export interface AttributeSignals {
	Disruptive?: number;
	Defensible?: number;
	Discontinuous?: number;
	SocialNeed?: number;
	Growth?: number;
	Achievement?: number;
	Recognition?: number;
}

export interface ValidationInput {
	// Core description
	idea_text: string;
	target_customer?: string;
	b2x?: 'B2B' | 'B2C' | 'B2B2C' | 'Marketplace';

	// Problem and opportunity
	unavoidable?: number; // 0-10
	urgency?: number; // 0-10
	underserved?: number; // 0-10
	feasibility?: number; // 0-10
	pain_gain_ratio?: number; // 0-10
	whitespace?: number; // 0-10

	// Market quality (user-estimated, will be combined with research)
	tam_quality?: number; // 0-10 perceived
	growth_rate_quality?: number; // 0-10 perceived
		// Weight for external research vs user estimates (0..1). Default 0.6 (favor research)
		market_data_weight?: number;

	// Competitive landscape and differentiation
	competition_density?: number; // 0-10 (10 = many competitors, but used as signal)
	attributes?: AttributeSignals;

	// Demand validation signals
	interviews?: number; // count
	interviews_positive_pct?: number; // 0-100
	waitlist_signups?: number; // count
	waitlist_conv_rate_pct?: number; // 0-100
	lois?: number; // letters of intent
	preorders?: number; // count

	// Economics and pricing
	willingness_to_pay?: number; // 0-10 signal
	price_point?: number; // USD
	ltv_estimate?: number; // USD
	cac_estimate?: number; // USD

	// GTM
	channels_clarity?: number; // 0-10

	// Team & execution
	team_experience?: number; // 0-10
	capital_runway_months?: number; // months

	// Risk factors
	regulatory_risk?: number; // 0-10
	platform_dependency_risk?: number; // 0-10
	safety_risk?: number; // 0-10
	illegal_or_prohibited?: boolean;
}

export interface Scores {
	problem: number; // 0-10
	underserved: number; // 0-10
	feasibility: number; // 0-10
	differentiation: number; // 0-10
	demand_signals: number; // 0-10
	willingness_to_pay: number; // 0-10
	market_quality: number; // 0-10
	gtm: number; // 0-10
	execution: number; // 0-10
	risk: number; // 0-10 (higher is better/safer)
	overall: number; // 0-100
	// Optional business-specific scores
	network_effects?: number; // 0-10
	regulatory_compliance?: number; // 0-10
	supply_demand_balance?: number; // 0-10
	viral_potential?: number; // 0-10
}

export interface ValidateResponse {
	id: string;
	status: RecommendationStatus;
	value_prop: string;
	highlights: string[];
	risks: string[];
	scores: Scores;
	target_market?: string;
	title?: string;
	created_at?: string;
}

export interface QCRule {
	id: string;
	when: (context: unknown) => boolean;
	message: string;
	severity?: 'low' | 'med' | 'high';
}

export interface RedFlag {
	id: string;
	when: (context: unknown) => boolean;
	message: string;
	kill?: boolean; // true means automatic NO-GO
}

// Ensure this file is treated as a module even if only types are imported
export const __validationTypesModule = true;

