import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';
import { chargerTarifsFiges } from './tarifsFigesService';
import { calculerCoutAliment } from './coutAliment';
import { calculerChargesLot } from './chargesLot';
import { categoriesChargesProposees, lireTarifsCharges } from './tarifsCharges';

export async function chargerComparaison(
  lots: { id: string; livraisons: { quantite: number }[] }[],
  charges: { lot_id: string; type_charge: string; montant: number }[],
) {
  const consommations = new Map<string, number>();
  const estimations = new Set<string>();
  if (!lots.length) return { charges: [], consommations, estimations };
  const [conso, refs, reglages, snapshots] = await Promise.all([
    chargerPages((debut, fin) => supabase.from('consommations_aliment').select('lot_id, feed_type, quantite_kg')
      .in('lot_id', lots.map(lot => lot.id)).order('id').range(debut, fin)),
    supabase.from('feed_reference').select('feed_type, feed_price_ht').order('age_min_days'),
    supabase.from('app_settings').select('key, value').eq('category', 'volailles'),
    chargerTarifsFiges(),
  ]);
  if (refs.error) throw refs.error;
  if (reglages.error) throw reglages.error;
  const tarifs = lireTarifsCharges(reglages.data || []);
  const calculees = lots.flatMap(lot => {
    const lignes = conso.filter(item => item.lot_id === lot.id);
    if (lignes.length) consommations.set(lot.id, lignes.reduce((total, item) => total + Number(item.quantite_kg), 0));
    const snapshot = snapshots.get(lot.id);
    const cout = calculerCoutAliment(lignes, snapshot?.references ?? refs.data ?? [], snapshot?.tvaAliment);
    const enregistrees = charges.filter(charge => charge.lot_id === lot.id);
    if (categoriesChargesProposees(enregistrees, lot.livraisons).length) estimations.add(lot.id);
    return calculerChargesLot(enregistrees, lot.livraisons, cout, snapshot?.tarifs ?? tarifs)
      .map(charge => ({ ...charge, lot_id: lot.id }));
  });
  return { charges: calculees, consommations, estimations };
}
