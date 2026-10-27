import { formatMontant, formatNombre } from '../outils/formatNombre';
import type { FicheCloture } from './ficheCloture';
const date=(value:string)=>value ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') : '—';
export default function FicheClotureImpression({fiche}:{fiche:FicheCloture}) {
  return <article className="closure-print">
    <header><p>La Ferme de Bernard · SICA Madras</p><h1>Fiche de clôture – Lot {fiche.lot.nom}</h1>
      <p>Bâtiment {fiche.lot.batiment} · Arrivée le {date(fiche.lot.date_arrivee)} · Âge : {fiche.lot.age} jours</p>
      <p>Données établies le {new Date(fiche.date).toLocaleString('fr-FR',{timeZone:'America/Martinique'})} (Martinique)</p>
      <strong>Fiche {fiche.statut.toLowerCase()}</strong>
      {!!fiche.raisons.length && <ul>{fiche.raisons.map(raison=><li key={raison}>{raison}</li>)}</ul>}
    </header>
    <section><h2>Production</h2><dl>
      {[
        ['Sujets arrivés',formatNombre(fiche.lot.quantite)],['Sujets livrés',formatNombre(fiche.livres)],
        ['Mortalités',`${formatNombre(fiche.lot.nb_morts)} (${fiche.mortalite===null ? '—' : formatNombre(fiche.mortalite,2)+' %'})`],
        ['Autoconsommation',formatNombre(fiche.lot.autoconsommation)],['Quantité retenue',fiche.lot.quantite_retenue==null ? 'Non renseignée' : formatNombre(fiche.lot.quantite_retenue)],
        ['Sujets restants',formatNombre(fiche.lot.sujets_restants)],['Poids livré',formatNombre(fiche.poids,2)+' kg'],
        ['Poids moyen',fiche.poidsMoyen===null ? '—' : formatNombre(fiche.poidsMoyen,2)+' kg'],
        ['Aliment consommé saisi',fiche.consommationKg===null ? 'Non renseigné' : formatNombre(fiche.consommationKg,2)+' kg'],
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></section>
    <section><h2>Détail économique</h2><p>Recettes : <strong>{formatMontant(fiche.recettes)}</strong></p>
      <table><thead><tr><th>Charge</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        {fiche.charges.map(c=><tr key={c.type}><td>{c.label}</td><td>{formatMontant(c.montant)}</td><td>{c.statut}</td></tr>)}
      </tbody><tfoot><tr><th>Total charges</th><td>{formatMontant(fiche.totalCharges)}</td><td>{fiche.statut}</td></tr></tfoot></table>
      <p><strong>Marge nette : {formatMontant(fiche.marge)}</strong> · Taux de marge : {fiche.tauxMarge===null ? '—' : formatNombre(fiche.tauxMarge,2)+' %'}</p>
    </section>
    <section><h2>Livraisons ({fiche.lot.livraisons.length})</h2><table><thead><tr><th>Date</th><th>Sujets</th><th>Poids (kg)</th></tr></thead><tbody>
      {fiche.lot.livraisons.map((l,i)=><tr key={i}><td>{date(l.date)}</td><td>{formatNombre(l.quantite)}</td><td>{formatNombre(l.poids,2)}</td></tr>)}
      {!fiche.lot.livraisons.length && <tr><td colSpan={3}>Aucune livraison enregistrée.</td></tr>}
    </tbody></table></section>
    <section><h2>Mortalités</h2><table><thead><tr><th>Date</th><th>Nombre</th></tr></thead><tbody>
      {fiche.lot.mortalites.map((m,i)=><tr key={i}><td>{date(m.date)}</td><td>{formatNombre(m.nombre)}</td></tr>)}
      {!fiche.lot.mortalites.length && <tr><td colSpan={2}>Aucune mortalité enregistrée.</td></tr>}
    </tbody></table></section>
    <footer><p>{fiche.gel ? `Tarifs figés le ${new Date(fiche.gel.date).toLocaleDateString('fr-FR')}${fiche.gel.origine==='historique' ? ' à partir des prix disponibles lors du gel' : ' lors de l’archivage'}.` : 'Tarifs actuels non figés.'}</p>
      <p>Les montants saisis sont repris sans conversion. Les charges calculées incluent leur TVA. Cette fiche reprend les données disponibles à la date indiquée.</p></footer>
  </article>;
}
