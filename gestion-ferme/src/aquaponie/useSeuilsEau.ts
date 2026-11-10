import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {lireSeuilsEau,seuilsEauDefaut} from './seuilsEau';
export function useSeuilsEau(){
  const [seuils,setSeuils]=useState(seuilsEauDefaut),[loading,setLoading]=useState(true),[erreur,setErreur]=useState('');
  const charger=useCallback(async()=>{setLoading(true);try{const {data,error}=await supabase.from('app_settings').select('key,value').eq('category','aquaponie');if(error)throw error;setSeuils(lireSeuilsEau(data||[]));setErreur('');}catch{setErreur('Impossible de charger les seuils aquaponie. Réessayez avant de consulter les alertes.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void charger();const recharger=()=>{void charger();};window.addEventListener('focus',recharger);return()=>window.removeEventListener('focus',recharger);},[charger]);
  return {seuils,loading,erreur,charger};
}
