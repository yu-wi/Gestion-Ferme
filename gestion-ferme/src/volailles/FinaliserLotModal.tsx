import { useEffect, useRef, useState } from 'react';
import ModalCloseButton from '../components/ModalCloseButton';
import type { LotFiche } from './ficheCloture';
import type { SaisieFinalisation, VerificationFinalisation } from './finalisationLot';
export default function FinaliserLotModal({ lot, tache, saving, erreur, onClose, onSave, onAction }: { lot: LotFiche; tache: VerificationFinalisation; saving: boolean; erreur: string; onClose: () => void; onSave: (saisie: SaisieFinalisation) => void; onAction: (tache: VerificationFinalisation) => void }) {
  const [saisie,setSaisie] = useState<SaisieFinalisation>({ valeur: tache.action === 'effectifs' ? String(lot.autoconsommation || 0) : '', date: '', quantite: '', poids: '' });
  const panneau = useRef<HTMLDivElement>(null);
  useEffect(() => { const precedent=document.activeElement as HTMLElement|null; panneau.current?.querySelector<HTMLElement>('input')?.focus(); return () => precedent?.focus(); },[]);
  useEffect(() => { if(erreur && !saving) panneau.current?.focus(); },[erreur,saving]);
  const titres = { charge: `Renseigner la charge : ${tache.libelle}`, recettes:'Renseigner les recettes', retenue:'Renseigner la quantité retenue', livraison:'Enregistrer une livraison', effectifs:'Vérifier les effectifs', mortalite:'Enregistrer une mortalité', validation:'Valider une charge', tarifs:'Figer les tarifs' };
  const champ=(cle:keyof SaisieFinalisation,valeur:string)=>setSaisie(ancien=>({...ancien,[cle]:valeur}));
  return <div className="poultry-modal-backdrop"><div ref={panneau} tabIndex={-1} className="poultry-modal poultry-modal-medium" role="dialog" aria-modal="true" aria-labelledby="finaliser-lot-title" onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();if(!saving)onClose();}
    if(event.key==='Tab') { const elements=[...panneau.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];
      if(document.activeElement===panneau.current){event.preventDefault();(event.shiftKey?elements.at(-1):elements[0])?.focus();}
      else if(event.shiftKey&&document.activeElement===elements[0]){event.preventDefault();elements.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===elements.at(-1)){event.preventDefault();elements[0]?.focus();}
    }
  }}>
    <ModalCloseButton onClick={onClose} disabled={saving}/><div className="poultry-modal-header"><span className="poultry-modal-icon">✓</span><div><h2 id="finaliser-lot-title">{titres[tache.action]}</h2><p>Lot {lot.nom} · {lot.batiment}</p></div></div>
    {erreur&&<p className="daily-alert" role="alert">{erreur}</p>}
    <fieldset disabled={saving} className="poultry-form-stack finalisation-fields">
      {tache.action==='effectifs'&&<><p>{lot.quantite} sujets arrivés − {lot.nb_morts} mortalités − {lot.livraisons.reduce((n,l)=>n+l.quantite,0)} livrés − {lot.autoconsommation||0} autoconsommés = <strong>{lot.sujets_restants} restants</strong>.</p><p>Renseignez uniquement les mouvements réels. Le lot reste archivé.</p>{lot.sujets_restants < 0 && <p className="daily-alert">Le solde est négatif : vérifiez les quantités initiales, les livraisons et les mortalités enregistrées avant de finaliser.</p>}<div className="finalisation-effectifs-actions"><button type="button" onClick={()=>onAction({id:'livraisons',libelle:'Livraison',raison:'',fait:false,action:'livraison'})}>＋ Livraison manquante</button><button type="button" onClick={()=>onAction({id:'mortalite',libelle:'Mortalité',raison:'',fait:false,action:'mortalite'})}>＋ Mortalité manquante</button></div></>}
      {['charge','recettes','retenue','effectifs'].includes(tache.action)&&<label>{tache.action==='charge'?'Montant de la charge (€ TTC)':tache.action==='recettes'?'Recettes de vente des volailles (€)':tache.action==='retenue'?'Quantité retenue (0 si aucune)':'Autoconsommation totale (sujets)'}<input type="number" inputMode="decimal" min="0" step={tache.action==='effectifs'?'1':'any'} value={saisie.valeur} onChange={e=>champ('valeur',e.target.value)}/></label>}
      {['livraison','mortalite'].includes(tache.action)&&<><label>Date réelle<input type="date" min={lot.date_arrivee} max={new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Martinique'}).format(new Date())} value={saisie.date} onChange={e=>champ('date',e.target.value)}/></label><label>{tache.action==='livraison'?'Sujets livrés':'Nombre de mortalités'}<input type="number" inputMode="numeric" min="1" step="1" value={saisie.quantite} onChange={e=>champ('quantite',e.target.value)}/></label>{tache.action==='livraison'&&<label>Poids total livré (kg)<input type="number" inputMode="decimal" min="0.01" step="any" value={saisie.poids} onChange={e=>champ('poids',e.target.value)}/></label>}</>}
    </fieldset>
    <div className="poultry-modal-actions"><button type="button" className="poultry-modal-secondary" disabled={saving} onClick={onClose}>Annuler</button><button type="button" className="poultry-modal-primary" disabled={saving} onClick={()=>onSave(saisie)}>{saving?'Enregistrement…':'✓ Enregistrer'}</button></div>
  </div></div>;
}
