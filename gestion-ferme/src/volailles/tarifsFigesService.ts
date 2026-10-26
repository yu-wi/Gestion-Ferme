import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';
import { calculerCoutAliment } from './coutAliment';
import { lireTarifsCharges } from './tarifsCharges';
import { creerTarifsFiges, lireTarifsFiges, type TarifsFiges } from './tarifsFiges';

const cle = (lotId: string) => `lot_tariffs:${lotId}`;

export async function chargerTarifsFiges() {
  const rows = await chargerPages((debut, fin) => supabase.from('app_settings')
    .select('key, value').eq('category', 'lot_tariffs').order('key').range(debut, fin));
  return new Map(rows.map(row => [row.key.slice('lot_tariffs:'.length), lireTarifsFiges(row.value)]));
}

export async function figerTarifsLot(lotId: string, origine: TarifsFiges['origine']) {
  const existants = await chargerTarifsFiges();
  if (existants.has(lotId)) return existants.get(lotId)!;
  const [references, settings, consommations] = await Promise.all([
    supabase.from('feed_reference').select('feed_type, feed_price_ht').order('age_min_days'),
    supabase.from('app_settings').select('key, value').eq('category', 'volailles'),
    chargerPages((debut, fin) => supabase.from('consommations_aliment').select('feed_type, quantite_kg')
      .eq('lot_id', lotId).order('id').range(debut, fin)),
  ]);
  if (references.error) throw references.error;
  if (settings.error) throw settings.error;
  const refs = (references.data || []).map(row => ({ feed_type: String(row.feed_type),
    feed_price_ht: row.feed_price_ht == null ? null : Number(row.feed_price_ht) }));
  calculerCoutAliment(consommations, refs); // Ne pas figer une valorisation incomplète.
  const snapshot = creerTarifsFiges(refs, lireTarifsCharges(settings.data || []), origine);
  const { error } = await supabase.from('app_settings').upsert({ key: cle(lotId), value: JSON.stringify(snapshot),
    label: 'Tarifs figés du lot', category: 'lot_tariffs' }, { onConflict: 'key', ignoreDuplicates: true });
  if (error) throw error;
  // Confirmer la sauvegarde et relire le premier instantané si deux validations ont eu lieu en parallèle.
  const { data, error: readError } = await supabase.from('app_settings').select('value').eq('key', cle(lotId)).single();
  if (readError) throw readError;
  return lireTarifsFiges(data.value);
}
