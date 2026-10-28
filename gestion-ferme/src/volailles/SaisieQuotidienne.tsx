import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { chargerPages } from './chargerPages';
import { chargerLotsAvecMouvements } from './volaillesData';
import { cleAliment, preparerSaisie } from './saisieQuotidienne';
import type { LotQuotidien, SaisieQuotidienne } from './saisieQuotidienne';

const aujourdHui = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date());
type Stock = { feed_type: string; stock_kg: number };
type Consommation = { lot_id: string | null; direct_sale_lot_id: string | null; date: string; feed_type: string; quantite_kg: number };
type Mortalite = { lot_id: string; date: string; nombre?: number; quantity?: number };
type Donnees = { lots: LotQuotidien[]; stocks: Stock[]; consommations: Consommation[]; mortalites: Mortalite[]; directMortalites: Mortalite[] };
async function charger(): Promise<Donnees> {
  const [sica, directe, stock, consommations, mortalites, directMortalites] = await Promise.all([
    chargerLotsAvecMouvements(true),
    chargerPages((a, b) => supabase.from('direct_sale_lots').select('id,name,arrival_date,remaining_quantity').neq('status', 'termine').order('id').range(a, b)),
    supabase.rpc('calculer_stock_aliment'),
    chargerPages((a, b) => supabase.from('consommations_aliment').select('lot_id,direct_sale_lot_id,date,feed_type,quantite_kg,id').order('id').range(a, b)),
    chargerPages((a, b) => supabase.from('mortalites_volailles').select('lot_id,date,nombre,id').order('id').range(a, b)),
    chargerPages((a, b) => supabase.from('direct_sale_mortalities').select('lot_id,date,quantity,id').order('id').range(a, b)),
  ]);
  if (stock.error) throw stock.error;
  return { lots: [
    ...sica.map(lot => ({ id: lot.id, nom: String(lot.nom), arrivee: String(lot.date_arrivee), restants: lot.sujets_restants, source: 'sica' as const })),
    ...directe.map(lot => ({ id: lot.id, nom: lot.name, arrivee: lot.arrival_date, restants: Number(lot.remaining_quantity), source: 'vente_directe' as const })),
  ].filter(lot => lot.restants > 0).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })), stocks: stock.data || [], consommations, mortalites, directMortalites };
}
export default function SaisieQuotidienne() {
  const [date, setDate] = useState(aujourdHui);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [lignes, setLignes] = useState<Record<string, SaisieQuotidienne>>({});
  const [chargement, setChargement] = useState(true);
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
  const modifier = (lot: LotQuotidien, champ: 'aliment' | 'sacs' | 'morts', valeur: string) => {
    const cle = `${lot.source}:${lot.id}`;
    setLignes(ancien => ({ ...ancien, [cle]: { ...(ancien[cle] || { lot_id: lot.id, source: lot.source, aliment: '', sacs: '', morts: '' }), [champ]: valeur } }));
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
      const { error } = await supabase.rpc('enregistrer_saisie_quotidienne', { p_id: envoi.id, p_date: envoi.date, p_lignes: envoi.lignes });
      if (error) {
        if (error.code) tentative.current = null;
        if (error.code === 'PGRST202' || error.code === '42883') throw new Error('La saisie groupée doit être activée : exécutez supabase/saisie-quotidienne.sql dans Supabase SQL Editor.');
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
  const lots = donnees?.lots.filter(lot => lot.arrivee <= date) || [];
  const totalSacs = Object.values(lignes).reduce((n, l) => n + (Number(l.sacs) || 0), 0);
  const totalMorts = Object.values(lignes).reduce((n, l) => n + (Number(l.morts) || 0), 0);
  return <div className="daily-page">
    <header className="daily-header"><div><h1>Saisie quotidienne</h1><p>Alimentation et mortalités de vos lots en une seule fois.</p></div><Link to="/volailles/alimentation">Voir l’alimentation →</Link></header>
    <div className="daily-toolbar"><label>Date de saisie<input type="date" value={date} max={aujourdHui()} disabled={saving || !!tentative.current} onChange={e => { setDate(e.target.value); setLignes({}); setSucces(''); setMessage(''); }} /></label><span>Les champs vides sont ignorés. Sacs entiers de 25 kg.</span></div>
    {message && <div role="alert" className="daily-alert">{message}{!donnees && <button onClick={() => void chargerInitial()}>Réessayer</button>}</div>}
    {succes && <p role="status" className="daily-success">✓ {succes}</p>}
    {chargement ? <p role="status">Chargement des lots et des stocks…</p> : donnees && <>
      <details className="daily-stock"><summary>Stock disponible par aliment</summary>{donnees.stocks.map(s => <p key={s.feed_type}>{s.feed_type} : <strong>{(Number(s.stock_kg) / 25).toLocaleString('fr-FR')} sacs</strong></p>)}</details>
      <div className="daily-grid">{lots.map(lot => {
        const cle = `${lot.source}:${lot.id}`;
        const ligne = lignes[cle];
        const consos = donnees.consommations.filter(c => c.date === date && (lot.source === 'sica' ? c.lot_id === lot.id : c.direct_sale_lot_id === lot.id));
        const morts = (lot.source === 'sica' ? donnees.mortalites : donnees.directMortalites).filter(m => m.date === date && m.lot_id === lot.id);
        const types = donnees.stocks.filter((s, i, tous) => tous.findIndex(t => cleAliment(t.feed_type) === cleAliment(s.feed_type)) === i);
        return <article className="daily-card" key={cle}><h2>Lot {lot.nom}</h2><p>{lot.source === 'sica' ? 'SICA Madras' : 'Vente directe'} · {lot.restants.toLocaleString('fr-FR')} sujets restants</p>
          <fieldset disabled={saving || !!tentative.current}><legend className="sr-only">Saisie du lot {lot.nom}</legend>
            {consos.length > 0 ? <p className="daily-existing">✓ Aliment déjà saisi : {consos.map(c => `${c.feed_type} (${Number(c.quantite_kg) / 25} sacs)`).join(', ')}. <Link to="/volailles/alimentation">Consulter / modifier</Link></p> : <div className="daily-feed"><label>Aliment<select value={ligne?.aliment || ''} onChange={e => modifier(lot, 'aliment', e.target.value)}><option value="">Choisir…</option>{types.map(s => <option key={s.feed_type}>{s.feed_type}</option>)}</select></label><label>Sacs de 25 kg<input inputMode="numeric" type="number" min="0" step="1" placeholder="—" value={ligne?.sacs || ''} onChange={e => modifier(lot, 'sacs', e.target.value)} /></label></div>}
            {morts.length > 0 ? <p className="daily-existing">✓ Mortalité déjà saisie : {morts.reduce((n, m) => n + Number(m.nombre ?? m.quantity), 0)}. <Link to={lot.source === 'sica' ? '/volailles/sica' : '/volailles/vente-directe'}>Consulter / modifier</Link></p> : <label>Mortalités du jour<input inputMode="numeric" type="number" min="0" step="1" max={lot.restants} placeholder="—" value={ligne?.morts || ''} onChange={e => modifier(lot, 'morts', e.target.value)} /></label>}
          </fieldset></article>;
      })}</div>
      {!lots.length && <p>Aucun lot actif disponible à cette date.</p>}
      <div className="daily-save"><span><strong>{totalSacs} sacs</strong> · {totalMorts} mortalité(s)</span><button type="button" onClick={() => void enregistrer()} disabled={saving || !lots.length || (totalSacs <= 0 && totalMorts <= 0)}>{saving ? 'Enregistrement…' : tentative.current ? '↻ Réessayer l’enregistrement' : '✓ Enregistrer la journée'}</button></div>
    </>}
  </div>;
}
