import {preparerAjoutProduit,type FormulaireProduit} from './ajoutsProduits.ts';
export function preparerAjoutEauCircuit(form:FormulaireProduit){
  return preparerAjoutProduit({...form,nom:'Eau',unite:'L',cible:'systeme',cibleId:''},[],[]);
}
