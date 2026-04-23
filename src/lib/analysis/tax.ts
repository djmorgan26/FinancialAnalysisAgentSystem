/**
 * Simplified effective tax-rate estimate (federal + state combined).
 * Bucketed by annual gross income. Good enough for paycheck-bucket
 * estimates and 10-year projections — not a replacement for a CPA.
 */
export function estimateTaxRate(annualGross: number): number {
  if (annualGross <= 44725) return 0.22;
  if (annualGross <= 95375) return 0.26;
  if (annualGross <= 182100) return 0.28;
  if (annualGross <= 231250) return 0.30;
  return 0.33;
}
