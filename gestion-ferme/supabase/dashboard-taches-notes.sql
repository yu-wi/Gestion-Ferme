create extension if not exists pgcrypto;

create table if not exists public.dashboard_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'done')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  category text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_tasks_status_due_date_idx
  on public.dashboard_tasks (status, due_date);

create index if not exists dashboard_notes_pinned_created_idx
  on public.dashboard_notes (is_pinned desc, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboard_tasks_set_updated_at on public.dashboard_tasks;
create trigger dashboard_tasks_set_updated_at
before update on public.dashboard_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists dashboard_notes_set_updated_at on public.dashboard_notes;
create trigger dashboard_notes_set_updated_at
before update on public.dashboard_notes
for each row
execute function public.set_updated_at();

alter table public.dashboard_tasks enable row level security;
alter table public.dashboard_notes enable row level security;

drop policy if exists "Utilisateurs connectes - dashboard_tasks" on public.dashboard_tasks;
create policy "Utilisateurs connectes - dashboard_tasks"
on public.dashboard_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Utilisateurs connectes - dashboard_notes" on public.dashboard_notes;
create policy "Utilisateurs connectes - dashboard_notes"
on public.dashboard_notes
for all
to authenticated
using (true)
with check (true);

grant all on public.dashboard_tasks to authenticated;
grant all on public.dashboard_notes to authenticated;

notify pgrst, 'reload schema';
