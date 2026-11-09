-- Read-only window for Claude (and any other assistant) over the owner's data.
--
-- What it is:
--   * schema claude_ro, holding views only (plus a one-row owner table)
--   * every view is filtered to the single owner in claude_ro.owner
--   * no view exposes OAuth tokens, secrets, memos or full account numbers
--     (accounts show last4 at most)
--   * role claude_reader can SELECT these views and nothing else; it is
--     NOLOGIN until someone deliberately gives it a password
--
-- What it is not:
--   * not exposed through the Supabase REST API (the schema is not in the
--     API's exposed schemas, and anon/authenticated get no grants)
--   * no write path of any kind
--
-- One manual step after applying: tell the views whose data to show.
--   insert into claude_ro.owner (user_id) values ('<owner auth.users id>');

create schema if not exists claude_ro;

revoke all on schema claude_ro from public;
revoke all on schema claude_ro from anon, authenticated;

create table if not exists claude_ro.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id) on delete cascade
);
revoke all on claude_ro.owner from public, anon, authenticated;

-- Accounts: balances and freshness, no account numbers beyond last4.
create or replace view claude_ro.accounts as
select
  a.id,
  a.platform,
  a.account_type,
  a.name,
  a.last4,
  a.balance,
  a.currency,
  a.last_updated,
  round(extract(epoch from (now() - a.last_updated::timestamptz)) / 3600.0, 1)
    as hours_since_update
from public.accounts a
join claude_ro.owner o on o.user_id = a.user_id;

-- Holdings: one row per position, with the account's display name.
create or replace view claude_ro.holdings as
select
  h.platform,
  a.name as account_name,
  a.account_type,
  h.symbol,
  h.name,
  h.quantity,
  h.cost_basis,
  h.current_price,
  h.current_value,
  h.gain_loss,
  h.gain_loss_percent,
  h.asset_class,
  h.sector,
  h.last_updated
from public.holdings h
join claude_ro.owner o on o.user_id = h.user_id
left join public.accounts a on a.id = h.account_id;

-- Transactions: last ~13 months, memo left out (it can carry reference numbers).
create or replace view claude_ro.transactions as
select
  t.date,
  t.platform,
  a.name as account_name,
  t.description,
  t.amount,
  t.category,
  t.subcategory
from public.transactions t
join claude_ro.owner o on o.user_id = t.user_id
left join public.accounts a on a.id = t.account_id
where t.date::date >= (current_date - interval '400 days');

-- Totals by platform and asset class, plus a grand total row.
create or replace view claude_ro.allocation as
select
  coalesce(h.platform, 'all') as platform,
  coalesce(h.asset_class, 'all') as asset_class,
  sum(h.current_value) as current_value,
  sum(h.cost_basis) as cost_basis,
  count(*) as positions
from public.holdings h
join claude_ro.owner o on o.user_id = h.user_id
group by rollup (h.platform, h.asset_class);

-- Net worth history from the daily snapshots.
create or replace view claude_ro.net_worth_history as
select
  s.date,
  s.net_worth,
  s.total_assets,
  s.total_liabilities,
  s.savings_rate
from public.snapshots s
join claude_ro.owner o on o.user_id = s.user_id;

-- Is the data fresh? Last success and last problem per source, and when the
-- Schwab sign-in runs out (timestamp only, never the token itself).
create or replace view claude_ro.data_freshness as
with logs as (
  select l.source, l.status, l.message, l.created_at
  from public.sync_logs l
  join claude_ro.owner o on o.user_id = l.user_id
)
select
  src.source,
  (select max(created_at) from logs where logs.source = src.source and status = 'success')
    as last_success_at,
  (select created_at from logs where logs.source = src.source and status in ('error','needs_reauth')
     order by created_at desc limit 1) as last_problem_at,
  (select message from logs where logs.source = src.source and status in ('error','needs_reauth')
     order by created_at desc limit 1) as last_problem,
  case when src.source = 'schwab' then (
    select to_timestamp(t.refresh_expires_at / 1000.0)
    from public.schwab_tokens t
    join claude_ro.owner o on o.user_id = t.user_id
  ) end as signin_expires_at
from (select distinct source from logs) src;

-- Views run as their owner (postgres), so claude_reader needs no rights on the
-- underlying tables; the owner join above is what scopes the rows.
revoke all on all tables in schema claude_ro from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'claude_reader') then
    create role claude_reader nologin;
  end if;
end $$;

grant usage on schema claude_ro to claude_reader;
grant select on
  claude_ro.accounts,
  claude_ro.holdings,
  claude_ro.transactions,
  claude_ro.allocation,
  claude_ro.net_worth_history,
  claude_ro.data_freshness
to claude_reader;
