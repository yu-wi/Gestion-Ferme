export const seuilsEauDefaut = { ph: 6, conductivity: 1, delaiHeures: 24 };
export type SeuilsEau = typeof seuilsEauDefaut;
export const champsSeuilsEau = [
  {champ:'ph',key:'aquaponie_ph_min',label:'Seuil bas pH',max:14},
  {champ:'conductivity',key:'aquaponie_ec_min',label:'Seuil bas EC (unité de vos saisies)'},
  {champ:'delaiHeures',key:'aquaponie_measure_max_hours',label:'Délai maximal entre relevés (heures)'},
] as const;
export function validerSeuilsEau(form:Record<keyof SeuilsEau,string>):SeuilsEau {
  const valeurs={ph:Number(form.ph),conductivity:Number(form.conductivity),delaiHeures:Number(form.delaiHeures)};
  if(Object.values(form).some(v=>!v.trim())||Object.values(valeurs).some(v=>!Number.isFinite(v)||v<0)||valeurs.ph>14||valeurs.delaiHeures<=0)throw new Error('Indiquez un pH de 0 à 14, une EC positive ou nulle et un délai supérieur à zéro.');
  return valeurs;
}
export function lireSeuilsEau(lignes:{key:string;value:string}[]):SeuilsEau {
  const form={ph:'6',conductivity:'1',delaiHeures:'24'};
  for(const champ of champsSeuilsEau){const ligne=lignes.find(l=>l.key===champ.key);if(ligne)form[champ.champ]=ligne.value;}
  return validerSeuilsEau(form);
}
