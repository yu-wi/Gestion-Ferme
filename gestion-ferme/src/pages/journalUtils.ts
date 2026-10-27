export const tablesJournal: Record<string, string> = {
  lots_volailles: 'Lots SICA', charges: 'Charges', mortalites_volailles: 'Mortalités SICA',
  livraisons_volailles: 'Livraisons SICA', consommations_aliment: 'Consommations d’aliment',
  livraisons_aliment: 'Livraisons d’aliment', feed_reference: 'Références d’aliment', app_settings: 'Paramètres et tarifs figés',
  sica_delivery_schedule: 'Planning des livraisons', direct_sale_lots: 'Lots de vente directe',
  direct_sale_deliveries: 'Livraisons de vente directe', direct_sale_mortalities: 'Mortalités de vente directe',
  direct_sale_orders: 'Commandes de vente directe',
};
const libelles: Record<string, string> = {
  montant: 'Montant (€)', quantite: 'Quantité', quantite_kg: 'Quantité (kg)', poids: 'Poids (kg)',
  type_charge: 'Catégorie de charge', feed_type: 'Aliment', feed_price_ht: 'Prix du sac HT (€)',
  date: 'Date', nom: 'Nom', name: 'Nom', batiment: 'Bâtiment', is_active: 'Lot actif',
  resultat_brut: 'Recettes (€)', resultat_net: 'Résultat net (€)', quantite_retenue: 'Quantité retenue',
  autoconsommation: 'Autoconsommation', nombre: 'Nombre', note: 'Note', value: 'Valeur', key: 'Paramètre',
  quantity_delivered: 'Sujets livrés', total_weight: 'Poids total', amount_invoiced: 'Montant facturé',
  amount_paid: 'Montant réglé', unit_price: 'Prix unitaire', status: 'Statut',
};
export function champsModifies(avant: Record<string, unknown> | null, apres: Record<string, unknown> | null) {
  const ignores = new Set(['id', 'created_at', 'updated_at']);
  return [...new Set([...Object.keys(avant || {}), ...Object.keys(apres || {})])]
    .filter(key => !ignores.has(key) && JSON.stringify(avant?.[key] ?? null) !== JSON.stringify(apres?.[key] ?? null))
    .map(key => ({ key, label: libelles[key] || key.replaceAll('_', ' '), avant: avant?.[key] ?? null, apres: apres?.[key] ?? null }));
}
export function valeurJournal(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
export function borneDateJournal(date: string, lendemain = false) {
  const jour = new Date(`${date}T00:00:00Z`);
  if (lendemain) jour.setUTCDate(jour.getUTCDate() + 1);
  return `${jour.toISOString().slice(0, 10)}T00:00:00-04:00`;
}
export function echapperRechercheJournal(value: string) { return value.replace(/[\\%_]/g, '\\$&'); }
