// Apply the user's documented emergency-fund balance on top of raw sync data.
//
// Why: brokers lag or misreport newly-funded accounts. The user sets
// `emergency_fund_current_override` via Settings to declare the real balance.
// If we only bump the EF account, the source cash (still showing in the old
// account because the transfer hasn't settled on the broker side) double-counts.
// So we also debit the override amount from the largest same-platform cash
// holdings outside the emergency fund.
//
// Works on shallow-cloned rows so callers get fresh objects — safe to pass
// straight through to downstream analyzers.

interface AccountLike {
  id: string;
  platform: string;
  accountType?: string;
  account_type?: string;
  balance: number;
}

interface HoldingLike {
  account_id?: string;
  accountId?: string;
  asset_class?: string;
  assetClass?: string;
  symbol: string;
  quantity: number;
  cost_basis?: number;
  costBasis?: number;
  current_price?: number;
  currentPrice?: number;
  current_value?: number;
  currentValue?: number;
  gain_loss?: number;
  gainLoss?: number;
  gain_loss_percent?: number;
  gainLossPercent?: number;
  sector?: string;
  last_updated?: string;
  lastUpdated?: string;
  name?: string;
  id?: string;
  user_id?: string;
  platform?: string;
}

export interface EfOverrideInput {
  overrideAmount: number | null | undefined;
  accountIds: string[] | null | undefined;
}

function snakeHolding(h: HoldingLike) {
  // Normalize to snake_case-ish fields so downstream code reads consistently.
  const acct = h.account_id ?? h.accountId ?? "";
  const assetClass = h.asset_class ?? h.assetClass ?? "";
  const currentValue = h.current_value ?? h.currentValue ?? 0;
  return { h, acct, assetClass, currentValue: Number(currentValue) };
}

export function applyEmergencyFundReconciliation<
  A extends AccountLike,
  H extends HoldingLike,
>(
  accounts: A[],
  holdings: H[],
  input: EfOverrideInput,
  opts?: { synthesizeSymbol?: string }
): { accounts: A[]; holdings: H[]; debited: number; synthesized: number } {
  const override = Number(input.overrideAmount ?? 0);
  const efIds = new Set(input.accountIds ?? []);
  if (override <= 0 || efIds.size === 0) {
    return { accounts, holdings, debited: 0, synthesized: 0 };
  }

  const symbol = opts?.synthesizeSymbol ?? "SWVXX";

  // Clone so callers don't mutate their inputs unexpectedly.
  const nextAccounts = accounts.map((a) => ({ ...a }));
  let nextHoldings = holdings.map((h) => ({ ...h }));

  // 1) Replace EF account holdings with a single cash row = override share.
  const perAccount = override / efIds.size;
  const efPlatforms = new Set<string>();
  for (const acct of nextAccounts) {
    if (!efIds.has(acct.id)) continue;
    efPlatforms.add(acct.platform);
    nextHoldings = nextHoldings.filter(
      (h) => (h.account_id ?? h.accountId) !== acct.id
    );
    acct.balance = perAccount;
    nextHoldings.push({
      id: `ef-override-${acct.id}`,
      account_id: acct.id,
      accountId: acct.id,
      user_id: undefined,
      platform: acct.platform,
      symbol,
      name: "Emergency Fund (override)",
      quantity: perAccount,
      cost_basis: perAccount,
      costBasis: perAccount,
      current_price: 1,
      currentPrice: 1,
      current_value: perAccount,
      currentValue: perAccount,
      gain_loss: 0,
      gainLoss: 0,
      gain_loss_percent: 0,
      gainLossPercent: 0,
      asset_class: "cash",
      assetClass: "cash",
      sector: "other",
      last_updated: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    } as unknown as H);
  }

  // 2) Debit the override from same-platform, non-EF cash pools.
  //    Pick largest cash holding first; walk down until we've debited `override`.
  let remaining = override;
  const candidates = nextHoldings
    .map(snakeHolding)
    .filter(
      ({ h, acct, assetClass }) =>
        !efIds.has(acct) &&
        assetClass === "cash" &&
        h.platform !== undefined &&
        efPlatforms.has(h.platform)
    )
    .sort((a, b) => b.currentValue - a.currentValue);

  let debited = 0;
  for (const c of candidates) {
    if (remaining <= 0.01) break;
    const take = Math.min(c.currentValue, remaining);
    if (take <= 0) continue;
    const newValue = c.currentValue - take;
    // Update both flavors of field names in-place.
    if ("current_value" in c.h) c.h.current_value = newValue;
    if ("currentValue" in c.h) c.h.currentValue = newValue;
    c.h.quantity = newValue; // cash rows are $1 NAV
    if ("cost_basis" in c.h) c.h.cost_basis = newValue;
    if ("costBasis" in c.h) c.h.costBasis = newValue;
    remaining -= take;
    debited += take;

    // Debit the source account balance by the same amount to keep totals tied.
    const srcAcctId = c.acct;
    const srcAcct = nextAccounts.find((a) => a.id === srcAcctId);
    if (srcAcct) srcAcct.balance = Math.max(0, srcAcct.balance - take);
  }

  return {
    accounts: nextAccounts,
    holdings: nextHoldings,
    debited,
    synthesized: override,
  };
}
