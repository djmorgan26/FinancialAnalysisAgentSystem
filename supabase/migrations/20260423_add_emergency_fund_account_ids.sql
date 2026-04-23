-- Lets the user explicitly designate which accounts count toward their
-- emergency fund. When set, overrides the savings+checking heuristic.

alter table public.investment_preferences
  add column if not exists emergency_fund_account_ids text[] not null default '{}'::text[];
