select
  case
    when to_regclass('public.app_profiles') is not null then 'OK'
    else 'MANQUANT'
  end as table_profils,
  (
    select count(*)
    from public.app_profiles
    where is_active = true
  ) as profils_actifs;
