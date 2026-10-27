import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';

export type MortaliteVolaille = {
  id: string;
  lot_id: string;
  date: string;
  nombre: number;
};

export type LivraisonVolaille = {
  id: string;
  lot_id: string;
  date: string;
  quantite: number;
  poids: number;
};

export type LotAvecMouvements = Record<string, any> & {
  id: string;
  mortalites: MortaliteVolaille[];
  livraisons: LivraisonVolaille[];
  nb_morts: number;
  sujets_restants: number;
  total_poids_livre: number;
};

export async function chargerLotsAvecMouvements(isActive?: boolean): Promise<LotAvecMouvements[]> {
  const lots = await chargerPages((debut, fin) => {
    let query = supabase.from('lots_volailles').select('*').order('id').range(debut, fin);
    if (typeof isActive === 'boolean') query = query.eq('is_active', isActive);
    return query;
  });
  if (!lots.length) return [];
  const lotIds = lots.map(lot => lot.id);
  const mortalitesResult: MortaliteVolaille[] = [];
  const livraisonsResult: LivraisonVolaille[] = [];
  // Charger tous les mouvements, sans dépasser la taille des filtres d'URL.
  for (let index = 0; index < lotIds.length; index += 100) {
    const ids = lotIds.slice(index, index + 100);
    const [mortalites, livraisons] = await Promise.all([
      chargerPages((debut, fin) => supabase.from('mortalites_volailles').select('id, lot_id, date, nombre')
        .in('lot_id', ids).order('date').order('id').range(debut, fin)),
      chargerPages((debut, fin) => supabase.from('livraisons_volailles').select('id, lot_id, date, quantite, poids')
        .in('lot_id', ids).order('date').order('id').range(debut, fin)),
    ]);
    mortalitesResult.push(...mortalites);
    livraisonsResult.push(...livraisons);
  }

  return lots.map((lot) => {
    const mortalites = mortalitesResult
      .filter((mortalite) => mortalite.lot_id === lot.id)
      .map((mortalite) => ({
        ...mortalite,
        nombre: Number(mortalite.nombre) || 0,
      }));
    const livraisons = livraisonsResult
      .filter((livraison) => livraison.lot_id === lot.id)
      .map((livraison) => ({
        ...livraison,
        quantite: Number(livraison.quantite) || 0,
        poids: Number(livraison.poids) || 0,
      }));
    const nbMorts = mortalites.reduce((total, mortalite) => total + mortalite.nombre, 0);
    const quantiteLivree = livraisons.reduce((total, livraison) => total + livraison.quantite, 0);
    const totalPoidsLivre = livraisons.reduce((total, livraison) => total + livraison.poids, 0);
    const derniereLivraison = livraisons
      .map((livraison) => livraison.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    const ageCloture =
      lot.is_active === false && derniereLivraison
        ? Math.max(
            0,
            Math.floor(
              (new Date(`${derniereLivraison}T00:00:00`).getTime() -
                new Date(`${lot.date_arrivee}T00:00:00`).getTime()) /
                86400000
            )
          )
        : Number(lot.age) || 0;

    return {
      ...lot,
      age: ageCloture,
      mortalites,
      livraisons,
      nb_morts: nbMorts,
      sujets_restants: (Number(lot.quantite) || 0) - nbMorts - (Number(lot.autoconsommation) || 0) - quantiteLivree,
      total_poids_livre: totalPoidsLivre,
    };
  });
}

export async function supprimerLotEtDonnees(lotId: string) {
  const { error } = await supabase.rpc('supprimer_lot_volaille', {
    p_lot_id: lotId,
  });
  if (error) throw error;
}
