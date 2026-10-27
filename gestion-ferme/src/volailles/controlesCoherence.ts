export type LivraisonControle = { id?: string; date: string; quantite: number; poids: number };
const normaliser = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function controlerLivraisons(
  lot: { quantite: number; autoconsommation: number; mortalites: { nombre: number }[]; livraisons: LivraisonControle[]; dateArrivee: string },
  nouvelles: LivraisonControle[],
  idModifie?: string,
) {
  for (const ligne of nouvelles) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ligne.date) || Number.isNaN(Date.parse(ligne.date)) || new Date(ligne.date).toISOString().slice(0, 10) !== ligne.date ||
      !Number.isInteger(ligne.quantite) || ligne.quantite <= 0 || !Number.isFinite(ligne.poids) || ligne.poids <= 0) {
      return { erreur: 'Chaque livraison doit avoir une date valide, un nombre entier positif de sujets et un poids positif.', doublon: false };
    }
    if (ligne.date < lot.dateArrivee) return { erreur: 'Une livraison ne peut pas précéder l’arrivée du lot.', doublon: false };
  }
  const existantes = lot.livraisons.filter(ligne => ligne.id !== idModifie);
  const disponible = lot.quantite - lot.autoconsommation - lot.mortalites.reduce((s, m) => s + m.nombre, 0) - existantes.reduce((s, l) => s + l.quantite, 0);
  if (nouvelles.reduce((s, l) => s + l.quantite, 0) > disponible) return { erreur: `Le maximum disponible est de ${Math.max(0, disponible)} sujets.`, doublon: false };
  const vues = new Set(existantes.map(ligne => `${ligne.date}|${ligne.quantite}|${ligne.poids}`));
  let doublon = false;
  for (const ligne of nouvelles) {
    const cle = `${ligne.date}|${ligne.quantite}|${ligne.poids}`;
    if (vues.has(cle)) doublon = true;
    vues.add(cle);
  }
  return { erreur: null, doublon };
}

export function consommationIdentique(
  existantes: { id: string; feed_type: string; quantite_kg: number }[],
  demandes: { feed_type: string; quantite_kg: number }[], idModifie?: string,
) {
  return demandes.some(demande => existantes.some(ligne => ligne.id !== idModifie &&
    normaliser(ligne.feed_type) === normaliser(demande.feed_type) && Number(ligne.quantite_kg) === demande.quantite_kg));
}

export function joursSansSaisie(dateArrivee: string, aujourdHui: string, datesSaisies: string[], jours = 7) {
  const dates = new Set(datesSaisies);
  const manquants: string[] = [];
  const fin = new Date(`${aujourdHui}T00:00:00Z`);
  for (let recul = jours; recul >= 1; recul--) {
    const date = new Date(fin); date.setUTCDate(fin.getUTCDate() - recul);
    const iso = date.toISOString().slice(0, 10);
    if (iso >= dateArrivee && !dates.has(iso)) manquants.push(iso);
  }
  return manquants;
}
