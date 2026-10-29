import { useEffect, useRef, useState } from 'react';
import ModalCloseButton from '../components/ModalCloseButton';
import { corrigerMouvementQuotidien } from './correctionQuotidienneService';
import type { MouvementQuotidien } from './correctionQuotidienne';
import type { LotQuotidien } from './saisieQuotidienne';

export type EditionQuotidienne = { lot: LotQuotidien; type: 'aliment' | 'mortalite'; mouvements: MouvementQuotidien[] };
export default function ModifierSaisieQuotidienne({ edition, aliments, onClose, onSaved }: { edition: EditionQuotidienne; aliments: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [id, setId] = useState(edition.mouvements[0].id);
  const mouvement = edition.mouvements.find(m => m.id === id)!;
  const [date, setDate] = useState(mouvement.date);
  const [quantite, setQuantite] = useState(String(edition.type === 'aliment' ? mouvement.quantite / 25 : mouvement.quantite));
  const [aliment, setAliment] = useState(mouvement.aliment || '');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const verrou = useRef(false);
  const panneau = useRef<HTMLDivElement>(null);
  const fermer = useRef(onClose); fermer.current = onClose;
  const estAliment = edition.type === 'aliment';
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    panneau.current?.querySelector<HTMLElement>('input, select')?.focus();
    return () => precedent?.focus();
  }, []);
  const choisir = (valeur: string) => {
    const m = edition.mouvements.find(item => item.id === valeur)!;
    setId(valeur); setDate(m.date); setQuantite(String(estAliment ? m.quantite / 25 : m.quantite)); setAliment(m.aliment || ''); setErreur('');
  };
  const enregistrer = async () => {
    if (verrou.current) return;
    verrou.current = true; setSaving(true); setErreur('');
    try {
      if (await corrigerMouvementQuotidien(edition.lot, edition.type, mouvement, date, Number(quantite) * (estAliment ? 25 : 1), aliment)) await onSaved();
    } catch (error) { setErreur(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée. Réessayez.'); }
    finally { verrou.current = false; setSaving(false); panneau.current?.focus({ preventScroll: true }); }
  };
  const types = [...new Set([...aliments, ...edition.mouvements.flatMap(m => m.aliment ? [m.aliment] : [])])];
  return <div className="poultry-modal-backdrop"><div ref={panneau} tabIndex={-1} className="poultry-modal poultry-modal-medium" role="dialog" aria-modal="true" aria-labelledby="daily-edit-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!saving) fermer.current(); }
    if (event.key === 'Tab') {
      const elements = [...panneau.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
      if (document.activeElement === panneau.current) { event.preventDefault(); (event.shiftKey ? elements.at(-1) : elements[0])?.focus(); return; }
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
    }
  }}>
    <ModalCloseButton onClick={onClose} disabled={saving}/>
    <div className="poultry-modal-header"><span className="poultry-modal-icon">{estAliment ? '▣' : '✝'}</span><div><h2 id="daily-edit-title">{estAliment ? 'Modifier la consommation' : 'Modifier la mortalité'}</h2><p>Lot {edition.lot.nom} · {edition.lot.source === 'sica' ? 'SICA Madras' : 'Vente directe'}</p></div></div>
    {erreur && <p className="daily-alert" role="alert">{erreur}</p>}
    <fieldset className="poultry-form-stack daily-edit-fields" disabled={saving}>
      {edition.mouvements.length > 1 && <label>Saisie à modifier<select value={id} onChange={e => choisir(e.target.value)}>{edition.mouvements.map((m, i) => <option key={m.id} value={m.id}>{i + 1} · {m.aliment || 'Mortalité'} · {estAliment ? `${m.quantite / 25} sacs` : `${m.quantite} sujets`}</option>)}</select></label>}
      <label>Date<input type="date" min={edition.lot.arrivee} max={new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date())} value={date} onChange={e => setDate(e.target.value)}/></label>
      {estAliment && <label>Aliment<select value={aliment} onChange={e => setAliment(e.target.value)}>{types.map(type => <option key={type}>{type}</option>)}</select></label>}
      <label>{estAliment ? 'Nombre de sacs de 25 kg' : 'Nombre de mortalités'}<input type="number" inputMode={estAliment ? 'decimal' : 'numeric'} min={estAliment ? '0.01' : '1'} step={estAliment ? 'any' : '1'} value={quantite} onChange={e => setQuantite(e.target.value)}/></label>
    </fieldset>
    <div className="poultry-modal-actions"><button type="button" className="poultry-modal-secondary" disabled={saving} onClick={onClose}>Annuler</button><button type="button" className="poultry-modal-primary" disabled={saving} onClick={() => void enregistrer()}>{saving ? 'Enregistrement…' : '✓ Enregistrer la modification'}</button></div>
  </div></div>;
}
