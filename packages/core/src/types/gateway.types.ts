// ============================================================
// Gateway domain types — usage tracking for the Accomplish AI
// free tier (credits, usage limits, reset schedule).
// ============================================================

export interface CreditUsage {
  spentCredits: number;
  remainingCredits: number;
  totalCredits: number;
  resetsAt: string;
}
