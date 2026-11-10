import { seuilsEauDefaut, type SeuilsEau } from './seuilsEau.ts';
import { trierMesuresEau } from './heureMesure.ts';
import { instantMesureEau, type MesureAnalyseEau } from './analyseEau.ts';
export const seuilsEau = seuilsEauDefaut;
export function alertesBassinEau(mesures: MesureAnalyseEau[], bassinId: string, maintenant = Date.now(), seuils: SeuilsEau = seuilsEauDefaut) {
  const mesure = trierMesuresEau(mesures.filter(m => m.basin_id === bassinId && m.target_type !== 'cuve'))[0];
  if (!mesure) return ['Aucun relevé enregistré'];
  const messages: string[] = [];
  for (const [cle, nom] of [['ph', 'pH'], ['conductivity', 'EC']] as const) {
    const valeur = mesure[cle];
    if (valeur === null || !Number.isFinite(Number(valeur))) messages.push(`${nom} non renseigné`);
    else if (Number(valeur) < seuils[cle]) messages.push(`${nom} ${Number(valeur).toLocaleString('fr-FR')} : sous le seuil de ${seuils[cle]}`);
  }
  const instant = instantMesureEau(mesure.measure_date, mesure.measure_time);
  if (instant === null) messages.push('Heure du dernier relevé inconnue : fraîcheur à vérifier');
  else if (instant > maintenant) messages.push('Dernier relevé daté dans le futur : à vérifier');
  else if (maintenant - instant > seuils.delaiHeures * 3600000) messages.push(`Dernier relevé datant de plus de ${seuils.delaiHeures} h`);
  return messages;
}
