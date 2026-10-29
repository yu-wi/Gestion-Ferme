import { cleAliment } from './saisieQuotidienne.ts';
export type MouvementQuotidien = { id: string; date: string; quantite: number; aliment?: string };
export function controlerCorrection(date: string, quantite: number, arrivee: string, aujourdHui: string, type: 'aliment' | 'mortalite') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date < arrivee || date > aujourdHui) throw new Error('La date doit être valide, comprise entre l’arrivée du lot et aujourd’hui.');
  if (!Number.isFinite(quantite) || quantite <= 0 || (type === 'mortalite' && !Number.isSafeInteger(quantite))) throw new Error(type === 'mortalite' ? 'Indiquez un nombre entier de mortalités supérieur à zéro.' : 'Indiquez une quantité d’aliment supérieure à zéro.');
}
export function stockDisponibleCorrection(stocks: { feed_type: string; stock_kg: number }[], ancien: MouvementQuotidien, aliment: string) {
  return stocks.filter(s => cleAliment(s.feed_type) === cleAliment(aliment)).reduce((n, s) => n + Number(s.stock_kg), 0) + (cleAliment(ancien.aliment || '') === cleAliment(aliment) ? ancien.quantite : 0);
}
