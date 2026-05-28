-- Run this in your Supabase SQL Editor (https://app.supabase.com → your project → SQL Editor)

create table if not exists public.user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  role          text not null check (role in ('va_staff', 'am', 'admin')),
  facility_name text,   -- required for va_staff; null for am/admin
  created_at    timestamptz default now()
);

-- Enable Row Level Security
alter table public.user_profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

-- Only service role (used by admin invite API) can insert/update profiles
create policy "Service role can manage profiles"
  on public.user_profiles for all
  using (auth.role() = 'service_role');

-- Trigger: auto-create a placeholder profile on signup
-- (admin must then update role + facility via dashboard or SQL)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
