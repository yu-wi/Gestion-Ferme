export type ActionFinalisation = 'charge' | 'validation' | 'tarifs' | 'recettes' | 'retenue' | 'livraison' | 'effectifs' | 'mortalite';
export type VerificationFinalisation = { id: string; libelle: string; raison: string; fait: boolean; action: ActionFinalisation; categorie?: string };
export function verifierFinalisationLot(lot: { resultat_brut: number | null; quantite_retenue: number | null; livraisons: unknown[]; sujets_restants: number }, charges: { type_charge: string }[], aValider: string[], tarifsFiges: boolean): VerificationFinalisation[] {
  const categories = new Set(charges.map(c => c.type_charge));
  const lignes: VerificationFinalisation[] = [ ['achat_poussins', 'Achat poussins'], ['aliment', 'Aliment'], ['ramassage', 'Ramassage'], ['livraison', 'Livraison'] ].map(([categorie, libelle]) => ({
    id: `charge-${categorie}`, libelle, categorie, fait: categories.has(categorie) && !aValider.includes(categorie),
    raison: `${libelle} : ${categories.has(categorie) ? 'estimation à valider' : 'montant non renseigné'}`,
    action: categories.has(categorie) ? 'validation' : 'charge',
  }));
  lignes.push(
    { id: 'tarifs', libelle: 'Tarifs figés', raison: 'Tarifs non figés', fait: tarifsFiges, action: 'tarifs' },
    { id: 'recettes', libelle: 'Recettes', raison: 'Recettes non renseignées', fait: lot.resultat_brut != null, action: 'recettes' },
    { id: 'retenue', libelle: 'Quantité retenue', raison: 'Quantité retenue non renseignée', fait: lot.quantite_retenue != null, action: 'retenue' },
    { id: 'livraisons', libelle: 'Livraisons enregistrées', raison: 'Aucune livraison enregistrée', fait: lot.livraisons.length > 0, action: 'livraison' },
    { id: 'effectifs', libelle: 'Effectifs soldés', raison: lot.sujets_restants < 0 ? 'Effectif incohérent : solde négatif' : 'Des sujets restent dans le lot', fait: lot.sujets_restants === 0, action: 'effectifs' },
  );
  return lignes;
}
export type SaisieFinalisation = { valeur: string; date: string; quantite: string; poids: string };
export function verifierValeurFinalisation(action: ActionFinalisation, saisie: SaisieFinalisation) {
  const valeur = Number(saisie.valeur);
  if (['charge','recettes','retenue','effectifs'].includes(action) && (!saisie.valeur.trim() || !Number.isFinite(valeur) || valeur < 0 || (action === 'effectifs' && !Number.isSafeInteger(valeur)))) throw new Error('Indiquez une valeur positive ou nulle valide.');
  return valeur;
}
