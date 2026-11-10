export const heureMesureValide = (heure: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(heure);
export function trierMesuresEau<T extends { measure_date: string; measure_time?: string | null }>(mesures: T[]) {
  return [...mesures].sort((a,b)=>b.measure_date.localeCompare(a.measure_date)||(b.measure_time||'').localeCompare(a.measure_time||''));
}
export const heureMartinique = () => new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Martinique',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
export const dateMartinique = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Martinique'}).format(new Date());
