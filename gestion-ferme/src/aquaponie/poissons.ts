export type LotPoissons={id:string;name:string;approx_birth_date:string;updated_at:string};
export type SuiviPoissons={id:string;lot_id:string;observed_on:string;quantity:number;unit_weight_g:number;basin_id:string|null;basin_label:string;created_at:string};
export type FormulairePoissons={id:string;observationId:string;nom:string;naissance:string;date:string;quantite:string;poids:string;bassinId:string};
export function calculerRationPoissons(quantite:number,poidsG:number){
 if(!Number.isSafeInteger(quantite)||quantite<0||!Number.isFinite(poidsG)||poidsG<=0) return null;
 const biomasseKg=quantite*poidsG/1000,rationG=quantite*poidsG*.02;
 return Number.isFinite(biomasseKg)&&Number.isFinite(rationG)?{biomasseKg,rationG,rationKg:rationG/1000}:null;
}
const dateValide=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function preparerSuiviPoissons(f:FormulairePoissons,bassins:{id:string;name:string}[],aujourdhui:string,ancien?:LotPoissons|null){
 const nom=f.nom.trim(),quantite=Number(f.quantite),poids=Number(f.poids);
 if(!nom||nom.length>100)throw new Error('Indiquez un nom de lot de 1 à 100 caractères.');
 if(!dateValide(f.naissance)||!dateValide(f.date)||f.naissance>f.date||f.date>aujourdhui)throw new Error('Vérifiez les dates : naissance avant le suivi, sans date future.');
 if(!f.quantite.trim()||!f.poids.trim()||!calculerRationPoissons(quantite,poids))throw new Error('Indiquez un effectif entier positif ou nul et un poids unitaire supérieur à zéro.');
 if(!bassins.some(b=>b.id===f.bassinId))throw new Error('Choisissez le bassin du lot.');
 return {p_lot_id:f.id,p_observation_id:f.observationId,p_name:nom,p_birth_date:f.naissance,p_observed_on:f.date,p_quantity:quantite,p_unit_weight_g:poids,p_basin_id:f.bassinId,p_expected_updated_at:ancien?.updated_at||null};
}
export function trierSuivisPoissons(lignes:SuiviPoissons[]){return [...lignes].sort((a,b)=>b.observed_on.localeCompare(a.observed_on)||b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));}
