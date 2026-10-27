-- Journal append-only : à exécuter dans le SQL Editor Supabase avec le rôle propriétaire.
-- Nécessite supabase/user-profiles.sql. Réexécutable sans effacer l'historique.
begin;

do $$ begin
  if to_regclass('public.app_profiles') is null then
    raise exception 'Installez user-profiles.sql avant le journal des modifications';
  end if;
end $$;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  actor_label text not null,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  lot_id text,
  lot_label text,
  old_values jsonb,
  new_values jsonb
);
create index if not exists audit_events_date_idx on public.audit_events (occurred_at desc, id desc);
create index if not exists audit_events_lot_idx on public.audit_events (lot_id);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;
drop policy if exists audit_admin_read on public.audit_events;
create policy audit_admin_read on public.audit_events for select to authenticated
using (exists (select 1 from public.app_profiles p where p.user_id = auth.uid() and p.role = 'admin' and p.is_active));

create or replace function public.record_business_audit()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  before_row jsonb;
  after_row jsonb;
  business_row jsonb;
  user_label text;
  lot_key text;
  lot_name text;
  origin_direct boolean;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (before_row - 'updated_at') is not distinct from (after_row - 'updated_at') then
    return new;
  end if;
  if tg_table_name = 'app_settings' then
    if not coalesce((before_row->>'key' in ('mortality_alert_threshold', 'sica_analysis_day', 'sica_delivery_day',
      'direct_poulet_ready_day', 'direct_pintade_ready_day', 'poultry_collection_price_ht',
      'poultry_collection_vat', 'poultry_transport_price_ht', 'poultry_transport_vat')
      or (before_row->>'category' = 'lot_tariffs' and before_row->>'key' like 'lot_tariffs:%')), false) then before_row := null; end if;
    if not coalesce((after_row->>'key' in ('mortality_alert_threshold', 'sica_analysis_day', 'sica_delivery_day',
      'direct_poulet_ready_day', 'direct_pintade_ready_day', 'poultry_collection_price_ht',
      'poultry_collection_vat', 'poultry_transport_price_ht', 'poultry_transport_vat')
      or (after_row->>'category' = 'lot_tariffs' and after_row->>'key' like 'lot_tariffs:%')), false) then after_row := null; end if;
    if before_row is null and after_row is null then
      if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
  end if;
  business_row := coalesce(after_row, before_row);
  select coalesce(nullif(p.display_name, ''), p.username) into user_label
    from public.app_profiles p where p.user_id = auth.uid();
  user_label := coalesce(user_label, case when auth.uid() is null then 'Opération système / SQL' else 'Utilisateur connecté' end);
  origin_direct := tg_table_name like 'direct_sale_%' or business_row->>'source_type' = 'vente_directe';
  lot_key := case
    when tg_table_name in ('lots_volailles', 'direct_sale_lots') then business_row->>'id'
    when origin_direct then coalesce(business_row->>'direct_sale_lot_id', business_row->>'lot_id')
    when tg_table_name = 'app_settings' and business_row->>'key' like 'lot_tariffs:%' then substring(business_row->>'key' from length('lot_tariffs:') + 1)
    else business_row->>'lot_id' end;
  lot_name := coalesce(business_row->>'lot_nom', case when tg_table_name = 'lots_volailles' then business_row->>'nom'
    when tg_table_name = 'direct_sale_lots' then business_row->>'name' end);
  if lot_key is not null and lot_name is null then
    if coalesce(origin_direct, false) and to_regclass('public.direct_sale_lots') is not null then
      execute 'select name from public.direct_sale_lots where id::text = $1' into lot_name using lot_key;
    elsif to_regclass('public.lots_volailles') is not null then
      execute 'select nom from public.lots_volailles where id::text = $1' into lot_name using lot_key;
    end if;
  end if;
  insert into public.audit_events (actor_id, actor_label, table_name, operation, record_id, lot_id, lot_label, old_values, new_values)
    values (auth.uid(), user_label, tg_table_name, tg_op, coalesce(business_row->>'id', business_row->>'key'),
      lot_key, lot_name, before_row, after_row);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.record_business_audit() from public, anon, authenticated;

do $$ declare table_key text; begin
  foreach table_key in array array['lots_volailles', 'charges', 'mortalites_volailles', 'livraisons_volailles',
    'consommations_aliment', 'livraisons_aliment', 'feed_reference', 'app_settings', 'sica_delivery_schedule',
    'direct_sale_lots', 'direct_sale_deliveries', 'direct_sale_mortalities', 'direct_sale_orders'] loop
    if to_regclass(format('public.%I', table_key)) is not null then
      execute format('drop trigger if exists business_audit on public.%I', table_key);
      execute format('create trigger business_audit after insert or update or delete on public.%I for each row execute function public.record_business_audit()', table_key);
    else
      raise notice 'Table absente, journal non installé pour % : réexécuter ce script après sa création.', table_key;
    end if;
  end loop;
end $$;
commit;
