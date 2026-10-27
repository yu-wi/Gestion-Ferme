export type ElementManquant = {
  libelle: string;
  action: 'charges' | 'analyse' | 'quantite';
  categorie?: string;
};

export function elementsManquantsLot(
  lot: { id: string; quantite_retenue: number | null; livraisons: unknown[] },
  charges: { lot_id: string; type_charge: string }[],
  consommations: { lot_id: string | null }[],
  tarifsFiges: boolean,
): ElementManquant[] {
  const manquants: ElementManquant[] = [];
  const categories = new Set(charges.filter(charge => charge.lot_id === lot.id).map(charge => charge.type_charge));
  if (consommations.some(item => item.lot_id === lot.id)) categories.add('aliment');
  if (!lot.livraisons.length) manquants.push({ libelle: 'Aucune livraison enregistrée', action: 'analyse' });
  for (const [categorie, libelle] of [['achat_poussins', 'Achat poussins'], ['aliment', 'Aliment'], ['ramassage', 'Ramassage'], ['livraison', 'Transport']]) {
    if (!categories.has(categorie)) manquants.push({
      libelle: `${libelle} à ${lot.livraisons.length && ['ramassage', 'livraison'].includes(categorie) ? 'valider' : 'renseigner'}`,
      action: lot.livraisons.length && ['ramassage', 'livraison'].includes(categorie) ? 'analyse' : 'charges', categorie,
    });
  }
  if (lot.quantite_retenue == null) manquants.push({ libelle: 'Quantité retenue', action: 'quantite' });
  if (!tarifsFiges) manquants.push({ libelle: 'Tarifs à figer', action: 'analyse' });
  return manquants;
}
