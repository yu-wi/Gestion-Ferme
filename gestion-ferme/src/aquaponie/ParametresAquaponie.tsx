import {useEffect,useRef,useState} from 'react';
import toast from 'react-hot-toast';
import {supabase} from '../supabaseClient';
import {useSeuilsEau} from './useSeuilsEau';
import {champsSeuilsEau,validerSeuilsEau} from './seuilsEau';
export default function ParametresAquaponie(){
  const {seuils,loading,erreur,charger}=useSeuilsEau();
  const [form,setForm]=useState({ph:'6',conductivity:'1',delaiHeures:'24'}),[saving,setSaving]=useState(false),[message,setMessage]=useState('');const verrou=useRef(false),modifie=useRef(false);
  useEffect(()=>{if(!modifie.current)setForm({ph:String(seuils.ph),conductivity:String(seuils.conductivity),delaiHeures:String(seuils.delaiHeures)});},[seuils]);
  const enregistrer=async()=>{if(verrou.current)return;verrou.current=true;setSaving(true);setMessage('');try{const valeurs=validerSeuilsEau(form);const {error}=await supabase.from('app_settings').upsert(champsSeuilsEau.map(c=>({key:c.key,value:String(valeurs[c.champ]),label:c.label,category:'aquaponie'})),{onConflict:'key'});if(error)throw new Error('Enregistrement impossible. Vérifiez la connexion et l’installation de supabase/app-settings.sql.');modifie.current=false;await charger();toast.success('Seuils aquaponie enregistrés.');}catch(e){setMessage(e instanceof Error?e.message:'Enregistrement impossible.');}finally{verrou.current=false;setSaving(false);}};
  return <section className="settings-panel"><div className="settings-panel-heading"><div><h2>Aquaponie</h2><p>Les alertes du résumé se déclenchent sous les seuils bas ou lorsque le dernier relevé est trop ancien. L’EC conserve l’unité de vos saisies.</p></div></div>{erreur&&<p role="alert">{erreur} <button type="button" onClick={()=>void charger()}>Réessayer</button></p>}{message&&<p role="alert">{message}</p>}<div className="settings-form settings-form-compact">{champsSeuilsEau.map(c=><label key={c.key}>{c.label}<input type="number" min={c.champ==='delaiHeures'?'0.01':'0'} max={c.champ==='ph'?14:undefined} step="any" disabled={loading||saving||!!erreur} value={form[c.champ]} onChange={e=>{modifie.current=true;setForm(f=>({...f,[c.champ]:e.target.value}));}}/></label>)}<div className="settings-form-actions"><button type="button" disabled={loading||saving||!!erreur} onClick={()=>void enregistrer()}>{saving?'Enregistrement…':'Enregistrer'}</button></div></div></section>;
}
