export type MesureAnalyseEau = { id: string; basin_id: string | null; target_type?: string | null; measure_date: string; measure_time?: string | null; temperature_c?: number | null; ph: number | null; conductivity: number | null };
export type BassinAnalyseEau = { id: string; name: string };
export type MetriqueEau = 'ph' | 'conductivity';
export const couleursEau = ['#16843c','#2563eb','#b45309','#9333ea','#dc2626','#087e8b','#be185d','#596579'];
export function bassinsDesMesures(bassins: BassinAnalyseEau[], mesures: MesureAnalyseEau[]) {
  const tous=new Map(bassins.map(b=>[b.id,b]));
  for(const m of mesures) if(m.basin_id && m.target_type !== 'cuve' && !tous.has(m.basin_id)) tous.set(m.basin_id,{id:m.basin_id,name:`Bassin archivé (${m.basin_id.slice(0,8)})`});
  return [...tous.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true}));
}
export function instantMesureEau(date: string, heure?: string | null) {
  if(!heure || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$/.test(heure)) return null;
  const instant=Date.parse(`${date}T${heure.length===5?heure+':00':heure}-04:00`);
  return Number.isFinite(instant) ? instant : null;
}
export function analyserEau(mesures: MesureAnalyseEau[], bassins: BassinAnalyseEau[], selection: string[], metrique: MetriqueEau, date: string, periode: 'jour' | 'semaine' | 'mois') {
  const finJour=Date.parse(`${date}T00:00:00-04:00`);
  const debut=periode==='mois'?Date.parse(`${date.slice(0,7)}-01T00:00:00-04:00`):finJour-(periode==='semaine'?6:0)*86400000;
  const suivant=new Date(debut-4*3600000);suivant.setUTCMonth(suivant.getUTCMonth()+1);
  const fin=periode==='mois'?suivant.getTime()+4*3600000:finJour+86400000;
  const dateDebut=new Date(debut-4*3600000).toISOString().slice(0,10);
  const dateFin=new Date(fin-4*3600000).toISOString().slice(0,10);
  const retenues=mesures.filter(m=>m.target_type!=='cuve'&&m.measure_date>=dateDebut&&m.measure_date<dateFin);
  const generales=retenues.filter(m=>!m.basin_id).length;
  const releves: {id:string;bassin:string;date:string;heure:string|null;valeur:number|null}[]=[];
  let sansHeure=0,sansValeur=0;
  const series=bassins.filter(b=>selection.includes(b.id)).map(b=>{
    const lignes=retenues.filter(m=>m.basin_id===b.id).map(m=>({...m,instant:instantMesureEau(m.measure_date,m.measure_time)}));
    releves.push(...lignes.map(m=>({id:m.id,bassin:b.name,date:m.measure_date,heure:m.measure_time||null,valeur:m[metrique]===null||!Number.isFinite(Number(m[metrique]))?null:Number(m[metrique])})));
    sansHeure+=lignes.filter(m=>m.instant===null).length;
    sansValeur+=lignes.filter(m=>m[metrique]===null||!Number.isFinite(Number(m[metrique]))).length;
    const ordonnees=lignes.filter(m=>m.instant!==null).sort((a,b)=>a.instant!-b.instant!||a.id.localeCompare(b.id));
    type Point={id:string;instant:number;valeur:number;bassin:string;heure:string;date:string};
    const segments:Point[][]=[];let courant:Point[]=[];
    for(const m of ordonnees){
      if(m[metrique]===null||!Number.isFinite(Number(m[metrique]))){if(courant.length)segments.push(courant);courant=[];continue;}
      courant.push({id:m.id,instant:m.instant!,valeur:Number(m[metrique]),bassin:b.name,heure:m.measure_time!,date:m.measure_date});
    }
    if(courant.length)segments.push(courant);
    const points=segments.flat();
    return {...b,couleur:couleursEau[bassins.findIndex(x=>x.id===b.id)%couleursEau.length],segments,points};
  });
  const valeurs=series.flatMap(s=>s.points.map(p=>p.valeur));
  const min=valeurs.length?Math.min(...valeurs):0,max=valeurs.length?Math.max(...valeurs):metrique==='ph'?14:1;
  const marge=Math.max((max-min)*.15,metrique==='ph'?.1:Math.max(1,Math.abs(max)*.01));
  return {debut,fin,series,releves,generales,sansHeure,sansValeur,nbPoints:valeurs.length,domaine:[min<0?min-marge:Math.max(0,min-marge),max+marge] as [number,number]};
}
