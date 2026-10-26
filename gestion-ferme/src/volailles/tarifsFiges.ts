import { lireTarifsCharges, type TarifsCharges } from './tarifsCharges.ts';

export type TarifsFiges = {
  version: 1;
  date: string;
  origine: 'archivage' | 'historique';
  references: { feed_type: string; feed_price_ht: number | null }[];
  tarifs: TarifsCharges;
  tvaAliment: number;
};

export function creerTarifsFiges(
  references: { feed_type: string; feed_price_ht: number | null }[],
  tarifs: TarifsCharges,
  origine: TarifsFiges['origine'],
): TarifsFiges {
  return { version: 1, date: new Date().toISOString(), origine,
    references: references.map(row => ({ ...row })), tarifs: { ...tarifs }, tvaAliment: 0.021 };
}

export function lireTarifsFiges(value: string): TarifsFiges {
  const row = JSON.parse(value) as TarifsFiges;
  if (row.version !== 1 || !Number.isFinite(Date.parse(row.date)) ||
      !['archivage', 'historique'].includes(row.origine) ||
      !Array.isArray(row.references) || !row.tarifs ||
      !Number.isFinite(row.tvaAliment) || row.tvaAliment < 0 ||
      row.references.some(ref => typeof ref.feed_type !== 'string' ||
        (ref.feed_price_ht !== null && (!Number.isFinite(ref.feed_price_ht) || ref.feed_price_ht < 0)))) {
    throw new Error('Tarifs figés invalides : le calcul historique est interrompu pour éviter un montant erroné.');
  }
  const tarifs = lireTarifsCharges(Object.entries(row.tarifs).map(([key, value]) => ({ key, value })));
  if (Object.keys(tarifs).some(key => !(key in row.tarifs))) throw new Error('Tarifs figés incomplets.');
  return { ...row, tarifs };
}
