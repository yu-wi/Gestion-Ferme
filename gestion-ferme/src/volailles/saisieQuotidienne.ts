export type LotQuotidien = { id: string; source: 'sica' | 'vente_directe'; nom: string; arrivee: string; restants: number };
export type SaisieQuotidienne = { lot_id: string; source: LotQuotidien['source']; aliment: string; sacs: string; morts: string };
export const cleAliment = (texte: string) => texte.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function preparerSaisie(date: string, aujourdHui: string, lignes: SaisieQuotidienne[], lots: LotQuotidien[], stocks: { feed_type: string; stock_kg: number }[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date > aujourdHui) throw new Error('Choisissez une date valide, au plus tard aujourd’hui.');
  const demandes = new Map<string, number>();
  const cles = new Set<string>();
  const resultat = lignes.filter(ligne => ligne.sacs.trim() !== '' || ligne.morts.trim() !== '').map(ligne => {
    const cle = `${ligne.source}:${ligne.lot_id}`;
    const lot = lots.find(item => `${item.source}:${item.id}` === cle);
    if (!lot || lot.arrivee > date) throw new Error('La date doit être postérieure ou égale à l’arrivée de chaque lot.');
    if (cles.has(cle)) throw new Error('Un lot apparaît plusieurs fois.');
    cles.add(cle);
    const sacs = ligne.sacs.trim() === '' ? 0 : Number(ligne.sacs);
    const morts = ligne.morts.trim() === '' ? 0 : Number(ligne.morts);
    if (!Number.isFinite(sacs) || sacs < 0 || !Number.isInteger(sacs) || !Number.isSafeInteger(morts) || morts < 0) throw new Error(`Lot ${lot.nom} : indiquez des nombres entiers positifs ou nuls.`);
    if (morts > lot.restants) throw new Error(`Lot ${lot.nom} : seuls ${lot.restants} sujets restent disponibles.`);
    if (sacs && !ligne.aliment.trim()) throw new Error(`Lot ${lot.nom} : choisissez l’aliment.`);
    const aliment = cleAliment(ligne.aliment);
    if (sacs > 0) demandes.set(aliment, (demandes.get(aliment) || 0) + sacs * 25);
    return { lot_id: ligne.lot_id, source: ligne.source, aliment: ligne.aliment.trim(), quantite_kg: sacs * 25, morts };
  }).filter(ligne => ligne.quantite_kg > 0 || ligne.morts > 0);
  for (const [aliment, kg] of demandes) {
    const disponible = stocks.filter(stock => cleAliment(stock.feed_type) === aliment).reduce((somme, stock) => somme + Number(stock.stock_kg), 0);
    if (kg > disponible) throw new Error(`Stock insuffisant en ${aliment} : ${disponible / 25} sac(s) disponible(s), ${kg / 25} demandé(s) au total.`);
  }
  if (!resultat.length) throw new Error('Renseignez au moins une consommation ou une mortalité.');
  return resultat;
}

export function repartirLotsQuotidiens(
  lots: LotQuotidien[], date: string,
  consommations: { lot_id: string | null; direct_sale_lot_id: string | null; date: string }[],
  mortalitesSica: { lot_id: string; date: string }[], mortalitesDirectes: { lot_id: string; date: string }[],
) {
  const aRenseigner: LotQuotidien[] = [];
  const renseignes: LotQuotidien[] = [];
  for (const lot of lots) {
    if (lot.arrivee > date) continue;
    const alimentSaisi = consommations.some(c => c.date === date && (lot.source === 'sica' ? c.lot_id === lot.id : c.direct_sale_lot_id === lot.id));
    const mortaliteSaisie = (lot.source === 'sica' ? mortalitesSica : mortalitesDirectes).some(m => m.date === date && m.lot_id === lot.id);
    if (lot.restants <= 0 && !alimentSaisi && !mortaliteSaisie) continue;
    // Sans deces, aucune ligne de mortalite n'est creee : ne pas l'exiger pour terminer la journee.
    if (alimentSaisi || lot.restants <= 0) renseignes.push(lot);
    else aRenseigner.push(lot);
  }
  return { aRenseigner, renseignes };
}
