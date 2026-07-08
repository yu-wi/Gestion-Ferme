-- Protection des donnees par profil actif.
-- A executer seulement apres user-profiles.sql et apres creation du premier
-- profil administrateur.

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_profiles
    where user_id = auth.uid()
      and is_active = true
  );
$$;

revoke all on function public.is_active_app_user() from public, anon;
grant execute on function public.is_active_app_user() to authenticated;

do $$
declare
  table_name text;
  policy_row record;
  protected_tables text[] := array[
    'lots_volailles',
    'evenements',
    'charges',
    'feed_reference',
    'mortalites_volailles',
    'livraisons_volailles',
    'consommations_aliment',
    'livraisons_aliment',
    'direct_sale_lots',
    'direct_sale_mortalities',
    'direct_sale_customers',
    'direct_sale_orders',
    'direct_sale_deliveries',
    'monthly_inventory_snapshots',
    'sica_delivery_schedule',
    'aquaponie_basins',
    'aquaponie_tanks',
    'aquaponie_water_measures',
    'aquaponie_cultures',
    'aquaponie_harvests'
  ];
begin
  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        table_name
      );
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_app_user())',
      'Active app users can read ' || table_name,
      table_name
    );

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_active_app_user()) with check (public.is_active_app_user())',
      'Active app users can write ' || table_name,
      table_name
    );
  end loop;
end;
$$;
