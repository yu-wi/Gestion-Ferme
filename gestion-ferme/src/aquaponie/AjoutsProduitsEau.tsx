import {useCallback,useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import toast from 'react-hot-toast';
import {supabase} from '../supabaseClient';
import {chargerPages} from '../volailles/chargerPages';
import ModalCloseButton from '../components/ModalCloseButton';
import {dateMartinique,heureMartinique} from './heureMesure';
import {preparerAjoutProduit,trierAjoutsProduits,unitesProduit,type AjoutProduitEau,type FormulaireProduit} from './ajoutsProduits';
const table='aquaponie_product_additions';
const installation='Le journal des produits doit être activé : exécutez supabase/aquaponie-ajouts-produits.sql dans Supabase SQL Editor.';
const messageErreur=(e:unknown)=>{const code=(e as {code?:string})?.code;return ['PGRST205','42P01','PGRST204','42703'].includes(code||'')?installation:e instanceof Error?e.message:'Opération impossible. Réessayez ou actualisez les données.';};
export default function AjoutsProduitsEau({bassins,cuves,onChange,controle}:{controle?:Ref<{ouvrir:()=>void}>;onChange?:(ajouts:AjoutProduitEau[])=>void;bassins:{id:string;name:string}[];cuves:{id:string;name:string}[]}){
  const [ajouts,setAjouts]=useState<AjoutProduitEau[]>([]),[loading,setLoading]=useState(true),[erreur,setErreur]=useState('');
  const [form,setForm]=useState<FormulaireProduit|null>(null),[ancien,setAncien]=useState<AjoutProduitEau|null>(null),[saving,setSaving]=useState(false),[erreurForm,setErreurForm]=useState('');
  const [recherche,setRecherche]=useState(''),[debut,setDebut]=useState(''),[fin,setFin]=useState(''),[limite,setLimite]=useState(20);
  const verrou=useRef(false),panneau=useRef<HTMLDivElement>(null);
  const charger=useCallback(async()=>{setLoading(true);setErreur('');try{setAjouts(trierAjoutsProduits(await chargerPages((a,b)=>supabase.from(table).select('*').order('addition_date',{ascending:false}).order('addition_time',{ascending:false}).order('id').range(a,b)) as AjoutProduitEau[]));}catch(e){setErreur(messageErreur(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void charger();},[charger]);
  useEffect(()=>{onChange?.(ajouts);},[ajouts,onChange]);
  const ouvert=!!form;
  useEffect(()=>{if(!ouvert)return;const precedent=document.activeElement as HTMLElement|null;panneau.current?.querySelector<HTMLInputElement>('input')?.focus();return()=>precedent?.focus();},[ouvert]);
  const ouvrir=(a?:AjoutProduitEau)=>{setAncien(a||null);setErreurForm('');setForm(a?{id:a.id,nom:a.product_name,quantite:String(a.quantity),unite:a.unit,date:a.addition_date,heure:a.addition_time.slice(0,5),cible:a.target_type,cibleId:a.basin_id||a.tank_id||'',notes:a.notes||''}:{id:crypto.randomUUID(),nom:'',quantite:'',unite:'',date:dateMartinique(),heure:heureMartinique(),cible:'bassin',cibleId:'',notes:''});};
  useImperativeHandle(controle,()=>({ouvrir:()=>{if(!verrou.current)ouvrir();}}));
  const enregistrer=async()=>{if(!form||verrou.current)return;verrou.current=true;setSaving(true);setErreurForm('');try{
    const payload=preparerAjoutProduit(form,bassins,cuves,ancien);
    const requete=ancien?supabase.from(table).update(payload).eq('id',ancien.id).eq('updated_at',ancien.updated_at):supabase.from(table).upsert(payload,{onConflict:'id'});
    const {data,error}=await requete.select('*').single();if(error)throw error;
    setAjouts(lignes=>trierAjoutsProduits([...lignes.filter(l=>l.id!==data.id),data as AjoutProduitEau]));setForm(null);setErreur('');toast.success(ancien?'Ajout modifié.':'Ajout de produit enregistré.',{id:'ajout-produit-eau'});
  }catch(e){setErreurForm(messageErreur(e));panneau.current?.focus();}finally{verrou.current=false;setSaving(false);}};
  const supprimer=async(a:AjoutProduitEau)=>{if(verrou.current||!window.confirm(`Supprimer l’ajout de ${a.product_name} ?`))return;verrou.current=true;setSaving(true);try{const {error}=await supabase.from(table).delete().eq('id',a.id).eq('updated_at',a.updated_at).select('id').single();if(error)throw error;setAjouts(lignes=>lignes.filter(l=>l.id!==a.id));toast.success('Ajout supprimé.');}catch(e){setErreur(messageErreur(e));}finally{verrou.current=false;setSaving(false);}};
  const visibles=ajouts.filter(a=>(!recherche||`${a.product_name} ${a.target_label}`.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')))&&(!debut||a.addition_date>=debut)&&(!fin||a.addition_date<=fin));
  const changer=(cle:keyof FormulaireProduit,valeur:string)=>setForm(f=>f?{...f,[cle]:valeur}:null);
  return <section className="water-products" aria-label="Ajouts de produits dans l’eau">
    {erreur&&<div className="daily-alert" role="alert">{erreur}<button type="button" onClick={()=>void charger()} disabled={loading}>Réessayer</button></div>}
    <details className="water-products-history"><summary>Historique des ajouts {!loading&&!erreur&&`(${ajouts.length})`}</summary>
      <div className="water-products-filters"><label>Produit ou destination<input type="search" value={recherche} onChange={e=>{setRecherche(e.target.value);setLimite(20);}}/></label><label>À partir du<input type="date" value={debut} onChange={e=>{setDebut(e.target.value);setLimite(20);}}/></label><label>Jusqu’au<input type="date" value={fin} onChange={e=>{setFin(e.target.value);setLimite(20);}}/></label></div>
      {debut&&fin&&debut>fin&&<p role="alert">La date de début doit précéder la date de fin.</p>}
      {loading?<p role="status">Chargement des ajouts…</p>:<>{visibles.slice(0,limite).map(a=><article key={a.id} className="water-product-row"><div><strong>{a.product_name}</strong><span>{a.target_label}</span><small>{a.addition_date.split('-').reverse().join('/')} à {a.addition_time.slice(0,5)}</small>{a.notes&&<p>{a.notes}</p>}</div><b>{Number(a.quantity).toLocaleString('fr-FR',{maximumFractionDigits:20})} {a.unit==='unite'?(Number(a.quantity)===1?'unité':'unités'):a.unit}</b><div className="water-product-actions"><button type="button" disabled={saving} aria-label={`Modifier l’ajout de ${a.product_name}`} onClick={()=>ouvrir(a)}>✎ Modifier</button><button type="button" disabled={saving} aria-label={`Supprimer l’ajout de ${a.product_name}`} onClick={()=>void supprimer(a)}>Supprimer</button></div></article>)}{!visibles.length&&!erreur&&<p>Aucun ajout pour les filtres sélectionnés.</p>}{visibles.length>limite&&<button type="button" onClick={()=>setLimite(n=>n+20)}>Afficher les ajouts suivants</button>}</>}
    </details>
    {form&&<div className="poultry-modal-backdrop"><div ref={panneau} tabIndex={-1} className="poultry-modal poultry-modal-medium" role="dialog" aria-modal="true" aria-labelledby="water-product-title" onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();if(!saving)setForm(null);}
      if(e.key==='Tab'){const elements=[...panneau.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];if(document.activeElement===panneau.current){e.preventDefault();(e.shiftKey?elements.at(-1):elements[0])?.focus();}else if(e.shiftKey&&document.activeElement===elements[0]){e.preventDefault();elements.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===elements.at(-1)){e.preventDefault();elements[0]?.focus();}}
    }}><ModalCloseButton onClick={()=>setForm(null)} disabled={saving}/><div className="poultry-modal-header"><span className="poultry-modal-icon">＋</span><div><h2 id="water-product-title">{ancien?'Modifier l’ajout de produit':'Enregistrer un ajout de produit'}</h2><p>Indiquez la quantité réellement ajoutée.</p></div></div>
      {erreurForm&&<p className="daily-alert" role="alert">{erreurForm}</p>}
      <fieldset disabled={saving} className="water-product-form"><label>Nom du produit<input value={form.nom} maxLength={150} list="water-products-known" onChange={e=>changer('nom',e.target.value)}/><datalist id="water-products-known">{[...new Set(ajouts.map(a=>a.product_name))].map(n=><option key={n} value={n}/>)}</datalist></label>
        <div className="water-product-form-pair"><label>Quantité ajoutée<input type="number" inputMode="decimal" min="0" step="any" value={form.quantite} onChange={e=>changer('quantite',e.target.value)}/></label><label>Unité<select value={form.unite} onChange={e=>changer('unite',e.target.value)}><option value="">Choisir…</option>{unitesProduit.map(u=><option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}</select></label></div>
        <label>Destination<select value={form.cible} onChange={e=>setForm(f=>f?{...f,cible:e.target.value as FormulaireProduit['cible'],cibleId:''}:null)}><option value="bassin">Un bassin</option><option value="cuve">Une cuve</option><option value="systeme">Circuit complet</option></select></label>
        {form.cible!=='systeme'&&<label>{form.cible==='bassin'?'Bassin':'Cuve'}<select value={form.cibleId} onChange={e=>changer('cibleId',e.target.value)}><option value="">{ancien&&ancien.target_type===form.cible&&!(ancien.basin_id||ancien.tank_id)?`${ancien.target_label} (supprimé)`:'Choisir…'}</option>{(form.cible==='bassin'?bassins:cuves).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <div className="water-product-form-pair"><label>Date d’ajout<input type="date" value={form.date} onChange={e=>changer('date',e.target.value)}/></label><label>Heure d’ajout (Martinique)<input type="time" value={form.heure} onChange={e=>changer('heure',e.target.value)}/></label></div>
        <label>Observation (facultatif)<textarea maxLength={2000} value={form.notes} onChange={e=>changer('notes',e.target.value)}/></label>
      </fieldset><div className="poultry-modal-actions"><button type="button" className="poultry-modal-secondary" disabled={saving} onClick={()=>setForm(null)}>Annuler</button><button type="button" className="poultry-modal-primary" disabled={saving} onClick={()=>void enregistrer()}>{saving?'Enregistrement…':'✓ Enregistrer l’ajout'}</button></div>
    </div></div>}
  </section>;
}
