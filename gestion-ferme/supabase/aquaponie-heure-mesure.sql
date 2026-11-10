-- A executer une fois dans Supabase > SQL Editor.
-- Les anciens releves gardent une heure inconnue ; leurs valeurs sont conservees.
begin;
alter table public.aquaponie_water_measures
  add column if not exists measure_time time without time zone;
notify pgrst, 'reload schema';
commit;
