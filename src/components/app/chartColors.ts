/**
 * Static hex palette for the three Recharts components
 * (FinancialSimulation, CashFlow6Mo, PaycheckAllocation).
 * We avoid runtime CSS-var reads to keep chart code synchronous.
 * Trade-off: these three charts don't retheme on theme switch.
 */
export const chartColors = {
  accent: "#7aa8ff",
  accentStrong: "#4f8cff",
  gain: "#3fb68b",
  loss: "#e26b6b",
  warn: "#d9a74a",
  muted: "#8b93a7",
  border: "#2a2f3a",
  text: "#e6e9ef",
  textMuted: "#8b93a7",
  textFaint: "#5c6475",
  bgInset: "#181c24",
};

/** Named bucket palette used by PaycheckAllocation. */
export const bucketPalette = [
  "#4f8cff", // primary — investments
  "#3fb68b", // gain — savings / emergency
  "#d9a74a", // warn — discretionary
  "#a78bfa", // violet — dry powder
  "#60a5fa", // sky — other
];

/** Category palette for SpendingCategories (top-N rows). */
export const categoryColors: Record<string, string> = {
  rent: "#ef4444",
  utilities: "#f97316",
  insurance: "#f59e0b",
  food: "#84cc16",
  transportation: "#06b6d4",
  healthcare: "#8b5cf6",
  subscriptions: "#ec4899",
  entertainment: "#a78bfa",
  shopping: "#64748b",
  fee: "#475569",
  other: "#9ca3af",
};
