-- A executer dans Supabase SQL Editor apres aquaponie-suivi.sql.
-- Reexecutable sans effacement. Effectifs et poids propres aux lots de poissons.
begin;
create table if not exists public.aquaponie_fish_lots (
 id uuid primary key,
 name text not null check(length(trim(name)) between 1 and 100),
 approx_birth_date date not null check(isfinite(approx_birth_date)),
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.aquaponie_fish_observations (
 id uuid primary key,
 lot_id uuid not null references public.aquaponie_fish_lots(id) on delete restrict,
 observed_on date not null check(isfinite(observed_on)),
 quantity integer not null check(quantity>=0),
 unit_weight_g numeric not null check(unit_weight_g>0 and unit_weight_g::text not in ('NaN','Infinity','-Infinity')),
 basin_id uuid references public.aquaponie_basins(id) on delete set null,
 basin_label text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists aquaponie_fish_observations_lot_date_idx on public.aquaponie_fish_observations(lot_id,observed_on desc,created_at desc);
alter table public.aquaponie_fish_lots enable row level security;
alter table public.aquaponie_fish_observations enable row level security;
revoke all on public.aquaponie_fish_lots,public.aquaponie_fish_observations from public,anon;
grant select,insert,update on public.aquaponie_fish_lots to authenticated;
grant select,insert on public.aquaponie_fish_observations to authenticated;
do $$
declare t text; condition text;
begin
 if to_regprocedure('public.is_active_app_user()') is not null then condition:='public.is_active_app_user()';
 elsif to_regclass('public.app_profiles') is not null then condition:='exists(select 1 from public.app_profiles where user_id=auth.uid() and is_active)';
 else condition:='auth.uid() is not null'; end if;
 foreach t in array array['aquaponie_fish_lots','aquaponie_fish_observations'] loop
 execute format('drop policy if exists fish_users on public.%I',t);
 execute format('create policy fish_users on public.%I for all to authenticated using (%s) with check (%s)',t,condition,condition);
 end loop;
end $$;
create or replace function public.enregistrer_suivi_poissons(
 p_lot_id uuid,p_observation_id uuid,p_name text,p_birth_date date,p_observed_on date,
 p_quantity integer,p_unit_weight_g numeric,p_basin_id uuid,p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path=public as $$
declare lot public.aquaponie_fish_lots; suivi public.aquaponie_fish_observations; bassin text;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if p_lot_id is null or p_observation_id is null or p_name is null or length(trim(p_name)) not between 1 and 100
 or p_birth_date is null or p_observed_on is null or not isfinite(p_birth_date) or not isfinite(p_observed_on)
 or p_birth_date>p_observed_on or p_observed_on>(now() at time zone 'America/Martinique')::date
 or p_quantity is null or p_quantity<0 or p_unit_weight_g is null or p_unit_weight_g<=0 or p_unit_weight_g::text in ('NaN','Infinity','-Infinity') then raise exception 'Donnees de suivi invalides'; end if;
 -- Un identifiant stable evite les doublons si la reponse du serveur est perdue.
 perform pg_advisory_xact_lock(hashtextextended(p_lot_id::text,0));
 select * into suivi from public.aquaponie_fish_observations where id=p_observation_id;
 if found then
 select * into lot from public.aquaponie_fish_lots where id=p_lot_id;
 if suivi.lot_id=p_lot_id and suivi.observed_on=p_observed_on and suivi.quantity=p_quantity and suivi.unit_weight_g=p_unit_weight_g and suivi.basin_id is not distinct from p_basin_id and lot.name=trim(p_name) and lot.approx_birth_date=p_birth_date then return p_lot_id; end if;
 raise exception 'Cette saisie existe deja avec des valeurs differentes. Actualisez la page.';
 end if;
 select name into bassin from public.aquaponie_basins where id=p_basin_id;
 if not found then raise exception 'Choisissez un bassin existant'; end if;
 select * into lot from public.aquaponie_fish_lots where id=p_lot_id for update;
 if found then
 if p_expected_updated_at is null or lot.updated_at<>p_expected_updated_at then raise exception 'Le lot a ete modifie. Actualisez avant de reprendre la saisie.'; end if;
 -- Une correction de naissance doit rester coherente avec tout l historique.
 if exists(select 1 from public.aquaponie_fish_observations where lot_id=p_lot_id and observed_on<p_birth_date) then raise exception 'La naissance doit preceder les suivis existants'; end if;
 update public.aquaponie_fish_lots set name=trim(p_name),approx_birth_date=p_birth_date,updated_at=clock_timestamp() where id=p_lot_id;
 else
 if p_expected_updated_at is not null then raise exception 'Lot introuvable'; end if;
 insert into public.aquaponie_fish_lots(id,name,approx_birth_date) values(p_lot_id,trim(p_name),p_birth_date);
 end if;
 insert into public.aquaponie_fish_observations(id,lot_id,observed_on,quantity,unit_weight_g,basin_id,basin_label) values(p_observation_id,p_lot_id,p_observed_on,p_quantity,p_unit_weight_g,p_basin_id,bassin);
 return p_lot_id;
end $$;
revoke all on function public.enregistrer_suivi_poissons(uuid,uuid,text,date,date,integer,numeric,uuid,timestamptz) from public,anon;
grant execute on function public.enregistrer_suivi_poissons(uuid,uuid,text,date,date,integer,numeric,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
