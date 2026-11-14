import { instantMesureEau } from './analyseEau.ts';
import { heureMesureValide } from './heureMesure.ts';
export const unitesProduit = [{valeur:'g',libelle:'g'},{valeur:'kg',libelle:'kg'},{valeur:'mL',libelle:'mL'},{valeur:'L',libelle:'L'},{valeur:'unite',libelle:'unité(s)'}] as const;
export type TypeCibleProduit = 'bassin' | 'cuve' | 'systeme';
export type AjoutProduitEau = { id:string;product_name:string;quantity:number;unit:string;addition_date:string;addition_time:string;target_type:TypeCibleProduit;basin_id:string|null;tank_id:string|null;target_label:string;notes:string|null;updated_at:string };
export type FormulaireProduit = { id:string;nom:string;quantite:string;unite:string;date:string;heure:string;cible:TypeCibleProduit;cibleId:string;notes:string };
export function preparerAjoutProduit(form:FormulaireProduit,bassins:{id:string;name:string}[],cuves:{id:string;name:string}[],ancien?:AjoutProduitEau|null){
  const nom=form.nom.trim(),quantity=Number(form.quantite);
  if(!nom||nom.length>150)throw new Error('Indiquez un nom de produit de 1 à 150 caractères.');
  if(!form.quantite.trim()||!Number.isFinite(quantity)||quantity<=0)throw new Error('Indiquez une quantité supérieure à zéro.');
  if(!unitesProduit.some(u=>u.valeur===form.unite))throw new Error('Choisissez l’unité de la quantité ajoutée.');
  const instant=Date.parse(`${form.date}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(form.date)||!Number.isFinite(instant)||new Date(instant).toISOString().slice(0,10)!==form.date||!heureMesureValide(form.heure))throw new Error('Indiquez une date et une heure d’ajout valides.');
  if(!['bassin','cuve','systeme'].includes(form.cible))throw new Error('Choisissez la destination de l’ajout.');
  const cible=(form.cible==='bassin'?bassins:cuves).find(c=>c.id===form.cibleId);
  const ancienneCible=ancien?.target_type===form.cible&&(form.cible==='bassin'?ancien.basin_id:ancien.tank_id)===null&&!form.cibleId;
  if(form.cible!=='systeme'&&!cible&&!ancienneCible)throw new Error('Choisissez le bassin ou la cuve concerné.');
  return {id:form.id,product_name:nom,quantity,unit:form.unite,addition_date:form.date,addition_time:form.heure,target_type:form.cible,
    basin_id:form.cible==='bassin'?(cible?.id||null):null,tank_id:form.cible==='cuve'?(cible?.id||null):null,
    target_label:form.cible==='systeme'?'Circuit complet':cible?`${form.cible==='bassin'?'Bassin':'Cuve'} : ${cible.name}`:ancien!.target_label,notes:form.notes.trim()||null};
}
export function trierAjoutsProduits(lignes:AjoutProduitEau[]){return [...lignes].sort((a,b)=>b.addition_date.localeCompare(a.addition_date)||b.addition_time.localeCompare(a.addition_time)||a.id.localeCompare(b.id));}

export function reperesProduits(ajouts:AjoutProduitEau[],selection:string[],debut:number,fin:number){
  return ajouts.flatMap(a=>{
    const instant=instantMesureEau(a.addition_date,a.addition_time);
    return instant!==null&&instant>=debut&&instant<fin&&selection.length>0&&(a.target_type==='systeme'||a.target_type==='cuve'||(a.target_type==='bassin'&&!!a.basin_id&&selection.includes(a.basin_id)))?[{...a,instant}]:[];
  }).sort((a,b)=>a.instant-b.instant||a.id.localeCompare(b.id));
}
