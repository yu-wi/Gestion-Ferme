import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMontant, formatNombre } from '../outils/formatNombre';
import { comparerMesures, indicateursComparaison, type IndicateursComparaison } from './comparaisonLots';
import StatutCharge from './StatutCharge';

export type LotComparaison = {
  id: string; nom: string; batiment: string; date: string; estime: boolean; incomplet: boolean;
  resultat: number | null; aliment: number | null; livres: number; poids: number;
  morts: number; initial: number; consommation: number | null;
};
const criteres: { key: keyof IndicateursComparaison; titre: string; croissant: boolean }[] = [
  { key: 'margeSujet', titre: 'Marge par sujet livré (€)', croissant: false },
  { key: 'alimentKg', titre: 'Aliment par kg livré (€)', croissant: true },
  { key: 'mortalite', titre: 'Mortalité (%)', croissant: true },
  { key: 'consommation', titre: 'Aliment consommé (kg)', croissant: false },
  { key: 'ratioAliment', titre: 'Aliment / poids livré (kg/kg)', croissant: true },
];
export default function ComparaisonLots({ lots }: { lots: LotComparaison[] }) {
  const [critere, setCritere] = useState<keyof IndicateursComparaison>('margeSujet');
  const regle = criteres.find(item => item.key === critere)!;
  const lignes = lots.map(lot => ({ ...lot, mesures: indicateursComparaison(lot) }))
    .sort((a, b) => comparerMesures(a.mesures[critere], b.mesures[critere], regle.croissant) || a.nom.localeCompare(b.nom));
  const afficher = (key: keyof IndicateursComparaison, valeur: number | null) => valeur === null ? '—'
    : ['margeSujet', 'alimentKg'].includes(key) ? formatMontant(valeur) : formatNombre(valeur, key === 'consommation' ? 1 : 2);
  return <section className="analysis-panel comparison-lots">
    <div className="comparison-heading"><h2>Comparer les performances des lots</h2>
      <label>Trier par<select value={critere} onChange={event => setCritere(event.target.value as keyof IndicateursComparaison)}>
        {criteres.map(item => <option key={item.key} value={item.key}>{item.titre}</option>)}
      </select></label>
    </div>
    <p>Lots clôturés · période selon la date d’arrivée · montants TTC calculés comme dans l’analyse complète, avec les tarifs figés lorsqu’ils existent. « — » indique une mesure non calculable. Les marges ne sont pas affichées lorsqu’une catégorie de charge manque.</p>
    <p>Le ratio aliment/poids livré utilise les consommations saisies et le poids total livré ; il ne mesure pas le gain de poids vif. Le tri place les mesures non calculables en fin de liste.</p>
    {lignes.length < 2 && <p>Sélectionnez au moins deux lots pour comparer leurs performances.</p>}
    <div className="comparison-table-wrap"><table className="analysis-table">
      <thead><tr><th>Lot / bâtiment</th>{criteres.map(item => <th key={item.key} aria-sort={item.key === critere ? (regle.croissant ? 'ascending' : 'descending') : undefined}>{item.titre}</th>)}</tr></thead>
      <tbody>{lignes.map(lot => <tr key={lot.id}>
        <td><Link to={`/volailles/sica/historique/${lot.id}/analyse`}>Lot {lot.nom}</Link><small>{lot.batiment} · {new Date(`${lot.date}T00:00:00`).toLocaleDateString('fr-FR')}</small>
          {lot.incomplet && <span className="charge-status charge-status-estime">Charges incomplètes</span>}{lot.estime && <StatutCharge statut="estime" />}</td>
        {criteres.map(item => <td key={item.key}>{afficher(item.key, lot.mesures[item.key])}{item.key === 'mortalite' && lot.mesures.mortalite !== null ? ' %' : ''}</td>)}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
