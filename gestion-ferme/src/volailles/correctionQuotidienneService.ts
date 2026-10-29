import { supabase } from '../supabaseClient';
import { chargerLotsAvecMouvements } from './volaillesData';
import { verifierConsommationIdentique } from './controlesCoherenceService';
import { controlerCorrection, stockDisponibleCorrection, type MouvementQuotidien } from './correctionQuotidienne';
import type { LotQuotidien } from './saisieQuotidienne';

export async function corrigerMouvementQuotidien(lot: LotQuotidien, type: 'aliment' | 'mortalite', ancien: MouvementQuotidien, date: string, quantite: number, aliment: string) {
  const maintenant = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date());
  const table = type === 'aliment' ? 'consommations_aliment' : lot.source === 'sica' ? 'mortalites_volailles' : 'direct_sale_mortalities';
  const champ = type === 'aliment' ? 'quantite_kg' : lot.source === 'sica' ? 'nombre' : 'quantity';
  const cleLot = type === 'aliment' && lot.source === 'vente_directe' ? 'direct_sale_lot_id' : 'lot_id';
  const courant = await supabase.from(table).select('*').eq('id', ancien.id).eq(cleLot, lot.id).single();
  if (courant.error) throw new Error('La saisie ne peut pas être relue. Actualisez la page avant de réessayer.');
  if (courant.data.date !== ancien.date || Number(courant.data[champ]) !== ancien.quantite || (type === 'aliment' && courant.data.feed_type !== ancien.aliment)) throw new Error('Cette saisie a changé depuis son ouverture. Fermez le formulaire et actualisez la page.');
  let effectifs: { remaining_quantity: number; mortality_count: number; status: string } | null = null;
  if (type === 'aliment') {
    const frais = await supabase.from(lot.source === 'sica' ? 'lots_volailles' : 'direct_sale_lots').select(lot.source === 'sica' ? 'date_arrivee' : 'arrival_date').eq('id', lot.id).single();
    if (frais.error) throw new Error('Le lot ne peut pas être vérifié. Réessayez.');
    controlerCorrection(date, quantite, 'date_arrivee' in frais.data ? frais.data.date_arrivee : frais.data.arrival_date, maintenant, type);
    if (!aliment.trim()) throw new Error('Choisissez un aliment.');
    const stock = await supabase.rpc('calculer_stock_aliment');
    if (stock.error) throw new Error('Le stock ne peut pas être vérifié. Réessayez.');
    const disponible = stockDisponibleCorrection(stock.data || [], ancien, aliment);
    if (quantite > disponible) throw new Error(`Stock insuffisant : ${disponible / 25} sac(s) disponible(s) en ${aliment}.`);
    if (await verifierConsommationIdentique(lot.id, lot.source, date, [{ feed_type: aliment, quantite_kg: quantite }], ancien.id)) {
      if (!window.confirm('Une autre consommation identique existe ce jour pour ce lot. Confirmer la modification ?')) return false;
    }
  } else if (lot.source === 'sica') {
    const frais = (await chargerLotsAvecMouvements(true)).find(l => l.id === lot.id);
    if (!frais) throw new Error('Le lot n’est plus disponible. Actualisez la page.');
    controlerCorrection(date, quantite, frais.date_arrivee, maintenant, type);
    if (quantite > frais.sujets_restants + ancien.quantite) throw new Error(`Le maximum disponible est de ${frais.sujets_restants + ancien.quantite} sujets.`);
  } else {
    const frais = await supabase.from('direct_sale_lots').select('arrival_date,remaining_quantity,mortality_count,status').eq('id', lot.id).single();
    if (frais.error) throw new Error('Les effectifs ne peuvent pas être vérifiés. Réessayez.');
    controlerCorrection(date, quantite, frais.data.arrival_date, maintenant, type);
    effectifs = { remaining_quantity: Number(frais.data.remaining_quantity), mortality_count: Number(frais.data.mortality_count), status: frais.data.status };
    if (quantite > effectifs.remaining_quantity + ancien.quantite) throw new Error(`Le maximum disponible est de ${effectifs.remaining_quantity + ancien.quantite} sujets.`);
  }
  const valeurs = type === 'aliment' ? { date, feed_type: aliment.trim(), quantite_kg: quantite } : { date, [champ]: quantite };
  let miseAJour = supabase.from(table).update(valeurs).eq('id', ancien.id).eq(cleLot, lot.id).eq('date', ancien.date).eq(champ, ancien.quantite);
  if (type === 'aliment') miseAJour = miseAJour.eq('feed_type', ancien.aliment);
  const resultat = await miseAJour.select('id').single();
  if (resultat.error) throw new Error('La modification n’a pas pu être confirmée. Actualisez les données avant de réessayer.');
  // La vente directe conserve aussi les compteurs dans sa fiche de lot.
  if (effectifs && quantite !== ancien.quantite) {
    const delta = quantite - ancien.quantite;
    const nouveaux = { mortality_count: effectifs.mortality_count + delta, remaining_quantity: effectifs.remaining_quantity - delta };
    const totaux = await supabase.from('direct_sale_lots').update(nouveaux).eq('id', lot.id)
      .eq('mortality_count', effectifs.mortality_count).eq('remaining_quantity', effectifs.remaining_quantity).eq('status', effectifs.status).select('id').single();
    if (totaux.error) {
      // Une reponse reseau perdue peut masquer une mise a jour deja appliquee.
      const verification = await supabase.from('direct_sale_lots').select('mortality_count,remaining_quantity').eq('id', lot.id).single();
      if (!totaux.error.code && !verification.error && Number(verification.data.mortality_count) === nouveaux.mortality_count && Number(verification.data.remaining_quantity) === nouveaux.remaining_quantity) return true;
      if (verification.error) throw new Error('La mortalité a été modifiée mais les effectifs ne peuvent pas être confirmés. Actualisez la page et contrôlez la fiche du lot.');
      const annulation = await supabase.from(table).update({ date: ancien.date, quantity: ancien.quantite }).eq('id', ancien.id).eq('date', date).eq('quantity', quantite).select('id').single();
      if (annulation.error) throw new Error('La mortalité a changé mais les effectifs n’ont pas pu être actualisés. Actualisez la page et contrôlez la fiche du lot.');
      throw new Error('Les effectifs n’ont pas pu être mis à jour. La modification a été annulée ; actualisez la page avant de réessayer.');
    }
  }
  return true;
}
