-- Politiques RLS de depart pour l'application Gestion Ferme.
-- A appliquer seulement apres ajout/verification de l'authentification Supabase.
-- Sans authentification dans l'interface, ces regles peuvent bloquer l'application.

alter table public.lots_volailles enable row level security;
alter table public.evenements enable row level security;
alter table public.charges enable row level security;
alter table public.feed_reference enable row level security;

drop policy if exists "Authenticated users can read lots_volailles" on public.lots_volailles;
drop policy if exists "Authenticated users can write lots_volailles" on public.lots_volailles;
drop policy if exists "Authenticated users can read evenements" on public.evenements;
drop policy if exists "Authenticated users can write evenements" on public.evenements;
drop policy if exists "Authenticated users can read charges" on public.charges;
drop policy if exists "Authenticated users can write charges" on public.charges;
drop policy if exists "Authenticated users can read feed_reference" on public.feed_reference;
drop policy if exists "Authenticated users can write feed_reference" on public.feed_reference;

create policy "Authenticated users can read lots_volailles"
on public.lots_volailles
for select
to authenticated
using (true);

create policy "Authenticated users can write lots_volailles"
on public.lots_volailles
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can read evenements"
on public.evenements
for select
to authenticated
using (true);

create policy "Authenticated users can write evenements"
on public.evenements
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can read charges"
on public.charges
for select
to authenticated
using (true);

create policy "Authenticated users can write charges"
on public.charges
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can read feed_reference"
on public.feed_reference
for select
to authenticated
using (true);

create policy "Authenticated users can write feed_reference"
on public.feed_reference
for all
to authenticated
using (true)
with check (true);
