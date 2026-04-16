import Papa from "papaparse";
import { v5 as uuidv5 } from "uuid";
import type { TransactionCategory } from "../types";

// Deterministic namespace UUID for our app (generated once, never changes)
const NAMESPACE_UUID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

/**
 * Generate a deterministic UUID from a seed string.
 * Re-importing the same data will produce the same IDs, preventing duplicates.
 */
export function deterministicId(seed: string): string {
  return uuidv5(seed, NAMESPACE_UUID);
}

/**
 * Parse CSV content using papaparse with sensible defaults.
 * Returns an array of row objects keyed by header names.
 */
export function parseCSV<T = Record<string, string>>(
  csvContent: string,
  options?: { skipLines?: number }
): T[] {
  // Some exports (e.g. Schwab) have disclaimer lines before the actual CSV.
  // Allow callers to skip leading lines.
  let content = csvContent.trim();

  if (options?.skipLines && options.skipLines > 0) {
    const lines = content.split(/\r?\n/);
    content = lines.slice(options.skipLines).join("\n");
  }

  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  return result.data;
}

/**
 * Parse a dollar amount string into a number.
 * Handles: "$1,234.56", "-$500.00", "($100.00)", "1234.56", "", "--"
 */
export function parseDollar(raw: string | undefined | null): number {
  if (!raw || raw === "--" || raw === "N/A" || raw === "n/a") return 0;

  let cleaned = raw.trim();

  // Handle parenthetical negatives: ($100.00) -> -100.00
  const isParenNeg = cleaned.startsWith("(") && cleaned.endsWith(")");
  if (isParenNeg) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove dollar signs and commas
  cleaned = cleaned.replace(/[$,]/g, "");

  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;

  return isParenNeg ? -Math.abs(value) : value;
}

/**
 * Parse a quantity string into a number.
 * Handles: "100", "1,000.5", "", "--"
 */
