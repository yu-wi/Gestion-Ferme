export function livraisonSicaPrevue(datePlanifiee: string | null, datesLivrees: string[], aujourdHui: string) {
  if (!datePlanifiee || datesLivrees.some(date => date >= datePlanifiee)) return { date: null, retard: false };
  return { date: datePlanifiee, retard: datePlanifiee < aujourdHui };
}
export function prochaineCommande<T extends { delivery_date: string; status: string; lot_id: string | null }>(commandes: T[], lotId: string) {
  return commandes.filter(c => c.lot_id === lotId && (c.status === 'a_preparer' || c.status === 'prete')).sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))[0] || null;
}
