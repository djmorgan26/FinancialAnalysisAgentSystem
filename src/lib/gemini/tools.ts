/**
 * Gemini function-calling tools. Each tool is executed server-side with the
 * caller's user_id already bound — the LLM never sees or sets the user scope.
 */
import {
  loadFinancialData,
  loadAnalysis,
  loadUserProfile,
  loadInvestmentPreferences,
  saveInvestmentPreferences,
  saveUserProfile,
  loadSyncLogs,
} from "@/lib/data-store";
import type { UserProfile } from "@/lib/types";

export const toolDeclarations = [
  {
    name: "getPortfolioSummary",
    description:
      "Returns net worth, total assets/liabilities, savings rate, asset allocation, and top holdings. Call this when the user asks about overall portfolio state.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getHoldings",
    description:
      "Returns every position the user holds across all accounts. Use when the user asks about specific tickers or wants a detailed list.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description:
            "Optional — if provided, filter to this ticker only (case-insensitive).",
        },
      },
      required: [],
    },
  },
  {
    name: "getSyncStatus",
    description:
      "Returns recent sync log entries (successes and errors) so the assistant can diagnose connection problems.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries (default 20)." },
      },
      required: [],
    },
  },
  {
    name: "getProfile",
    description:
      "Returns the user's demographic profile and risk/horizon preferences.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getPreferences",
    description:
      "Returns the user's investment preferences (Roth targets, caps, excluded tickers, etc.).",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "updatePreferences",
    description:
      "Mutate a subset of the user's investment preferences. ONLY call this after confirming with the user. Supply only the fields you want to change. Returns the updated preferences.",
    parameters: {
      type: "object",
      properties: {
        rothIraAnnualTarget: { type: "number" },
        rothIraYtdContributed: { type: "number" },
        roth401kPercent: { type: "number" },
        emergencyFundTarget: { type: "number" },
        cashFloorBrokerage: { type: "number" },
        singlePositionCapPercent: { type: "number" },
        coreAllocationMinPercent: { type: "number" },
        coreTickers: { type: "array", items: { type: "string" } },
        excludedTickers: { type: "array", items: { type: "string" } },
        allowSellRecommendations: { type: "boolean" },
        allowTaxLossHarvesting: { type: "boolean" },
        rebalanceDriftThresholdPercent: { type: "number" },
        notes: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "updateProfile",
    description:
      "Mutate whitelisted profile fields (risk tolerance, time horizon, sector bias, occupation, annual income, age). Do NOT attempt to change name/email/password via this tool. Confirm with the user first.",
    parameters: {
      type: "object",
      properties: {
        occupation: { type: "string" },
        annualIncome: { type: "number" },
        age: { type: "number" },
        riskTolerance: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
        },
        timeHorizon: {
          type: "string",
          enum: ["short", "medium", "long"],
        },
        sectorBias: { type: "array", items: { type: "string" } },
      },
      required: [],
    },
  },
  {
    name: "addExpense",
    description:
      "Add a fixed recurring expense to the user's profile (e.g. rent, subscription, insurance). Confirm with the user before calling. Duplicates (same name, case-insensitive) are rejected.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Label shown in the UI." },
        amount: {
          type: "number",
          description: "Dollar amount per period (positive number).",
        },
        frequency: {
          type: "string",
          enum: ["monthly", "quarterly", "annual"],
        },
      },
      required: ["name", "amount", "frequency"],
    },
  },
  {
    name: "removeExpense",
    description:
      "Remove a fixed expense by name (case-insensitive match). Confirm with the user before calling.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "setBudget",
    description:
      "Set or clear per-bucket monthly budget overrides. Each bucket (necessities, investments, discretionary, savings) is an optional monthly dollar amount. Supply only the buckets you want to change. Pass reset=true to clear all overrides and return to the computed budget. Confirm with the user before calling.",
    parameters: {
      type: "object",
      properties: {
        necessities: { type: "number" },
        investments: { type: "number" },
        discretionary: { type: "number" },
        savings: { type: "number" },
        reset: {
          type: "boolean",
          description: "When true, clear all overrides.",
        },
      },
      required: [],
    },
  },
];

export type ToolName = (typeof toolDeclarations)[number]["name"];

