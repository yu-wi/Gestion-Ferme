export default function StatutCharge({ statut }: { statut: 'estime' | 'enregistre' | 'calcule' }) {
  const libelles = { estime: 'Estimé · à valider', enregistre: 'Enregistré', calcule: 'Calculé sur consommations' };
  return <span className={`charge-status charge-status-${statut}`}>{libelles[statut]}</span>;
}
