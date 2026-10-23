export const tarifsChargesParDefaut = {
  poultry_collection_price_ht: "0.1415",
  poultry_collection_vat: "8.5",
  poultry_transport_price_ht: "100",
  poultry_transport_vat: "2.1",
};

export const libellesTarifsCharges = {
  poultry_collection_price_ht: "Ramassage (€ HT / volaille)",
  poultry_collection_vat: "TVA ramassage (%)",
  poultry_transport_price_ht: "Transport (€ HT / livraison)",
  poultry_transport_vat: "TVA transport (%)",
};

export function lireTarifsCharges(rows: { key: string; value: string }[]) {
  const tarifs = { ...tarifsChargesParDefaut };
  for (const row of rows) {
    if (!(row.key in tarifs)) continue;
    if (!row.value.trim() || !Number.isFinite(Number(row.value)) || Number(row.value) < 0) {
      throw new Error("Tarifs de charges invalides. Vérifiez les paramètres volailles.");
    }
    tarifs[row.key as keyof typeof tarifs] = row.value;
  }
  return tarifs;
}

export type TarifsCharges = typeof tarifsChargesParDefaut;
export type CategorieAutomatique = "ramassage" | "livraison";

export function calculerChargesLivraisons(
  livraisons: { quantite: number }[],
  tarifs: TarifsCharges,
): Record<CategorieAutomatique, number> {
  const sujets = livraisons.reduce((total, livraison) => total + livraison.quantite, 0);
  const ttc = (quantite: number, prix: string, tva: string) =>
    Math.round((quantite * Number(prix) * (1 + Number(tva) / 100) + Number.EPSILON) * 100) / 100;
  return {
    ramassage: ttc(sujets, tarifs.poultry_collection_price_ht, tarifs.poultry_collection_vat),
    livraison: ttc(livraisons.length, tarifs.poultry_transport_price_ht, tarifs.poultry_transport_vat),
  };
}

export function completerChargesLivraisons(
  charges: { type_charge: string; montant: number }[],
  livraisons: { quantite: number }[],
  tarifs: TarifsCharges,
) {
  const resultat = [...charges];
  if (!livraisons.length) return resultat;
  const propositions = calculerChargesLivraisons(livraisons, tarifs);
  for (const type of ["ramassage", "livraison"] as const) {
    if (!charges.some((charge) => charge.type_charge === type)) {
      resultat.push({ type_charge: type, montant: propositions[type] });
    }
  }
  return resultat;
}
