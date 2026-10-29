export function indicateursComparaison(lot: {
  resultat: number | null; aliment: number | null; livres: number; poids: number;
  morts: number; initial: number; consommation: number | null;
}) {
  return {
    margeSujet: lot.livres > 0 && lot.resultat !== null ? lot.resultat / lot.livres : null,
    alimentKg: lot.poids > 0 && lot.aliment !== null ? lot.aliment / lot.poids : null,
    mortalite: lot.initial > 0 ? lot.morts / lot.initial * 100 : null,
    consommation: lot.consommation,
    ratioAliment: lot.poids > 0 && lot.consommation !== null ? lot.consommation / lot.poids : null,
  };
}

export type IndicateursComparaison = ReturnType<typeof indicateursComparaison>;
export function comparerMesures(a: number | null, b: number | null, croissant: boolean) {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return croissant ? a - b : b - a;
}

export function selectionnerLotsRecents<T extends { id: string; date: string; dateFin?: string | null }>(lots: T[], limite: number | null): T[] {
  const dateTri = (lot: T) => lot.dateFin || lot.date;
  const tries = [...lots].sort((a, b) => dateTri(b).localeCompare(dateTri(a)) || a.id.localeCompare(b.id));
  return limite === null ? tries : tries.slice(0, limite);
}