export function parseQuantity(raw: string | undefined | null): number {
  if (!raw || raw === "--" || raw === "N/A" || raw === "n/a") return 0;
  const cleaned = raw.trim().replace(/,/g, "");
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

/**
 * Parse a percentage string into a decimal number.
 * Handles: "12.34%", "-5.6%", "+3.2%", ""
 */
export function parsePercent(raw: string | undefined | null): number {
  if (!raw || raw === "--" || raw === "N/A" || raw === "n/a") return 0;
  const cleaned = raw.trim().replace(/[%,+]/g, "");
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

/**
 * Normalize various date formats into ISO date string (YYYY-MM-DD).
 * Handles: "01/15/2024", "2024-01-15", "Jan 15, 2024", "1/5/24", "2024-01-15T..."
 */
export function normalizeDate(raw: string | undefined | null): string {
  if (!raw || raw.trim() === "") return new Date().toISOString().split("T")[0];

  const cleaned = raw.trim();

  // Already ISO format: 2024-01-15 or 2024-01-15T...
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.split("T")[0];
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashFull = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashFull) {
    const [, m, d, y] = slashFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YY or M/D/YY
  const slashShort = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    const [, m, d, yy] = slashShort;
    const fullYear = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "Jan 15, 2024" or "January 15, 2024"
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const namedMonth = cleaned.match(
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/
  );
  if (namedMonth) {
    const [, monthStr, day, year] = namedMonth;
    const mm = monthNames[monthStr.toLowerCase().slice(0, 3)];
    if (mm) {
      return `${year}-${mm}-${day.padStart(2, "0")}`;
    }
  }

  // "15 Jan 2024" format
  const dayFirst = cleaned.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
  );
  if (dayFirst) {
    const [, day, monthStr, year] = dayFirst;
    const mm = monthNames[monthStr.toLowerCase().slice(0, 3)];
    if (mm) {
      return `${year}-${mm}-${day.padStart(2, "0")}`;
    }
  }

  // Coinbase ISO with timezone: "2024-01-15T14:30:00Z"
  const isoFull = cleaned.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoFull) {
    return isoFull[1];
  }

  // Fallback: try Date constructor
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Infer a transaction category from the description text.
 * Uses keyword matching with priority ordering.
 */
export function inferCategory(
  description: string,
  amount?: number
): TransactionCategory {
  const desc = description.toLowerCase();

  // Income patterns
  if (
    /\b(payroll|direct dep|salary|wages|venmo.*(from|payment)|zelle.*(from|received)|ach credit|tax refund)\b/.test(desc)
  ) {
    return "income";
  }

  // Investment patterns
  if (/\b(buy|bought|purchase|reinvest|contribution)\b/.test(desc)) {
    return "investment_buy";
  }
  if (/\b(sell|sold|redemption|distribution)\b/.test(desc)) {
    return "investment_sell";
  }
  if (/\b(dividend|div|capital gain|interest earned|apy)\b/.test(desc)) {
    return "investment_dividend";
  }

  // Transfer patterns
  if (
    /\b(transfer|xfer|wire|ach|zelle sent|venmo.*(to|sent)|payment thank|autopay)\b/.test(desc)
  ) {
    return "transfer";
  }

  // Fee patterns
  if (/\b(fee|charge|penalty|late charge|annual fee|finance charge|overdraft)\b/.test(desc)) {
    return "fee";
  }

  // Rent / Mortgage
  if (/\b(rent|lease|mortgage|hoa|landlord|property mgmt)\b/.test(desc)) {
    return "rent";
  }

  // Utilities
  if (
    /\b(electric|gas bill|water bill|sewer|trash|internet|comcast|xfinity|at&t|verizon|t-mobile|sprint|spectrum|cox|utility|utilities|pg&e|con ed|duke energy)\b/.test(desc)
  ) {
    return "utilities";
  }

  // Insurance
  if (
    /\b(insurance|geico|progressive|state farm|allstate|anthem|aetna|cigna|united health|humana|metlife|usaa)\b/.test(desc)
  ) {
    return "insurance";
  }

  // Subscriptions
  if (
    /\b(netflix|spotify|hulu|disney|hbo|apple\s*(tv|music|one|icloud)|youtube|amazon prime|audible|dropbox|adobe|microsoft 365|chatgpt|openai|github|notion|figma|slack|zoom|peloton|crunch|planet fitness|gym|membership)\b/.test(desc)
  ) {
    return "subscriptions";
  }

  // Food & Dining
  if (
    /\b(restaurant|mcdonald|starbucks|chipotle|chick-fil-a|wendy|burger|pizza|taco|sushi|doordash|uber eats|grubhub|instacart|whole foods|trader joe|kroger|safeway|publix|aldi|costco|walmart.*grocer|target.*grocer|grocery|groceries|food|dine|dining|cafe|coffee|bakery|deli)\b/.test(desc)
  ) {
    return "food";
  }

  // Transportation
  if (
    /\b(uber(?!\s*eats)|lyft|gas station|shell|chevron|bp|exxon|mobil|tesla supercharger|parking|toll|ez-?pass|metro|transit|subway|amtrak|airline|flight|delta|united|american air|southwest|jetblue|car wash|auto|vehicle|mechanic|tire|oil change)\b/.test(desc)
  ) {
    return "transportation";
  }

  // Healthcare
  if (
    /\b(doctor|hospital|clinic|urgent care|pharmacy|cvs|walgreens|rite aid|medical|dental|dentist|optometrist|vision|lab|quest diagnostics|labcorp|therapist|mental health|copay)\b/.test(desc)
  ) {
    return "healthcare";
  }

  // Entertainment
  if (
    /\b(movie|cinema|amc|regal|theater|concert|ticket|ticketmaster|live nation|stubhub|steam|playstation|xbox|nintendo|game|bar|club|lounge|bowling|golf|ski|museum|zoo|aquarium|theme park|dave|buster)\b/.test(desc)
  ) {
    return "entertainment";
  }

  // Shopping
  if (
    /\b(amazon|walmart|target|costco|best buy|home depot|lowes|ikea|wayfair|etsy|ebay|nike|adidas|zara|h&m|nordstrom|macy|tj\s*maxx|marshalls|ross|old navy|gap|apple store|shop|store|retail|clothing|apparel|furniture)\b/.test(desc)
  ) {
    return "shopping";
  }

  return "other";
}

/**
 * Infer a more specific subcategory from description text.
 */
export function inferSubcategory(description: string): string | undefined {
  const desc = description.toLowerCase();

  if (/\b(starbucks|coffee|cafe|dunkin)\b/.test(desc)) return "coffee";
  if (/\b(doordash|uber eats|grubhub|postmates)\b/.test(desc))
    return "delivery";
  if (/\b(restaurant|dine|dining)\b/.test(desc)) return "dining_out";
  if (/\b(grocery|groceries|whole foods|trader joe|kroger|safeway|publix|aldi)\b/.test(desc))
    return "groceries";
  if (/\b(uber(?!\s*eats)|lyft)\b/.test(desc)) return "rideshare";
  if (/\b(gas station|shell|chevron|bp|exxon|mobil)\b/.test(desc))
    return "gas";
  if (/\b(amazon)\b/.test(desc)) return "amazon";
  if (/\b(netflix|spotify|hulu|disney|hbo)\b/.test(desc)) return "streaming";

  return undefined;
}

/**
 * Get today's date as ISO string.
 */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
