import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';
import { formatDateCourte } from '../outils/formatNombre';

type Lot = { id: string; source: 'sica' | 'vente_directe'; label: string; restants: number; dateArrivee: string };
type Consommation = { lot_id: string | null; direct_sale_lot_id: string | null };
type Livraison = { lot_id: string; delivery_date: string };
type Stock = { feed_type: string; stock_kg: number };
const jourMartinique = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date());
export default function ActionsVolailles({ lots, busy, incomplet }: { lots: Lot[]; busy: boolean; incomplet: boolean }) {
  const [consommations, setConsommations] = useState<Consommation[] | null>(null);
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [stocks, setStocks] = useState<Stock[] | null>(null);
  const [loading, setLoading] = useState(true);
  const aujourdHui = jourMartinique();
  useEffect(() => {
    if (busy) return;
    let active = true;
    const charger = async () => {
      setLoading(true);
      const fin = new Date(`${aujourdHui}T12:00:00Z`);
      fin.setUTCDate(fin.getUTCDate() + 7);
      const resultats = await Promise.allSettled([
        chargerPages((a, b) => supabase.from('consommations_aliment').select('id,lot_id,direct_sale_lot_id').eq('date', aujourdHui).order('id').range(a, b)),
        chargerPages((a, b) => supabase.from('sica_delivery_schedule').select('id,lot_id,delivery_date').gte('delivery_date', aujourdHui).lte('delivery_date', fin.toISOString().slice(0, 10)).order('delivery_date').order('id').range(a, b)),
        (async () => { const resultat = await supabase.rpc('calculer_stock_aliment'); if (resultat.error) throw resultat.error; return resultat.data as Stock[]; })(),
      ]);
      if (!active) return;
      setConsommations(resultats[0].status === 'fulfilled' ? resultats[0].value : null);
      setLivraisons(resultats[1].status === 'fulfilled' ? resultats[1].value : null);
      setStocks(resultats[2].status === 'fulfilled' ? resultats[2].value : null);
      setLoading(false);
    };
    void charger();
    return () => { active = false; };
  }, [aujourdHui, busy]);
  const disponibles = lots.filter(lot => lot.restants > 0 && lot.dateArrivee <= aujourdHui);
  const manquants = disponibles.filter(lot => !consommations?.some(c => lot.source === 'sica' ? c.lot_id === lot.id : c.direct_sale_lot_id === lot.id));
  const prochaines = livraisons?.filter(l => disponibles.some(lot => lot.source === 'sica' && lot.id === l.lot_id)) || [];
  const epuises = stocks?.filter(s => Number(s.stock_kg) <= 0) || [];
  return <section className="poultry-panel poultry-today" aria-labelledby="actions-jour">
    <div className="poultry-panel-heading"><div><h2 id="actions-jour">À faire aujourd’hui</h2><p>Priorités du {formatDateCourte(new Date(`${aujourdHui}T12:00:00`))}</p></div><Link className="poultry-daily-link" to="/volailles/saisie-quotidienne">✓ Saisie quotidienne</Link></div>
    {incomplet && <p className="feed-warning">Certains lots n’ont pas pu être chargés. Les actions ci-dessous concernent uniquement les lots disponibles.</p>}
    {loading ? <p role="status">Actualisation des actions…</p> : <div className="poultry-today-grid">
      <article><h3>▣ Alimentation du jour</h3>{consommations === null ? <p>Suivi indisponible. Consultez l’alimentation pour réessayer.</p> : <><strong>{manquants.length ? `${manquants.length} lot(s) à renseigner` : incomplet ? 'Saisies des lots disponibles à jour' : 'Toutes les saisies sont à jour'}</strong><p>{disponibles.length - manquants.length} sur {disponibles.length} lots renseignés</p>{manquants.length > 0 && <details><summary>Voir les lots concernés</summary><ul>{manquants.map(lot => <li key={`${lot.source}:${lot.id}`}>{lot.label}</li>)}</ul></details>}</>}<Link to={consommations === null ? '/volailles/alimentation' : '/volailles/saisie-quotidienne'}>Ouvrir la saisie →</Link></article>
      <article><h3>🚚 Livraisons SICA prévues</h3>{livraisons === null ? <p>Prévisions indisponibles. Consultez le planning.</p> : prochaines.length ? <ul>{prochaines.map(l => <li key={l.lot_id}>{disponibles.find(lot => lot.source === 'sica' && lot.id === l.lot_id)?.label} · {l.delivery_date === aujourdHui ? 'Aujourd’hui' : formatDateCourte(new Date(`${l.delivery_date}T12:00:00`))}</li>)}</ul> : <p>Aucune livraison planifiée dans les 7 prochains jours.</p>}<Link to="/planning">Voir le planning →</Link></article>
      <article><h3>⌁ Stock d’aliment</h3>{stocks === null ? <p>Stock indisponible. Consultez le suivi alimentation.</p> : epuises.length ? <><strong>{epuises.length} aliment(s) épuisé(s)</strong><ul>{epuises.map(s => <li key={s.feed_type}>{s.feed_type} · {(Number(s.stock_kg) / 25).toLocaleString('fr-FR')} sacs</li>)}</ul></> : <p>{stocks.length ? 'Aucun aliment épuisé. Consultez les prévisions pour anticiper la commande.' : 'Aucun mouvement de stock enregistré.'}</p>}<Link to="/volailles/alimentation?onglet=stock">Stock et commandes →</Link></article>
    </div>}
  </section>;
}
