import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';
import { chargerLotsAvecMouvements } from './volaillesData';
import ModifierSaisieQuotidienne, { type EditionQuotidienne } from './ModifierSaisieQuotidienne';
import { cleAliment, preparerSaisie, repartirLotsQuotidiens, suggererAliment, projeterStockQuotidien } from './saisieQuotidienne';
import type { LotQuotidien, SaisieQuotidienne, ReferenceQuotidienne } from './saisieQuotidienne';

const aujourdHui = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date());
type Stock = { feed_type: string; stock_kg: number };
type Consommation = { id: string; lot_id: string | null; direct_sale_lot_id: string | null; date: string; feed_type: string; quantite_kg: number };
type Mortalite = { id: string; lot_id: string; date: string; nombre?: number; quantity?: number };
type Donnees = { references: ReferenceQuotidienne[] | null; lots: LotQuotidien[]; stocks: Stock[]; consommations: Consommation[]; mortalites: Mortalite[]; directMortalites: Mortalite[] };
async function charger(): Promise<Donnees> {
  const [sica, directe, stock, consommations, mortalites, directMortalites, references] = await Promise.all([
    chargerLotsAvecMouvements(true),
    chargerPages((a, b) => supabase.from('direct_sale_lots').select('id,name,arrival_date,remaining_quantity').neq('status', 'termine').order('id').range(a, b)),
    supabase.rpc('calculer_stock_aliment'),
    chargerPages((a, b) => supabase.from('consommations_aliment').select('lot_id,direct_sale_lot_id,date,feed_type,quantite_kg,id').order('id').range(a, b)),
    chargerPages((a, b) => supabase.from('mortalites_volailles').select('lot_id,date,nombre,id').order('id').range(a, b)),
    chargerPages((a, b) => supabase.from('direct_sale_mortalities').select('lot_id,date,quantity,id').order('id').range(a, b)),
    chargerPages((a, b) => supabase.from('feed_reference').select('id,feed_type,age_min_days,age_max_days').order('id').range(a, b)).catch(() => null),
  ]);
  if (stock.error) throw stock.error;
  return { lots: [
    ...sica.map(lot => ({ id: lot.id, nom: String(lot.nom), arrivee: String(lot.date_arrivee), restants: lot.sujets_restants, source: 'sica' as const })),
    ...directe.map(lot => ({ id: lot.id, nom: lot.name, arrivee: lot.arrival_date, restants: Number(lot.remaining_quantity), source: 'vente_directe' as const })),
  ].filter(lot => lot.restants >= 0).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })), stocks: stock.data || [], consommations, mortalites, directMortalites, references: references?.map(r => ({ feed_type: r.feed_type, age_min_days: Number(r.age_min_days), age_max_days: Number(r.age_max_days) })) ?? null };
}
export default function SaisieQuotidienne() {
  const [date, setDate] = useState(aujourdHui);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [lignes, setLignes] = useState<Record<string, SaisieQuotidienne>>({});
  const [chargement, setChargement] = useState(true);
  const [edition, setEdition] = useState<EditionQuotidienne | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [succes, setSucces] = useState('');
  const verrou = useRef(false);
  const tentative = useRef<{ id: string; date: string; lignes: ReturnType<typeof preparerSaisie> } | null>(null);
  const chargerInitial = useCallback(async () => {
    setChargement(true); setMessage('');
    try { setDonnees(await charger()); } catch { setMessage('Impossible de charger les lots et les stocks. Réessayez.'); }
    finally { setChargement(false); }
  }, []);
  useEffect(() => { void chargerInitial(); }, [chargerInitial]);
  const suggestionPourLot = (lot: LotQuotidien) => suggererAliment(lot.arrivee, date, donnees?.references || []);
  const alimentPourLot = (lot: LotQuotidien) => {
    const saisi = lignes[`${lot.source}:${lot.id}`]?.aliment;
    if (saisi !== undefined) return saisi;
    const suggestion = suggestionPourLot(lot);
    return suggestion ? donnees?.stocks.find(s => cleAliment(s.feed_type) === cleAliment(suggestion.aliment))?.feed_type || suggestion.aliment : '';
  };
  const modifier = (lot: LotQuotidien, champ: 'aliment' | 'sacs' | 'morts' | 'secondAliment' | 'secondSacs', valeur: string) => {
    const cle = `${lot.source}:${lot.id}`;
    setLignes(ancien => ({ ...ancien, [cle]: { ...(ancien[cle] || { lot_id: lot.id, source: lot.source, aliment: alimentPourLot(lot), sacs: '', morts: '' }), [champ]: valeur } }));
    setMessage(''); setSucces('');
  };
  const enregistrer = async () => {
    if (verrou.current || !donnees) return;
    verrou.current = true; setSaving(true); setMessage(''); setSucces('');
    try {
      // Relecture des stocks et effectifs ; le serveur les verifie encore dans la transaction.
      if (!tentative.current) {
        const actualisees = await charger();
        setDonnees(actualisees);
        const payload = preparerSaisie(date, aujourdHui(), Object.values(lignes), actualisees.lots, actualisees.stocks);
        const doublon = payload.some(ligne => (ligne.quantite_kg > 0 && actualisees.consommations.some(c => c.date === date && (ligne.source === 'sica' ? c.lot_id === ligne.lot_id : c.direct_sale_lot_id === ligne.lot_id))) ||
          (ligne.morts > 0 && (ligne.source === 'sica' ? actualisees.mortalites : actualisees.directMortalites).some(m => m.date === date && m.lot_id === ligne.lot_id)));
        if (doublon) throw new Error('Une donnée existe déjà pour ce jour. Consultez les valeurs affichées et utilisez le formulaire individuel pour les corriger.');
        tentative.current = { id: crypto.randomUUID(), date, lignes: payload };
      }
      // Rejouer exactement la requete envoyee si sa reponse s'est perdue.
      const envoi = tentative.current;
      const { error } = await supabase.rpc(envoi.lignes.some(l => (l.second_quantite_kg || 0) > 0) ? 'enregistrer_saisie_quotidienne_v2' : 'enregistrer_saisie_quotidienne', { p_id: envoi.id, p_date: envoi.date, p_lignes: envoi.lignes });
      if (error) {
        if (error.code) tentative.current = null;
        if (error.code === 'PGRST202' || error.code === '42883') throw new Error('La saisie groupée à deux aliments doit être activée : réexécutez supabase/saisie-quotidienne.sql dans Supabase SQL Editor.');
        throw new Error(error.message || 'Enregistrement impossible. Réessayez avec les mêmes valeurs.');
      }
      setLignes({}); tentative.current = null;
      const confirmation = `${envoi.lignes.length} lot(s) enregistré(s). Les consommations et mortalités sont à jour.`;
      setSucces(confirmation);
      toast.success(confirmation, { id: `saisie-quotidienne-${envoi.id}`, duration: 5000 });
      try { setDonnees(await charger()); } catch { setMessage('Enregistrement réussi. Actualisez la page pour voir les nouveaux totaux.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connexion interrompue. Réessayez avec les mêmes valeurs.'); }
    finally { verrou.current = false; setSaving(false); }
  };
  const { aRenseigner, renseignes } = donnees ? repartirLotsQuotidiens(donnees.lots, date, donnees.consommations, donnees.mortalites, donnees.directMortalites) : { aRenseigner: [], renseignes: [] };
  const lots = [...aRenseigner, ...renseignes];
  const totalSacs = Object.values(lignes).reduce((n, l) => n + (Number(l.sacs) || 0) + (Number(l.secondSacs) || 0), 0);
  const totalMorts = Object.values(lignes).reduce((n, l) => n + (Number(l.morts) || 0), 0);
  const projection = projeterStockQuotidien(donnees?.stocks || [], Object.values(lignes));
  const demandes = projection.aliments.filter(a => a.demande > 0);
  const manqueStock = demandes.some(a => a.restant < 0);
  const afficherLot = (lot: LotQuotidien) => {
    if (!donnees) return null;
    const cle = `${lot.source}:${lot.id}`;
    const ligne = lignes[cle];
    const consos = donnees.consommations.filter(c => c.date === date && (lot.source === 'sica' ? c.lot_id === lot.id : c.direct_sale_lot_id === lot.id));
    const morts = (lot.source === 'sica' ? donnees.mortalites : donnees.directMortalites).filter(m => m.date === date && m.lot_id === lot.id);
    const suggestion = suggestionPourLot(lot);
    const alimentChoisi = alimentPourLot(lot);
    const tousTypes = [...donnees.stocks.map(s => s.feed_type), ...(donnees.references || []).map(r => r.feed_type), alimentChoisi].filter(Boolean);
    const types = tousTypes.filter((type, i, tous) => tous.findIndex(t => cleAliment(t) === cleAliment(type)) === i);
    const bilan = projection.aliments.find(a => cleAliment(a.aliment) === cleAliment(alimentChoisi));
    return <article className="daily-card" key={cle}><h2>Lot {lot.nom}</h2><p>{lot.source === 'sica' ? 'SICA Madras' : 'Vente directe'} · {lot.restants.toLocaleString('fr-FR')} sujets restants</p>
      <fieldset disabled={saving || !!tentative.current}><legend className="sr-only">Saisie du lot {lot.nom}</legend>
        {consos.length > 0 ? <p className="daily-existing">✓ Aliment déjà saisi : {consos.map(c => `${c.feed_type} (${Number(c.quantite_kg) / 25} sacs)`).join(', ')}. <button type="button" className="daily-edit-button" aria-label={`Modifier l’alimentation du lot ${lot.nom}`} onClick={() => setEdition({ lot, type: 'aliment', mouvements: consos.map(c => ({ id: c.id, date: c.date, quantite: Number(c.quantite_kg), aliment: c.feed_type })) })}>✎ Modifier</button></p> : <div className="daily-feed"><label>Aliment<select disabled={lot.restants <= 0} value={alimentChoisi} onChange={e => modifier(lot, 'aliment', e.target.value)}><option value="">Choisir…</option>{types.map(type => <option key={type}>{type}</option>)}</select></label><label>Sacs de 25 kg<input inputMode="numeric" type="number" disabled={lot.restants <= 0} min="0" step="1" placeholder="—" value={ligne?.sacs || ''} onChange={e => modifier(lot, 'sacs', e.target.value)} /></label></div>}
        {!consos.length && lot.restants > 0 && <div className="daily-second-feed">
          {ligne?.secondAliment !== undefined ? <>
            <div className="daily-feed"><label>Deuxième aliment<select aria-label={`Deuxième aliment du lot ${lot.nom}`} value={ligne.secondAliment} onChange={e => modifier(lot, 'secondAliment', e.target.value)}><option value="">Choisir…</option>{types.map(type => <option key={type} disabled={cleAliment(type) === cleAliment(alimentChoisi)}>{type}</option>)}</select></label>
            <label>Sacs du deuxième aliment<input aria-label={`Sacs du deuxième aliment du lot ${lot.nom}`} type="number" inputMode="numeric" min="1" step="1" value={ligne.secondSacs || ''} onChange={e => modifier(lot, 'secondSacs', e.target.value)} /></label></div>
            {ligne.secondAliment && <p>Après toutes les saisies : <strong>{((projection.aliments.find(a => cleAliment(a.aliment) === cleAliment(ligne.secondAliment || ''))?.restant ?? 0) / 25).toLocaleString('fr-FR')} sac(s) de {ligne.secondAliment}</strong>.</p>}
            <button type="button" onClick={() => setLignes(avant => ({ ...avant, [cle]: { ...avant[cle], secondAliment: undefined, secondSacs: undefined } }))}>Retirer le deuxième aliment</button>
          </> : <button type="button" onClick={() => modifier(lot, 'secondAliment', '')}>＋ Ajouter un deuxième aliment</button>}
        </div>}
        {!consos.length && lot.restants > 0 && <div className="daily-feed-guidance">
          <p>{suggestion ? `Aliment proposé à ${suggestion.age} jours : ${suggestion.aliment}. Vous pouvez le changer.` : 'Aucune référence unique pour cet âge : choisissez l’aliment distribué.'}</p>
          {alimentChoisi && <p className={bilan && bilan.restant < 0 ? 'daily-stock-shortage' : ''}>Après les saisies de tous les lots : <strong>{((bilan?.restant ?? 0) / 25).toLocaleString('fr-FR')} sac(s) de {alimentChoisi}</strong>.</p>}
        </div>}
        {morts.length > 0 ? <p className="daily-existing">✓ Mortalité déjà saisie : {morts.reduce((n, m) => n + Number(m.nombre ?? m.quantity), 0)}. <button type="button" className="daily-edit-button" aria-label={`Modifier la mortalité du lot ${lot.nom}`} onClick={() => setEdition({ lot, type: 'mortalite', mouvements: morts.map(m => ({ id: m.id, date: m.date, quantite: Number(m.nombre ?? m.quantity) })) })}>✎ Modifier</button></p> : <label>Mortalités du jour<input inputMode="numeric" type="number" disabled={lot.restants <= 0} min="0" step="1" max={lot.restants} placeholder="—" value={ligne?.morts || ''} onChange={e => modifier(lot, 'morts', e.target.value)} /></label>}
      </fieldset></article>;
  };

  return <div className="daily-page">
    <header className="daily-header"><div><h1>Saisie quotidienne</h1><p>Alimentation et mortalités de vos lots en une seule fois.</p></div><Link to="/volailles/alimentation">Voir l’alimentation →</Link></header>
    <div className="daily-toolbar"><label>Date de saisie<input type="date" value={date} max={aujourdHui()} disabled={saving || !!tentative.current || !!edition} onChange={e => { setDate(e.target.value); setLignes({}); setSucces(''); setMessage(''); }} /></label><span>Les champs vides sont ignorés. Sacs entiers de 25 kg.</span></div>
    {message && <div role="alert" className="daily-alert">{message}{!donnees && <button onClick={() => void chargerInitial()}>Réessayer</button>}</div>}
    {succes && <p role="status" className="daily-success">✓ {succes}</p>}
    {chargement ? <p role="status">Chargement des lots et des stocks…</p> : donnees && <>
      {donnees.references === null && <p className="daily-alert" role="status">Références alimentaires indisponibles. Vous pouvez choisir l’aliment et enregistrer les quantités normalement.</p>}
      <details className="daily-stock"><summary>Stock disponible par aliment</summary>{donnees.stocks.map(s => <p key={s.feed_type}>{s.feed_type} : <strong>{(Number(s.stock_kg) / 25).toLocaleString('fr-FR')} sacs</strong></p>)}</details>
      {lots.length > 0 && <section className="daily-progress" aria-label="Progression de la saisie quotidienne">
        <div><strong>{renseignes.length} lot(s) sur {lots.length} renseigné(s)</strong><span>{aRenseigner.length} à renseigner</span></div>
        <progress max={lots.length} value={renseignes.length} aria-label="Lots renseignés" />
        <p>La progression compte les lots avec une alimentation enregistrée et ceux sans sujet restant. Les mortalités se renseignent uniquement si nécessaire. Les brouillons ne sont pas comptés.</p>
      </section>}
      {aRenseigner.length > 0 && <section aria-labelledby="daily-pending-title"><h2 id="daily-pending-title" className="daily-group-title">Alimentation à renseigner <span>{aRenseigner.length}</span></h2><div className="daily-grid">{aRenseigner.map(afficherLot)}</div></section>}
      {lots.length > 0 && !aRenseigner.length && <p className="daily-success">✓ Tous les lots disponibles sont traités pour l’alimentation. Vous pouvez encore ajouter ou modifier une mortalité dans les lots ci-dessous.</p>}
      {renseignes.length > 0 && <details key={date} className="daily-completed"><summary>Lots déjà renseignés <span>{renseignes.length}</span></summary><p>Consultez ou corrigez les données enregistrées, ou ajoutez une mortalité si nécessaire. Les lots sans sujet restant sont également regroupés ici.</p><div className="daily-grid">{renseignes.map(afficherLot)}</div></details>}
      {!lots.length && <p>Aucun lot actif disponible à cette date.</p>}
      {demandes.length > 0 && <section className="daily-stock-preview" aria-label="Stock après les saisies">
        <h2>Stock après enregistrement</h2><p>Stock disponible actuellement moins les quantités en cours de saisie, tous lots confondus. Les consommations déjà enregistrées sont déjà déduites du stock.</p>
        {manqueStock && <p className="daily-alert" role="alert">Stock insuffisant pour les quantités saisies. Réduisez les quantités ou vérifiez les entrées de stock avant d’enregistrer.</p>}
        {demandes.map(a => <div key={cleAliment(a.aliment)} className={a.restant < 0 ? 'daily-stock-shortage' : ''}><strong>{a.aliment}</strong><span>{(a.disponible / 25).toLocaleString('fr-FR')} sacs disponibles − {(a.demande / 25).toLocaleString('fr-FR')} à enregistrer</span><b>Restant : {(a.restant / 25).toLocaleString('fr-FR')} sac(s)</b></div>)}
      </section>}
      {projection.incomplet && <p className="daily-alert" role="status">La prévision exclut les quantités invalides ou sans aliment. Complétez ces champs pour connaître le stock restant.</p>}
      <div className="daily-save"><span><strong>{totalSacs} sacs</strong> · {totalMorts} mortalité(s)</span><button type="button" onClick={() => void enregistrer()} disabled={saving || !lots.length || (totalSacs <= 0 && totalMorts <= 0)}>{saving ? 'Enregistrement…' : tentative.current ? '↻ Réessayer l’enregistrement' : '✓ Enregistrer la journée'}</button></div>
    </>}
    {edition && donnees && <ModifierSaisieQuotidienne edition={edition} aliments={donnees.stocks.map(s => s.feed_type)} onClose={() => setEdition(null)} onSaved={async () => {
      setEdition(null); setMessage(''); setSucces('Modification enregistrée.'); toast.success('Modification enregistrée.', { id: 'correction-quotidienne', duration: 5000 });
      try { setDonnees(await charger()); } catch { setMessage('Modification enregistrée. Actualisez la page pour afficher les données à jour.'); }
    }}/>}
  </div>;
}
