-- A executer dans Supabase SQL Editor avant d'utiliser la saisie groupee.
-- Prerequis : modules alimentation (source_type/direct_sale_lot_id), vente directe.
begin;
create table if not exists public.daily_entry_batches (
  id uuid primary key,
  user_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.daily_entry_batches enable row level security;
revoke all on public.daily_entry_batches from public, anon, authenticated;
grant select, insert on public.daily_entry_batches to authenticated;
drop policy if exists own_daily_batches on public.daily_entry_batches;
create policy own_daily_batches on public.daily_entry_batches for select to authenticated using (user_id = auth.uid());
drop policy if exists insert_daily_batches on public.daily_entry_batches;
create policy insert_daily_batches on public.daily_entry_batches for insert to authenticated with check (user_id = auth.uid());

create or replace function public.enregistrer_saisie_quotidienne(p_id uuid, p_date date, p_lignes jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  ligne jsonb;
  lot uuid;
  source text;
  aliment text;
  kg numeric;
  morts integer;
  disponible numeric;
  arrivee date;
  actif boolean;
  precedent jsonb;
  charge jsonb := jsonb_build_object('date', p_date, 'lignes', p_lignes);
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_id is null or p_date is null or p_date > (now() at time zone 'America/Martinique')::date
    or jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) not between 1 and 500 then
    raise exception 'Date ou lignes invalides.';
  end if;
  -- Meme identifiant en cas de double clic ou de reponse reseau perdue.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select payload into precedent from public.daily_entry_batches where id = p_id;
  if found then
    if precedent <> charge then raise exception 'Cette saisie a deja ete enregistree avec un contenu different. Actualisez la page.'; end if;
    return;
  end if;
  -- Les autres formulaires ecrivent dans ces memes tables : empecher qu'une
  -- consommation ou sortie de sujets change entre le controle et l'insertion.
  lock table public.lots_volailles, public.direct_sale_lots,
    public.livraisons_volailles, public.mortalites_volailles,
    public.direct_sale_mortalities, public.livraisons_aliment,
    public.consommations_aliment in share row exclusive mode;
  if exists (select 1 from jsonb_array_elements(p_lignes) x group by x->>'source', x->>'lot_id' having count(*) > 1) then
    raise exception 'Un lot apparait plusieurs fois.';
  end if;
  for ligne in select value from jsonb_array_elements(p_lignes) loop
    lot := (ligne->>'lot_id')::uuid;
    source := ligne->>'source';
    aliment := trim(coalesce(ligne->>'aliment', ''));
    kg := (ligne->>'quantite_kg')::numeric;
    if (ligne->>'morts')::numeric <> trunc((ligne->>'morts')::numeric) then raise exception 'Mortalite invalide.'; end if;
    morts := (ligne->>'morts')::integer;
    if kg is null or kg::text in ('NaN', 'Infinity', '-Infinity') or kg < 0 or mod(kg, 25) <> 0 or morts is null or morts < 0 or (kg = 0 and morts = 0) or (kg > 0 and aliment = '') then
      raise exception 'Quantites invalides.';
    end if;
    if source = 'sica' then
      select l.date_arrivee, l.is_active,
        l.quantite - coalesce(l.autoconsommation, 0)
        - coalesce((select sum(m.nombre) from public.mortalites_volailles m where m.lot_id = l.id), 0)
        - coalesce((select sum(v.quantite) from public.livraisons_volailles v where v.lot_id = l.id), 0)
        into arrivee, actif, disponible from public.lots_volailles l where l.id = lot;
    elsif source = 'vente_directe' then
      select arrival_date, status <> 'termine', remaining_quantity into arrivee, actif, disponible from public.direct_sale_lots where id = lot;
    else raise exception 'Source de lot invalide.';
    end if;
    if arrivee is null or actif is distinct from true or p_date < arrivee or morts > disponible or disponible <= 0 then
      raise exception 'Lot indisponible, date invalide ou effectif insuffisant. Actualisez les donnees.';
    end if;
    -- Une saisie supplementaire doit passer par les formulaires individuels.
    if kg > 0 and exists(select 1 from public.consommations_aliment c where c.date = p_date and
      ((source = 'sica' and c.lot_id = lot) or (source = 'vente_directe' and c.direct_sale_lot_id = lot))) then
      raise exception 'Une consommation existe deja ce jour pour ce lot. Utilisez le suivi alimentation pour la modifier.';
    end if;
    if morts > 0 and ((source = 'sica' and exists(select 1 from public.mortalites_volailles where lot_id = lot and date = p_date))
      or (source = 'vente_directe' and exists(select 1 from public.direct_sale_mortalities where lot_id = lot and date = p_date))) then
      raise exception 'Une mortalite existe deja ce jour pour ce lot. Utilisez son formulaire pour la modifier.';
    end if;
    if kg > 0 then
      select coalesce(sum(s.stock_kg), 0) into disponible from public.calculer_stock_aliment() s
      where translate(lower(trim(s.feed_type)), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') = translate(lower(aliment), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc');
      if kg > disponible then raise exception 'Stock insuffisant en %. Aucune donnee enregistree.', aliment; end if;
      insert into public.consommations_aliment(lot_id, direct_sale_lot_id, source_type, date, feed_type, quantite_kg)
      values(case when source = 'sica' then lot end, case when source = 'vente_directe' then lot end, source, p_date, aliment, kg);
    end if;
    if morts > 0 then
      if source = 'sica' then
        insert into public.mortalites_volailles(lot_id, date, nombre) values(lot, p_date, morts);
        -- Compatible avec ou sans les anciens triggers de recalcul SICA.
        update public.lots_volailles l set nb_morts = (select coalesce(sum(nombre), 0) from public.mortalites_volailles where lot_id = lot),
          sujets_restants = l.quantite - coalesce(l.autoconsommation, 0)
            - (select coalesce(sum(nombre), 0) from public.mortalites_volailles where lot_id = lot)
            - (select coalesce(sum(quantite), 0) from public.livraisons_volailles where lot_id = lot) where l.id = lot;
      else
        insert into public.direct_sale_mortalities(lot_id, date, quantity) values(lot, p_date, morts);
        update public.direct_sale_lots set mortality_count = mortality_count + morts, remaining_quantity = remaining_quantity - morts where id = lot;
      end if;
      if not found then raise exception 'Mise a jour du lot refusee. Aucune donnee enregistree.'; end if;
    end if;
  end loop;
  insert into public.daily_entry_batches(id, user_id, payload) values(p_id, auth.uid(), charge);
end;
$$;
revoke all on function public.enregistrer_saisie_quotidienne(uuid, date, jsonb) from public, anon;
grant execute on function public.enregistrer_saisie_quotidienne(uuid, date, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
