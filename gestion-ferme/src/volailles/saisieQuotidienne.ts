export type LotQuotidien = { id: string; source: 'sica' | 'vente_directe'; nom: string; arrivee: string; restants: number };
export type SaisieQuotidienne = { lot_id: string; source: LotQuotidien['source']; aliment: string; sacs: string; morts: string; secondAliment?: string; secondSacs?: string };
export const cleAliment = (texte: string) => texte.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function preparerSaisie(date: string, aujourdHui: string, lignes: SaisieQuotidienne[], lots: LotQuotidien[], stocks: { feed_type: string; stock_kg: number }[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date > aujourdHui) throw new Error('Choisissez une date valide, au plus tard aujourd’hui.');
  const demandes = new Map<string, number>();
  const cles = new Set<string>();
  const resultat = lignes.filter(ligne => ligne.sacs.trim() !== '' || ligne.morts.trim() !== '' || !!ligne.secondAliment?.trim() || !!ligne.secondSacs?.trim()).map(ligne => {
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
    const secondAliment = ligne.secondAliment?.trim() || '';
    const secondSaisi = !!secondAliment || !!ligne.secondSacs?.trim();
    const secondSacs = Number(ligne.secondSacs || 0);
    if (secondSaisi && (!secondAliment || !Number.isInteger(secondSacs) || !Number.isFinite(secondSacs) || secondSacs <= 0)) throw new Error(`Lot ${lot.nom} : complétez le deuxième aliment et sa quantité positive en sacs entiers.`);
    if (secondSaisi && (!ligne.aliment.trim() || sacs <= 0)) throw new Error(`Lot ${lot.nom} : renseignez d’abord le premier aliment et sa quantité.`);
    if (secondSaisi && cleAliment(secondAliment) === cleAliment(ligne.aliment)) throw new Error(`Lot ${lot.nom} : choisissez deux aliments différents.`);
    for (const [type, nombre] of [[ligne.aliment, sacs], [secondAliment, secondSaisi ? secondSacs : 0]] as const) {
      if (nombre > 0) demandes.set(cleAliment(type), (demandes.get(cleAliment(type)) || 0) + nombre * 25);
    }
    return { lot_id: ligne.lot_id, source: ligne.source, aliment: ligne.aliment.trim(), quantite_kg: sacs * 25, morts,
      ...(secondSaisi ? { second_aliment: secondAliment, second_quantite_kg: secondSacs * 25 } : {}) };

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

export type ReferenceQuotidienne = { feed_type: string; age_min_days: number; age_max_days: number };
export function suggererAliment(arrivee: string, date: string, references: ReferenceQuotidienne[]) {
  const debut = Date.parse(`${arrivee}T00:00:00Z`), fin = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut || new Date(debut).toISOString().slice(0, 10) !== arrivee || new Date(fin).toISOString().slice(0, 10) !== date) return null;
  const age = Math.round((fin - debut) / 86400000);
  const candidats = references.filter(r => Number.isFinite(r.age_min_days) && Number.isFinite(r.age_max_days) && age >= r.age_min_days && age <= r.age_max_days && r.feed_type.trim());
  if (new Set(candidats.map(r => cleAliment(r.feed_type))).size !== 1) return null;
  return { age, aliment: candidats[0].feed_type.trim() };
}
export function projeterStockQuotidien(stocks: { feed_type: string; stock_kg: number }[], lignes: SaisieQuotidienne[]) {
  const aliments = new Map<string, { aliment: string; disponible: number; demande: number; restant: number }>();
  for (const s of stocks) {
    const cle = cleAliment(s.feed_type);
    const valeur = aliments.get(cle) || { aliment: s.feed_type, disponible: 0, demande: 0, restant: 0 };
    valeur.disponible += Number(s.stock_kg); aliments.set(cle, valeur);
  }
  let incomplet = false;
  for (const ligne of lignes) {
    if (ligne.secondAliment?.trim() && (!ligne.secondSacs?.trim() || Number(ligne.secondSacs) <= 0)) incomplet = true;
    if (ligne.secondAliment?.trim() && cleAliment(ligne.secondAliment) === cleAliment(ligne.aliment)) incomplet = true;
    for (const demande of [{ aliment: ligne.aliment, sacs: ligne.sacs }, { aliment: ligne.secondAliment || '', sacs: ligne.secondSacs || '' }]) {
      if (!demande.sacs.trim()) continue;
      const sacs = Number(demande.sacs);
      if (!Number.isFinite(sacs) || sacs < 0 || !Number.isInteger(sacs) || (sacs > 0 && !demande.aliment.trim())) { incomplet = true; continue; }
      if (!sacs) continue;
      const cle = cleAliment(demande.aliment);
      const valeur = aliments.get(cle) || { aliment: demande.aliment, disponible: 0, demande: 0, restant: 0 };
      valeur.demande += sacs * 25; aliments.set(cle, valeur);
    }
  }

  return { incomplet, aliments: [...aliments.values()].map(a => ({ ...a, restant: a.disponible - a.demande })) };
}
