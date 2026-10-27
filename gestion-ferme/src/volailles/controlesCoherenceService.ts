import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';
import { controlerLivraisons, consommationIdentique, type LivraisonControle } from './controlesCoherence';

export async function verifierLivraisonsSica(lotId: string, lignes: LivraisonControle[], idModifie?: string) {
  const [lot, mortalites, livraisons] = await Promise.all([
    supabase.from('lots_volailles').select('quantite, autoconsommation, date_arrivee').eq('id', lotId).single(),
    chargerPages((debut, fin) => supabase.from('mortalites_volailles').select('nombre').eq('lot_id', lotId).order('id').range(debut, fin)),
    chargerPages((debut, fin) => supabase.from('livraisons_volailles').select('id, date, quantite, poids').eq('lot_id', lotId).order('id').range(debut, fin)),
  ]);
  if (lot.error) throw lot.error;
  return controlerLivraisons({ quantite: Number(lot.data.quantite), autoconsommation: Number(lot.data.autoconsommation) || 0,
    dateArrivee: lot.data.date_arrivee,
    mortalites: mortalites.map(row => ({ nombre: Number(row.nombre) })),
    livraisons: livraisons.map(row => ({ ...row, quantite: Number(row.quantite), poids: Number(row.poids) })),
  }, lignes, idModifie);
}

export async function verifierConsommationIdentique(
  lotId: string, source: 'sica' | 'vente_directe', date: string,
  demandes: { feed_type: string; quantite_kg: number }[], idModifie?: string,
) {
  const existantes = await chargerPages((debut, fin) => supabase.from('consommations_aliment')
    .select('id, feed_type, quantite_kg').eq(source === 'sica' ? 'lot_id' : 'direct_sale_lot_id', lotId)
    .eq('date', date).order('id').range(debut, fin));
  return consommationIdentique(existantes, demandes, idModifie);
}

export async function verifierDoublonLivraisonDirecte(
  clientId: string, date: string,
  lignes: { lot_id: string; quantity_delivered: number; total_weight: number; pricing_mode: string; unit_price: number }[],
  batchModifie?: string,
) {
  const existantes = await chargerPages((debut, fin) => supabase.from('direct_sale_deliveries')
    .select('id, batch_id, lot_id, quantity_delivered, total_weight, pricing_mode, unit_price')
    .eq('customer_id', clientId).eq('delivery_date', date).order('id').range(debut, fin));
  const cle = (row: { lot_id: string; quantity_delivered: number; total_weight: number | null; pricing_mode: string; unit_price: number }) =>
    JSON.stringify([row.lot_id, Number(row.quantity_delivered), Number(row.total_weight) || 0, row.pricing_mode, Number(row.unit_price)]);
  const cles = new Set(existantes.filter(row => (row.batch_id || row.id) !== batchModifie).map(cle));
  let doublon = false;
  for (const ligne of lignes) { const key = cle(ligne); if (cles.has(key)) doublon = true; cles.add(key); }
  return doublon;
}
