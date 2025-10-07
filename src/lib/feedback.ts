// Progressive feedback helper for specificity/coherence gating
// Returns a short, actionable message based on a 0..100 score
export function getProgressiveFeedback(score: number): string {
  if (score >= 40 && score < 60) {
    return "You're getting closer! You have most elements defined, but need more detail in the missing areas to proceed with validation.";
  } else if (score >= 25 && score < 40) {
    return "You have some specificity, but several critical elements are still missing or too vague.";
  } else {
    return "Your idea needs much more specificity across all dimensions.";
  }
}
