import { supabase } from '../supabaseClient';

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
  let lotsQuery = supabase.from('lots_volailles').select('*');

  if (typeof isActive === 'boolean') {
    lotsQuery = lotsQuery.eq('is_active', isActive);
  }

  const { data: lots, error: lotsError } = await lotsQuery;

  if (lotsError) {
    throw lotsError;
  }

  if (!lots?.length) {
    return [];
  }

  const lotIds = lots.map((lot) => lot.id);
  const [mortalitesResult, livraisonsResult] = await Promise.all([
    supabase
      .from('mortalites_volailles')
      .select('id, lot_id, date, nombre')
      .in('lot_id', lotIds)
      .order('date', { ascending: true }),
    supabase
      .from('livraisons_volailles')
      .select('id, lot_id, date, quantite, poids')
      .in('lot_id', lotIds)
      .order('date', { ascending: true }),
  ]);

  if (mortalitesResult.error) {
    throw mortalitesResult.error;
  }

  if (livraisonsResult.error) {
    throw livraisonsResult.error;
  }

  return lots.map((lot) => {
    const mortalites = (mortalitesResult.data || [])
      .filter((mortalite) => mortalite.lot_id === lot.id)
      .map((mortalite) => ({
        ...mortalite,
        nombre: Number(mortalite.nombre) || 0,
      }));
    const livraisons = (livraisonsResult.data || [])
      .filter((livraison) => livraison.lot_id === lot.id)
      .map((livraison) => ({
        ...livraison,
        quantite: Number(livraison.quantite) || 0,
        poids: Number(livraison.poids) || 0,
      }));
    const nbMorts = mortalites.reduce((total, mortalite) => total + mortalite.nombre, 0);
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
      sujets_restants: (Number(lot.quantite) || 0) - nbMorts - (Number(lot.autoconsommation) || 0),
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
