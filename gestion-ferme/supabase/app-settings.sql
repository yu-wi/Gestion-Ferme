-- Parametres generaux de l'interface.
-- A executer une fois dans l'editeur SQL Supabase.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  label text,
  category text not null default 'general',
  updated_at timestamptz not null default now()
);

create or replace function public.touch_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_app_settings_updated_at
on public.app_settings;

create trigger touch_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.touch_app_settings_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists "authenticated_all_app_settings"
on public.app_settings;

create policy "authenticated_all_app_settings"
on public.app_settings
for all
to authenticated
using (true)
with check (true);

insert into public.app_settings (key, value, label, category)
values
  ('mortality_alert_threshold', '15', 'Seuil alerte mortalite (%)', 'volailles'),
  ('sica_analysis_day', '46', 'Jour analyse sanitaire SICA', 'volailles'),
  ('sica_delivery_day', '70', 'Jour livraison prevue SICA', 'volailles'),
  ('direct_poulet_ready_day', '70', 'Jour pret a vendre poulets vente directe', 'volailles'),
  ('direct_pintade_ready_day', '90', 'Jour pret a vendre pintades vente directe', 'volailles')
on conflict (key) do nothing;
