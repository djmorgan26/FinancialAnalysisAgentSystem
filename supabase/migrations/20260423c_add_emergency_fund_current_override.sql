-- Manual override for emergency fund current balance. Used when the synced
-- balance is wrong (e.g. Schwab Trader API returns zero for a new MMF-only
-- account even though the balance shows correctly in the web portal).

alter table public.investment_preferences
  add column if not exists emergency_fund_current_override numeric;
