-- Gestion Ferme - Inventaire mensuel automatique.
-- A executer dans Supabase > SQL Editor.
-- Le planning automatique utilise pg_cron si l'extension est disponible sur le projet.

create table if not exists public.monthly_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  category text not null check (category in ('feed', 'sica', 'direct')),
  source_id text not null,
  group_label text not null,
  item_label text not null,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null check (unit in ('sacs', 'sujets')),
  created_at timestamptz not null default now(),
  unique (snapshot_date, category, source_id)
);

create index if not exists monthly_inventory_snapshots_date_idx
on public.monthly_inventory_snapshots(snapshot_date desc);

create index if not exists monthly_inventory_snapshots_category_idx
on public.monthly_inventory_snapshots(category, group_label, item_label);

alter table public.monthly_inventory_snapshots enable row level security;

drop policy if exists "authenticated_all_monthly_inventory_snapshots"
on public.monthly_inventory_snapshots;

create policy "authenticated_all_monthly_inventory_snapshots"
on public.monthly_inventory_snapshots
for all
to authenticated
using (true)
with check (true);

create or replace function public.capture_monthly_inventory(
  p_snapshot_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.monthly_inventory_snapshots (
    snapshot_date,
    category,
    source_id,
    group_label,
    item_label,
    quantity,
    unit
  )
  select
    p_snapshot_date,
    'feed',
    lower(trim(feed_types.feed_type)),
    'Stock aliments',
    feed_types.feed_type,
    round(
      greatest(
        (
          coalesce(entrees.total_kg, 0) - coalesce(sorties.total_kg, 0)
        ) / 25.0,
        0
      ),
      2
    ),
    'sacs'
  from (
    select distinct feed_type
    from public.livraisons_aliment
    where date <= p_snapshot_date
    union
    select distinct feed_type
    from public.consommations_aliment
    where date <= p_snapshot_date
  ) feed_types
  left join lateral (
    select sum(quantite_kg) as total_kg
    from public.livraisons_aliment livraison
    where livraison.feed_type = feed_types.feed_type
      and livraison.date <= p_snapshot_date
  ) entrees on true
  left join lateral (
    select sum(quantite_kg) as total_kg
    from public.consommations_aliment consommation
    where consommation.feed_type = feed_types.feed_type
      and consommation.date <= p_snapshot_date
  ) sorties on true
  on conflict (snapshot_date, category, source_id)
  do update set
    group_label = excluded.group_label,
    item_label = excluded.item_label,
    quantity = excluded.quantity,
    unit = excluded.unit,
    created_at = now();

  insert into public.monthly_inventory_snapshots (
    snapshot_date,
    category,
    source_id,
    group_label,
    item_label,
    quantity,
    unit
  )
  select
    p_snapshot_date,
    'sica',
    lot.id::text,
    'Lots SICA Madras',
    lot.nom,
    greatest(coalesce(lot.sujets_restants, lot.quantite, 0), 0),
    'sujets'
  from public.lots_volailles lot
  where coalesce(lot.is_active, true) = true
  on conflict (snapshot_date, category, source_id)
  do update set
    group_label = excluded.group_label,
    item_label = excluded.item_label,
    quantity = excluded.quantity,
    unit = excluded.unit,
    created_at = now();

  insert into public.monthly_inventory_snapshots (
    snapshot_date,
    category,
    source_id,
    group_label,
    item_label,
    quantity,
    unit
  )
  select
    p_snapshot_date,
    'direct',
    lot.id::text,
    case
      when lot.species = 'pintade' then 'Vente directe - Pintades'
      when lot.species = 'poulet' then 'Vente directe - Poulets'
      else 'Vente directe'
    end,
    lot.name,
    greatest(coalesce(lot.remaining_quantity, lot.initial_quantity, 0), 0),
    'sujets'
  from public.direct_sale_lots lot
  where lot.status <> 'termine'
  on conflict (snapshot_date, category, source_id)
  do update set
    group_label = excluded.group_label,
    item_label = excluded.item_label,
    quantity = excluded.quantity,
    unit = excluded.unit,
    created_at = now();
end;
$$;

grant execute on function public.capture_monthly_inventory(date) to authenticated;

create or replace function public.capture_monthly_inventory_if_month_end()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  last_day date;
begin
  last_day := (date_trunc('month', current_date)::date + interval '1 month - 1 day')::date;

  if current_date = last_day then
    perform public.capture_monthly_inventory(current_date);
  end if;
end;
$$;

-- Planification automatique a 23h59 le dernier jour du mois.
-- Si pg_cron n'est pas disponible, le reste de l'inventaire fonctionne quand meme
-- et vous pouvez utiliser le bouton "Enregistrer maintenant" dans l'interface.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron non disponible sur ce projet : %', sqlerrm;
  end;

  begin
    if to_regclass('cron.job') is not null then
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'gestion_ferme_inventory_month_end_2359';

      perform cron.schedule(
        'gestion_ferme_inventory_month_end_2359',
        '59 23 * * *',
        'select public.capture_monthly_inventory_if_month_end();'
      );
    end if;
  exception when others then
    raise notice 'Planification automatique non configuree : %', sqlerrm;
  end;
end $$;

notify pgrst, 'reload schema';
