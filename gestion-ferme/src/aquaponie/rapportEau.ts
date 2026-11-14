import type { analyserEau } from './analyseEau.ts';
import type { reperesProduits } from './ajoutsProduits.ts';
export type RapportEau = {
  metrique: 'pH' | 'EC'; periode: string; debut: string; fin: string; bassins: string[];
  releves: ReturnType<typeof analyserEau>['releves'];
  ajouts: ReturnType<typeof reperesProduits>;
};
const dateLocale = (instant: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date(instant));
export function preparerRapportEau(donnees: ReturnType<typeof analyserEau>, ajouts: ReturnType<typeof reperesProduits>, metrique: 'pH' | 'EC', periode: 'jour' | 'semaine' | 'mois'): RapportEau {
  return {
    metrique, periode: periode === 'jour' ? 'Une journée' : periode === 'semaine' ? '7 jours' : 'Un mois',
    debut: dateLocale(donnees.debut), fin: dateLocale(donnees.fin - 1),
    bassins: donnees.series.map(s => s.name),
    releves: [...donnees.releves].sort((a,b) => a.date.localeCompare(b.date) || (a.heure || '').localeCompare(b.heure || '') || a.bassin.localeCompare(b.bassin) || a.id.localeCompare(b.id)),
    ajouts: [...ajouts],
  };
}
export const nomRapportEau = (r: RapportEau) => `aquaponie_${r.metrique.toLowerCase()}_${r.debut}_${r.fin}`;
