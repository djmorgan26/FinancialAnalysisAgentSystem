-- Custom sector-like categories per user, plus FK on user_symbol_overrides.
-- See /Users/davidmorgan/.claude/plans/i-did-the-categorize-snappy-nygaard.md

create table if not exists public.user_custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint user_custom_categories_user_name_unique unique (user_id, name)
);

alter table public.user_custom_categories enable row level security;

create policy "user_custom_categories_select_own"
  on public.user_custom_categories
  for select
  using (auth.uid() = user_id);

create policy "user_custom_categories_insert_own"
  on public.user_custom_categories
  for insert
  with check (auth.uid() = user_id);

create policy "user_custom_categories_update_own"
  on public.user_custom_categories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_custom_categories_delete_own"
  on public.user_custom_categories
  for delete
  using (auth.uid() = user_id);

alter table public.user_symbol_overrides
  add column if not exists custom_category_id uuid
  references public.user_custom_categories(id) on delete set null;

create index if not exists user_symbol_overrides_custom_category_id_idx
  on public.user_symbol_overrides(custom_category_id);
