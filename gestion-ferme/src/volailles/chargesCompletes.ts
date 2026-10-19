const CATEGORIES_REQUISES = ["aliment", "achat_poussins", "ramassage", "livraison"];

export function trouverLotsAvecChargesCompletes(
  charges: { lot_id: string; type_charge: string }[],
  consommations: { lot_id: string | null }[],
): Set<string> {
  const categoriesParLot = new Map<string, Set<string>>();
  const ajouter = (lotId: string, categorie: string) => {
    const categories = categoriesParLot.get(lotId) || new Set<string>();
    categories.add(categorie);
    categoriesParLot.set(lotId, categories);
  };
  for (const charge of charges) ajouter(charge.lot_id, charge.type_charge);
  for (const consommation of consommations) {
    if (consommation.lot_id) ajouter(consommation.lot_id, "aliment");
  }
  return new Set(
    [...categoriesParLot]
      .filter(([, categories]) => CATEGORIES_REQUISES.every((categorie) => categories.has(categorie)))
      .map(([lotId]) => lotId),
  );
}
