export const ongletsAquaponie = [
  {id:'resume',label:'Résumé'},
  {id:'parametres',label:'Paramètres eau'},
  {id:'bassins',label:'Bassins'},
  {id:'cuves',label:'Cuves'},
  {id:'cultures',label:'Cultures'},
  {id:'recoltes',label:'Récoltes'},
] as const;
export type AquaTab = typeof ongletsAquaponie[number]['id'];
export function ongletAquaponie(search:string):AquaTab {
  const onglet=new URLSearchParams(search).get('onglet');
  return ongletsAquaponie.find(o=>o.id===onglet)?.id||'resume';
}
