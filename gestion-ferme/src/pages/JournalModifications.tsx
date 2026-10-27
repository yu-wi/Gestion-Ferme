import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../supabaseClient';
import { borneDateJournal, champsModifies, echapperRechercheJournal, tablesJournal, valeurJournal } from './journalUtils';

type Evenement = {
  id: string; occurred_at: string; actor_label: string; table_name: string;
  operation: string; lot_label: string | null;
};
type Detail = { old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null };
const vide = { table: '', operation: '', lot: '', auteur: '', debut: '', fin: '' };
const actions: Record<string, string> = { INSERT: 'Ajout', UPDATE: 'Modification', DELETE: 'Suppression' };
const taillePage = 50;

export default function JournalModifications({ autorise }: { autorise: boolean }) {
  const [filtres, setFiltres] = useState(vide);
  const [appliques, setAppliques] = useState(vide);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [lignes, setLignes] = useState<Evenement[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [activation, setActivation] = useState(false);
  const [details, setDetails] = useState<Map<string, Detail>>(new Map());
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [chargementDetail, setChargementDetail] = useState<string | null>(null);
  const [erreurDetail, setErreurDetail] = useState('');
  useEffect(() => {
    if (!autorise) return;
    let active = true;
    const charger = async () => {
      setLoading(true); setErreur(''); setActivation(false); setOuvert(null);
      try {
        let requete = supabase.from('audit_events')
          .select('id, occurred_at, actor_label, table_name, operation, lot_label', { count: 'exact' })
          .order('occurred_at', { ascending: false }).order('id', { ascending: false });
        if (appliques.table) requete = requete.eq('table_name', appliques.table);
        if (appliques.operation) requete = requete.eq('operation', appliques.operation);
        if (appliques.lot.trim()) requete = requete.ilike('lot_label', `%${echapperRechercheJournal(appliques.lot.trim())}%`);
        if (appliques.auteur.trim()) requete = requete.ilike('actor_label', `%${echapperRechercheJournal(appliques.auteur.trim())}%`);
        if (appliques.debut) requete = requete.gte('occurred_at', borneDateJournal(appliques.debut));
        if (appliques.fin) requete = requete.lt('occurred_at', borneDateJournal(appliques.fin, true));
        const { data, error, count } = await requete.range(page * taillePage, (page + 1) * taillePage - 1);
        if (!active) return;
        if (error) {
          setActivation(['42P01', 'PGRST205'].includes(error.code));
          throw error;
        }
        setLignes((data || []) as Evenement[]); setTotal(count);
      } catch {
        if (active) { setLignes([]); setTotal(null); setErreur('Le journal n’a pas pu être chargé. Vérifiez son activation et vos droits administrateur.'); }
      } finally { if (active) setLoading(false); }
    };
    charger(); return () => { active = false; };
  }, [autorise, appliques, page, reload]);
  const consulter = async (id: string) => {
    setErreurDetail('');
    if (ouvert === id) { setOuvert(null); return; }
    setOuvert(id);
    if (details.has(id)) return;
    setChargementDetail(id);
    try {
      const { data, error } = await supabase.from('audit_events').select('old_values, new_values').eq('id', id).single();
      if (error) throw error;
      setDetails(current => new Map(current).set(id, data as Detail));
    } catch { setErreurDetail('Le détail n’a pas pu être chargé. Fermez puis rouvrez cet événement pour réessayer.'); }
    finally { setChargementDetail(null); }
  };
  const appliquer = (event: FormEvent) => {
    event.preventDefault();
    if (filtres.debut && filtres.fin && filtres.debut > filtres.fin) return;
    setPage(0); setAppliques({ ...filtres });
  };
  const datesInvalides = !!filtres.debut && !!filtres.fin && filtres.debut > filtres.fin;
  if (!autorise) return <section className="history-panel"><h1>Journal des modifications</h1><p>Cette page est réservée aux administrateurs disposant d’un profil actif.</p></section>;
  return <div className="settings-page audit-page">
    <header className="settings-heading"><div><div><h1>Journal des modifications</h1><p>Qui a changé une donnée, quand, et quelles valeurs ont été modifiées.</p></div></div></header>
    <p>Le journal commence à son activation. Les opérations antérieures ne peuvent pas être reconstituées. Dates et heures de Martinique.</p>
    <form className="audit-filters" onSubmit={appliquer}>
      <label>Données<select value={filtres.table} onChange={e => setFiltres({ ...filtres, table: e.target.value })}><option value="">Toutes les données suivies</option>{Object.entries(tablesJournal).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Opération<select value={filtres.operation} onChange={e => setFiltres({ ...filtres, operation: e.target.value })}><option value="">Toutes les opérations</option>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Lot<input value={filtres.lot} onChange={e => setFiltres({ ...filtres, lot: e.target.value })} placeholder="Nom ou numéro du lot" /></label>
      <label>Auteur<input value={filtres.auteur} onChange={e => setFiltres({ ...filtres, auteur: e.target.value })} /></label>
      <label>Du<input type="date" value={filtres.debut} onChange={e => setFiltres({ ...filtres, debut: e.target.value })} /></label>
      <label>Au<input type="date" value={filtres.fin} onChange={e => setFiltres({ ...filtres, fin: e.target.value })} /></label>
      <button type="submit" disabled={datesInvalides || loading}>Filtrer</button>
      <button type="button" onClick={() => { setFiltres(vide); setAppliques({ ...vide }); setPage(0); }}>Réinitialiser</button>
      <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>Actualiser</button>
    </form>
    {datesInvalides && <p role="alert">La date de début doit précéder la date de fin.</p>}
    {loading ? <p role="status">Chargement du journal…</p> : erreur ? <section className="history-panel" role="alert">
      <p>{erreur}</p>{activation && <p>Activez le journal dans le SQL Editor Supabase avec le script <code>supabase/journal-modifications.sql</code>. Aucun événement n’est enregistré avant cette activation.</p>}
      <button type="button" onClick={() => setReload(value => value + 1)}>Réessayer</button>
    </section> : <>
      <p>{total === null ? `${lignes.length} événement(s) sur cette page` : `${total} événement(s)`}</p>
      {!lignes.length && <p>Aucun événement ne correspond aux filtres.</p>}
      <div className="audit-events">{lignes.map(ligne => {
        const detail = details.get(ligne.id);
        const changements = detail ? champsModifies(detail.old_values, detail.new_values) : [];
        return <article key={ligne.id} className="history-panel">
          <div className="audit-event-heading"><div><strong>{actions[ligne.operation] || ligne.operation} · {tablesJournal[ligne.table_name] || ligne.table_name}</strong>
            <p>{ligne.lot_label ? `Lot ${ligne.lot_label} · ` : ''}{ligne.actor_label} · {new Date(ligne.occurred_at).toLocaleString('fr-FR', { timeZone: 'America/Martinique' })}</p></div>
            <button type="button" aria-expanded={ouvert === ligne.id} onClick={() => consulter(ligne.id)}>{ouvert === ligne.id ? 'Masquer' : 'Avant / après'}</button></div>
          {ouvert === ligne.id && <div>
            {chargementDetail === ligne.id ? <p>Chargement du détail…</p> : erreurDetail ? <p role="alert">{erreurDetail}</p> : detail && <div className="comparison-table-wrap"><table className="analysis-table audit-values"><thead><tr><th>Information</th><th>Avant</th><th>Après</th></tr></thead><tbody>
              {changements.map(champ => <tr key={champ.key}><th scope="row">{champ.label}</th><td><pre>{valeurJournal(champ.avant)}</pre></td><td><pre>{valeurJournal(champ.apres)}</pre></td></tr>)}
              {!changements.length && <tr><td colSpan={3}>Aucune valeur métier différente.</td></tr>}
            </tbody></table></div>}
          </div>}
        </article>;
      })}</div>
      <nav className="audit-pagination" aria-label="Pages du journal"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Précédente</button><span>Page {page + 1}</span>
        <button type="button" disabled={total !== null ? (page + 1) * taillePage >= total : lignes.length < taillePage} onClick={() => setPage(value => value + 1)}>Suivante</button></nav>
    </>}
  </div>;
}
