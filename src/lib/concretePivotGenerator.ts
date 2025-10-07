export type PivotIdea = {
  title: string;
  rationale: string;
  marketIntel?: {
    size?: string;
    growth?: string;
    competition?: string;
    urgency?: string;
  };
  differentiators?: string[];
  validationPlan?: Record<string, string>;
  successMetrics?: Record<string, string>;
};

export class ConcretePivotGenerator {
  static generateProjectManagementPivots() {
    return {
      primary: {
        title: "Construction Project Management",
        rationale: "Construction has unique requirements not served by generic PM tools",
        marketIntel: {
          size: "$2.1B construction project management software market",
          growth: "8.4% CAGR",
          competition: "Fragmented - mostly legacy desktop solutions",
          urgency: "High - regulatory compliance, safety, cost overruns",
        },
        differentiators: [
          "Built-in permit tracking and approval workflows",
          "Safety incident reporting and OSHA compliance",
          "Weather delay impact modeling",
          "Subcontractor payment management with lien tracking",
          "Photo documentation with GPS/timestamp for inspections",
        ],
        validationPlan: {
          week1: "Interview 10 construction project managers about daily pain points",
          week2: "Shadow construction teams to observe workflow inefficiencies",
          week3: "Survey 50+ construction professionals on software buying criteria",
          week4: "Create mockups of construction-specific features for feedback",
        },
        successMetrics: {
          problemValidation: "80%+ confirm permit tracking is major pain point",
          willingnessToPay: "60%+ willing to pay $150+/month for construction-specific solution",
          marketSize: "Identify 500+ construction companies in target geography",
        },
        industry: "construction",
      },
      alternatives: [
        {
          title: "Legal Case Management",
          rationale: "Law firms have strict compliance needs and billable hour tracking requirements",
          quickValidation: "Interview 5 small law firm partners about case management pain points",
          marketSize: "$1.8B legal practice management market growing 7.2% annually",
          industry: "legal",
        },
        {
          title: "Healthcare Compliance Tracking",
          rationale: "Healthcare has mandatory compliance reporting with severe penalties for non-compliance",
          quickValidation: "Research specific compliance frameworks (HIPAA, Joint Commission, CMS)",
          marketSize: "$15B healthcare compliance market growing 12% annually",
          industry: "healthcare",
        },
        {
          title: "Restaurant Operations Management",
          rationale: "Restaurants have unique inventory, scheduling, and compliance challenges",
          quickValidation: "Visit 10 local restaurants and interview managers about operational pain points",
          marketSize: "$4.2B restaurant management software market",
          industry: "restaurant",
        },
      ],
    } as const;
  }

  static generateValidationTemplate(pivot: { industry: string }) {
    return {
      customerDiscovery: {
        questions: [
          `What\'s the most time-consuming part of your current ${pivot.industry} workflow?`,
          `How much time do you spend on the hardest part of your ${pivot.industry} process each week?`,
          `What tools do you currently use and what frustrates you about them?`,
          `If you could reduce this workload by 50%, what would you pay?`,
          `Who else in your organization would need to approve this purchase?`,
        ],
        targetInterviews: 15,
        successCriteria: "80%+ identify same top 3 pain points",
      },
      marketValidation: {
        researchTasks: [
          "Size the addressable market using industry reports",
          "Map existing solutions and their pricing",
          "Identify industry conferences and trade publications",
          "Research regulatory requirements and compliance needs",
        ],
      },
    } as const;
  }
}

export default ConcretePivotGenerator;
