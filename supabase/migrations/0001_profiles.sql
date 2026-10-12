-- Mohar profiles migration
-- Run once in the Supabase SQL editor (or via psql) on the project.
-- Idempotent: safe to re-run.
--
-- Model:
--   email            verified via Supabase magic link (no OTP)
--   username         generated or chosen, unique, 3-20 chars [a-z0-9_]
--   user_type        student | freelancer | business
--     business       -> business_name + business_city + business_state required
--     freelancer     -> freelance_work required
--     student        -> no extra fields
--   wallet_address   linked Solana wallet (optional)
--   marketing_opt_in separate optional consent, never implied by Terms acceptance

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text not null unique,
  user_type text not null,
  business_name text,
  business_city text,
  business_state text,
  freelance_work text,
  wallet_address text,
  marketing_opt_in boolean not null default false,
  marketing_consented_at timestamptz,
  terms_version text not null default '2026-10-12',
  privacy_version text not null default '2026-10-12',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_user_type_check
    check (user_type in ('student', 'freelancer', 'business')),
  constraint profiles_username_format_check
    check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_business_fields_check
    check (
      user_type <> 'business'
      or (
        business_name is not null and business_name <> ''
        and business_city is not null and business_city <> ''
        and business_state is not null and business_state <> ''
      )
    ),
  constraint profiles_freelancer_fields_check
    check (
      user_type <> 'freelancer'
      or (freelance_work is not null and freelance_work <> '')
    )
);

-- ------------------------------------------------- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- --------------------------------------- username availability (safe RPC)
-- Lets a signed-in user check whether a username is taken without being
-- able to read anyone else's profile row.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where username = candidate);
$$;

-- ------------------------------------------------------------- RLS setup
alter table public.profiles enable row level security;

drop policy if exists profiles_own_select on public.profiles;
drop policy if exists profiles_own_insert on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
drop policy if exists profiles_own_delete on public.profiles;

-- A user can only ever touch their own row (id = auth user id).
create policy profiles_own_select
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_own_insert
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_own_update
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_own_delete
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- "Automatically expose new tables" is OFF on this project, so grant
-- explicitly. RLS policies above still gate every row.
grant select, insert, update, delete on public.profiles to authenticated;
grant execute on function public.username_available(text) to authenticated, anon;
