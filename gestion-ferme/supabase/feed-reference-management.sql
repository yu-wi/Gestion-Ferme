-- Ajoute un identifiant stable aux references alimentaires existantes.

alter table public.feed_reference
add column if not exists id uuid default gen_random_uuid();

update public.feed_reference
set id = gen_random_uuid()
where id is null;

alter table public.feed_reference
alter column id set default gen_random_uuid();

alter table public.feed_reference
alter column id set not null;

create unique index if not exists feed_reference_id_idx
on public.feed_reference(id);
