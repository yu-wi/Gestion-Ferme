import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMontant, formatNombre } from '../outils/formatNombre';
import { comparerMesures, indicateursComparaison, selectionnerLotsRecents, type IndicateursComparaison } from './comparaisonLots';
import StatutCharge from './StatutCharge';

export type LotComparaison = {
  id: string; nom: string; batiment: string; date: string; dateFin?: string | null; estime: boolean; incomplet: boolean;
  resultat: number | null; aliment: number | null; livres: number; poids: number;
  morts: number; initial: number; consommation: number | null;
};
const criteres: { key: keyof IndicateursComparaison; titre: string; croissant: boolean }[] = [
  { key: 'margeSujet', titre: 'Marge par sujet livré (€)', croissant: false },
  { key: 'mortalite', titre: 'Mortalité (%)', croissant: true },
  { key: 'alimentKg', titre: 'Coût aliment / kg livré (€ TTC)', croissant: true },
  { key: 'consommation', titre: 'Aliment consommé (kg)', croissant: false },
  { key: 'ratioAliment', titre: 'Aliment / poids livré (kg/kg)', croissant: true },
];
export default function ComparaisonLots({ lots }: { lots: LotComparaison[] }) {
  const [portee, setPortee] = useState('5');
  const [details, setDetails] = useState(false);
  const [critere, setCritere] = useState<keyof IndicateursComparaison>('margeSujet');
  const regle = criteres.find(item => item.key === critere)!;
  const criteresVisibles = details ? criteres : criteres.slice(0, 3);
  const selection = selectionnerLotsRecents(lots, portee === 'tous' ? null : Number(portee));
  const lignes = selection.map(lot => ({ ...lot, mesures: indicateursComparaison(lot) }))
    .sort((a, b) => comparerMesures(a.mesures[critere], b.mesures[critere], regle.croissant) || a.nom.localeCompare(b.nom));
  const afficher = (key: keyof IndicateursComparaison, valeur: number | null) => valeur === null ? '—'
    : ['margeSujet', 'alimentKg'].includes(key) ? formatMontant(valeur) : formatNombre(valeur, key === 'consommation' ? 1 : 2);
  return <section className="analysis-panel comparison-lots">
    <div className="comparison-heading"><h2>Comparer les performances des lots</h2>
      <div className="comparison-controls"><label>Lots à comparer<select aria-label="Lots à comparer" value={portee} onChange={event => setPortee(event.target.value)}><option value="5">5 derniers lots</option><option value="10">10 derniers lots</option><option value="tous">Tous les lots filtrés</option></select></label>
      <label>Trier par<select value={critere} onChange={event => setCritere(event.target.value as keyof IndicateursComparaison)}>
        {criteresVisibles.map(item => <option key={item.key} value={item.key}>{item.titre}</option>)}
      </select></label></div>
    </div>
    <p className="comparison-scope"><strong>{lignes.length} lot(s) comparé(s) sur {lots.length} après les filtres.</strong> Les bilans Production et Économie ci-dessous portent sur tous les lots filtrés.</p>
    <label className="comparison-extra"><input type="checkbox" checked={details} onChange={event => { setDetails(event.target.checked); if (!event.target.checked && ['consommation', 'ratioAliment'].includes(critere)) setCritere('margeSujet'); }} />Afficher les indicateurs alimentaires détaillés</label>
    <details className="comparison-help"><summary>Comment lire les indicateurs ?</summary>
      <p>Les derniers lots sont sélectionnés selon leur dernière livraison connue, ou leur arrivée si aucune livraison n’est enregistrée. Lots clôturés · filtres de période selon la date d’arrivée · montants TTC calculés comme dans l’analyse complète, avec les tarifs figés lorsqu’ils existent. « — » indique une mesure non calculable. Une catégorie de charge manquante empêche le calcul de la marge ; les estimations sont signalées.</p>
      <p>Le ratio aliment/poids livré utilise les consommations saisies et le poids total livré ; il ne mesure pas le gain de poids vif. Le tri place les mesures non calculables en fin de liste et ne change pas les lots sélectionnés.</p>
    </details>
    {lignes.length < 2 && <p>Sélectionnez au moins deux lots pour comparer leurs performances.</p>}
    <div className="comparison-mobile-cards">{lignes.map(lot => <article key={lot.id}>
      <Link to={`/volailles/sica/historique/${lot.id}/analyse`}>Lot {lot.nom}</Link><small>{lot.batiment} · Arrivée le {new Date(`${lot.date}T00:00:00`).toLocaleDateString('fr-FR')}</small>
      {lot.dateFin && <small>Dernière livraison : {new Date(`${lot.dateFin}T00:00:00`).toLocaleDateString('fr-FR')}</small>}
      {lot.incomplet && <span className="charge-status charge-status-estime">Charges incomplètes</span>}{lot.estime && <StatutCharge statut="estime" />}
      <dl>{criteresVisibles.map(item => <div key={item.key}><dt>{item.titre}</dt><dd>{afficher(item.key, lot.mesures[item.key])}{item.key === 'mortalite' && lot.mesures.mortalite !== null ? ' %' : ''}</dd></div>)}</dl>
    </article>)}</div>
    <div className={`comparison-table-wrap ${details ? 'comparison-expanded' : 'comparison-essential'}`}><table className="analysis-table">
      <thead><tr><th>Lot / bâtiment</th>{criteresVisibles.map(item => <th key={item.key} aria-sort={item.key === critere ? (regle.croissant ? 'ascending' : 'descending') : undefined}>{item.titre}</th>)}</tr></thead>
      <tbody>{!lignes.length && <tr><td colSpan={criteresVisibles.length + 1}>Aucun lot à comparer pour ces filtres.</td></tr>}{lignes.map(lot => <tr key={lot.id}>
        <td><Link to={`/volailles/sica/historique/${lot.id}/analyse`}>Lot {lot.nom}</Link><small>{lot.batiment} · Arrivée le {new Date(`${lot.date}T00:00:00`).toLocaleDateString('fr-FR')}</small>{lot.dateFin && <small>Dernière livraison : {new Date(`${lot.dateFin}T00:00:00`).toLocaleDateString('fr-FR')}</small>}
          {lot.incomplet && <span className="charge-status charge-status-estime">Charges incomplètes</span>}{lot.estime && <StatutCharge statut="estime" />}</td>
        {criteresVisibles.map(item => <td key={item.key}>{afficher(item.key, lot.mesures[item.key])}{item.key === 'mortalite' && lot.mesures.mortalite !== null ? ' %' : ''}</td>)}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
