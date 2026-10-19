type ConsommationAliment = { feed_type: string; quantite_kg: number | string };
type ReferenceAliment = { feed_type: string; feed_price_ht: number | string | null };

const normaliserAliment = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

// Même valorisation que la page Alimentation : quantité consommée / 25 kg × prix HT du sac.
// null distingue l'absence de saisie d'une consommation dont le coût est nul.
export function calculerCoutAliment(
  consommations: ConsommationAliment[],
  references: ReferenceAliment[],
): number | null {
  if (!consommations.length) return null;
  const prixParAliment = new Map<string, number>();
  for (const reference of references) {
    const key = normaliserAliment(reference.feed_type);
    if (!key || prixParAliment.has(key)) continue;
    const prix = reference.feed_price_ht == null ? NaN : Number(reference.feed_price_ht);
    if (Number.isFinite(prix) && prix >= 0) prixParAliment.set(key, prix);
  }
  return consommations.reduce((total, consommation) => {
    const prix = prixParAliment.get(normaliserAliment(consommation.feed_type));
    if (prix === undefined) {
      throw new Error(`Prix de l’aliment « ${consommation.feed_type} » manquant. Renseignez-le dans la page Alimentation.`);
    }
    return total + Number(consommation.quantite_kg) / 25 * prix;
  }, 0);
}

export function appliquerCoutAliment<T extends { type_charge: string; montant: number }>(
  charges: T[],
  coutAliment: number | null,
): { type_charge: string; montant: number }[] {
  if (coutAliment === null) return charges;
  return [
    ...charges.filter((charge) => charge.type_charge !== "aliment"),
    { type_charge: "aliment", montant: coutAliment },
  ];
}