export async function runTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "getPortfolioSummary": {
      const [data, analysis] = await Promise.all([
        loadFinancialData(userId),
        loadAnalysis(userId),
      ]);
      const top = [...data.holdings]
        .sort((a, b) => b.currentValue - a.currentValue)
        .slice(0, 10)
        .map((h) => ({
          symbol: h.symbol,
          value: h.currentValue,
          gainLossPercent: h.gainLossPercent,
          account: data.accounts.find((a) => a.id === h.accountId)?.name,
        }));
      return {
        netWorth: analysis?.netWorth ?? null,
        totalAssets: analysis?.totalAssets ?? null,
        totalLiabilities: analysis?.totalLiabilities ?? null,
        savingsRate: analysis?.savingsRate ?? null,
        accountCount: data.accounts.length,
        positionCount: data.holdings.length,
        assetAllocation: analysis?.assetAllocation ?? [],
        sectorExposure: analysis?.sectorExposure ?? [],
        topHoldings: top,
        lastUpdated: data.lastUpdated,
      };
    }
    case "getHoldings": {
      const data = await loadFinancialData(userId);
      const sym = (args.symbol as string | undefined)?.toUpperCase();
      const list = sym
        ? data.holdings.filter((h) => h.symbol.toUpperCase() === sym)
        : data.holdings;
      return list.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        account: data.accounts.find((a) => a.id === h.accountId)?.name,
        quantity: h.quantity,
        costBasis: h.costBasis,
        currentPrice: h.currentPrice,
        currentValue: h.currentValue,
        gainLoss: h.gainLoss,
        gainLossPercent: h.gainLossPercent,
        assetClass: h.assetClass,
        sector: h.sector,
      }));
    }
    case "getSyncStatus": {
      const logs = await loadSyncLogs(userId, (args.limit as number) ?? 20);
      return logs.map((l) => ({
        createdAt: l.createdAt,
        source: l.source,
        status: l.status,
        message: l.message,
      }));
    }
    case "getProfile": {
      return await loadUserProfile(userId);
    }
    case "getPreferences": {
      return await loadInvestmentPreferences(userId);
    }
    case "updatePreferences": {
      await saveInvestmentPreferences(userId, args);
      return await loadInvestmentPreferences(userId);
    }
    case "updateProfile": {
      await saveUserProfile(userId, {
        age: args.age as number | undefined,
        annualIncome: args.annualIncome as number | undefined,
        occupation: args.occupation as string | undefined,
        investmentPreferences: {
          riskTolerance: args.riskTolerance as
            | "conservative"
            | "moderate"
            | "aggressive"
            | undefined as never,
          timeHorizon: args.timeHorizon as
            | "short"
            | "medium"
            | "long"
            | undefined as never,
          sectorBias: args.sectorBias as never,
        },
      });
      return await loadUserProfile(userId);
    }
    case "addExpense": {
      const rawName = (args.name as string | undefined)?.trim();
      const amount = args.amount as number | undefined;
      const frequency = args.frequency as
        | "monthly"
        | "quarterly"
        | "annual"
        | undefined;
      if (!rawName || typeof amount !== "number" || !frequency) {
        return { error: "name, amount, and frequency are required" };
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "amount must be a positive number" };
      }
      const profile = await loadUserProfile(userId);
      const existing = profile.fixedExpenses ?? [];
      if (existing.some((e) => e.name.toLowerCase() === rawName.toLowerCase())) {
        return { error: `an expense named "${rawName}" already exists` };
      }
      const next = [...existing, { name: rawName, amount, frequency }];
      await saveUserProfile(userId, { fixedExpenses: next });
      return { added: { name: rawName, amount, frequency }, count: next.length };
    }
    case "removeExpense": {
      const rawName = (args.name as string | undefined)?.trim();
      if (!rawName) return { error: "name is required" };
      const profile = await loadUserProfile(userId);
      const existing = profile.fixedExpenses ?? [];
      const lower = rawName.toLowerCase();
      const next = existing.filter((e) => e.name.toLowerCase() !== lower);
      if (next.length === existing.length) {
        return { removed: false, message: `no expense matched "${rawName}"` };
      }
      await saveUserProfile(userId, { fixedExpenses: next });
      return { removed: true, name: rawName, count: next.length };
    }
    case "setBudget": {
      if (args.reset === true) {
        await saveUserProfile(userId, { budgetOverrides: null });
        return { reset: true };
      }
      const keys = ["necessities", "investments", "discretionary", "savings"] as const;
      const profile = await loadUserProfile(userId);
      const merged: Record<string, number> = { ...(profile.budgetOverrides ?? {}) };
      let touched = 0;
      for (const k of keys) {
        const v = args[k];
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
          merged[k] = Math.round(v);
          touched++;
        }
      }
      if (touched === 0) {
        return { error: "supply at least one of necessities/investments/discretionary/savings, or reset=true" };
      }
      await saveUserProfile(userId, {
        budgetOverrides: merged as UserProfile["budgetOverrides"],
      });
      return { overrides: merged };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

export const systemPrompt = `You are Ledger's in-app financial assistant. You help the user understand their portfolio, surface actionable moves, and — when asked — update their stored preferences/profile.

Ground rules (non-negotiable):
- Informational only. You are NOT a licensed financial advisor. End any message that contains a specific recommendation (buy, sell, rebalance, contribute) with the standard disclaimer footer exactly as templated below.
- Be direct and specific. When you recommend a move, name the ticker, dollar amount, and account. Avoid hedge words like "consider" or "may want to."
- Mono type for numbers, tickers, and quantities when possible.
- Before calling any update* tool, STATE what you're about to change and ask the user to confirm. Only proceed after the user agrees (e.g., they say "yes", "do it", "go ahead"). Do not silently mutate the user's data.
- You can edit preferences and selected profile fields (risk tolerance, time horizon, sector bias, occupation, annual income, age). You can also add/remove fixed expenses and adjust the four monthly budget buckets (necessities, investments, discretionary, savings) via addExpense / removeExpense / setBudget. You CANNOT change name, email, or password from here — direct the user to Settings → Account.
- When the user asks "what should I do today?", call getPortfolioSummary and getPreferences first, then produce a prioritized action list: CONTRIBUTE (Roth transfers), BUY, SELL/TRIM, HARVEST — in that order of tax efficiency.
- Be honest about stale data. If getSyncStatus shows a source is errored or CSV is old, say so before making recommendations about it.

Standard disclaimer footer (append verbatim to any message with a recommendation):
—— I'm providing this as informational context based on your stated preferences and current portfolio. This isn't personalized financial advice. If you're making a significant decision, talk to a licensed advisor.`;
