-- Profils utilisateurs pour la connexion par identifiant.
-- A executer une seule fois dans Supabase > SQL Editor.

create table if not exists public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_profiles_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9._-]{3,40}$'
  )
);

create unique index if not exists app_profiles_username_unique
on public.app_profiles (lower(username));

alter table public.app_profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.app_profiles;

create policy "Users can read their own profile"
on public.app_profiles
for select
to authenticated
using (user_id = auth.uid() and is_active = true);

revoke all on table public.app_profiles from anon;
revoke insert, update, delete on table public.app_profiles from authenticated;
grant select on table public.app_profiles to authenticated;

create or replace function public.set_app_user_profile(
  account_email text,
  account_username text,
  account_display_name text default null,
  account_role text default 'user'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  normalized_username text;
begin
  normalized_username := lower(trim(account_username));

  if normalized_username !~ '^[a-z0-9._-]{3,40}$' then
    raise exception 'Identifiant invalide';
  end if;

  if account_role not in ('admin', 'user') then
    raise exception 'Role invalide';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(trim(account_email))
  limit 1;

  if target_user_id is null then
    raise exception 'Aucun compte Supabase ne correspond a cette adresse';
  end if;

  insert into public.app_profiles (
    user_id,
    username,
    display_name,
    role,
    is_active,
    updated_at
  )
  values (
    target_user_id,
    normalized_username,
    nullif(trim(account_display_name), ''),
    account_role,
    true,
    now()
  )
  on conflict (user_id) do update
  set
    username = excluded.username,
    display_name = excluded.display_name,
    role = excluded.role,
    is_active = true,
    updated_at = now();

  return target_user_id;
end;
$$;

revoke all on function public.set_app_user_profile(text, text, text, text)
from public, anon, authenticated;

-- Exemple a executer dans le SQL Editor pour le premier compte :
-- select public.set_app_user_profile(
--   's.pierrelouis@adresse-complete.com',
--   'spierrelouis',
--   's.pierrelouis',
--   'admin'
-- );
