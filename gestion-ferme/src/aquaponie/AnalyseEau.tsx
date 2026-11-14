import { capturerGraphiqueEau } from './capturerGraphiqueEau';
import { preparerRapportEau } from './rapportEau';
import { reperesProduits, type AjoutProduitEau } from './ajoutsProduits';
import { useRef, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { dateMartinique } from './heureMesure';
import { analyserEau,bassinsDesMesures,couleursEau,type MesureAnalyseEau,type BassinAnalyseEau,type MetriqueEau } from './analyseEau';
const heure=(instant:number)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Martinique',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));
const jour=(instant:number)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Martinique',day:'2-digit',month:'2-digit'}).format(new Date(instant));
const nombre=(v:number)=>v.toLocaleString('fr-FR',{maximumFractionDigits:3});
export default function AnalyseEau({mesures,bassins,onModifier,ajouts=[]}:{ajouts?:AjoutProduitEau[];mesures:MesureAnalyseEau[];bassins:BassinAnalyseEau[];onModifier?:(id:string)=>void}) {
  const [metrique,setMetrique]=useState<MetriqueEau>('ph');
  const [date,setDate]=useState(()=>mesures.find(m=>m.basin_id&&m.target_type!=='cuve')?.measure_date||dateMartinique());
  const [periode,setPeriode]=useState<'jour'|'semaine'|'mois'>('jour');
  type PointLecture={id:string;instant:number;valeur:number;bassin:string};
  const [lecture,setLecture]=useState<{metrique:MetriqueEau;date:string;periode:string;point:PointLecture}|null>(null);
  const [masques,setMasques]=useState<string[]>([]);
  const disponibles=bassinsDesMesures(bassins,mesures);
  const selection=disponibles.filter(b=>!masques.includes(b.id)).map(b=>b.id);
  const dateValide=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(`${date}T00:00:00-04:00`));
  const donnees=dateValide ? analyserEau(mesures,disponibles,selection,metrique,date,periode):null;
  const [produitChoisi,setProduitChoisi]=useState<string|null>(null);
  const reperes=donnees?reperesProduits(ajouts,selection,donnees.debut,donnees.fin):[];
  const produit=reperes.find(a=>a.id===produitChoisi);
  const nom=metrique==='ph'?'pH':'EC';
  const zoneGraphique=useRef<HTMLDivElement>(null);
  const [exportEnCours,setExportEnCours]=useState(false);
  const [erreurExport,setErreurExport]=useState('');
  const exporter=async(format:'excel'|'pdf')=>{
    if(!donnees||!selection.length||exportEnCours)return;
    const rapport=preparerRapportEau(donnees,reperes,nom,periode);
    setExportEnCours(true);setErreurExport('');
    try{const graphique=await capturerGraphiqueEau(zoneGraphique.current?.querySelector('svg.recharts-surface')||null,donnees.series);const module=await import('./exportEau');if(format==='excel')await module.exporterEauExcel(rapport,graphique);else module.exporterEauPdf(rapport,graphique);}
    catch{setErreurExport('L’export a échoué. Réessayez.');}finally{setExportEnCours(false);}
  };
  const lectureVisible=lecture&&lecture.metrique===metrique&&lecture.date===date&&lecture.periode===periode&&donnees?.series.some(s=>s.points.some(p=>p.id===lecture.point.id));
  return <section className="water-analysis" aria-label="Analyse des paramètres d’eau">
    <div className="water-metric-tabs" role="group" aria-label="Paramètre à analyser"><button type="button" aria-pressed={metrique==='ph'} onClick={()=>setMetrique('ph')}>pH</button><button type="button" aria-pressed={metrique==='conductivity'} onClick={()=>setMetrique('conductivity')}>EC</button></div>
    <div className="water-analysis-controls"><label>Période<select value={periode} onChange={e=>setPeriode(e.target.value as 'jour'|'semaine'|'mois')}><option value="jour">Une journée</option><option value="semaine">7 jours jusqu’à la date choisie</option><option value="mois">Un mois</option></select></label><label>{periode==='jour'?'Journée':periode==='mois'?'Mois':'Jusqu’au'}<input type={periode==='mois'?'month':'date'} value={periode==='mois'?date.slice(0,7):date} onChange={e=>setDate(periode==='mois'&&e.target.value?`${e.target.value}-01`:e.target.value)}/></label></div>
    <fieldset className="water-basin-filters"><legend>Bassins à comparer</legend>{disponibles.map((b,i)=><label key={b.id}><input type="checkbox" checked={!masques.includes(b.id)} onChange={e=>setMasques(ancien=>e.target.checked?ancien.filter(id=>id!==b.id):[...ancien,b.id])}/><span style={{background:donnees?.series.find(s=>s.id===b.id)?.couleur||couleursEau[i%couleursEau.length]}} aria-hidden="true"/>{b.name}</label>)}</fieldset>
    <div className="water-basin-actions"><button type="button" onClick={()=>setMasques([])}>Tous les bassins</button><button type="button" onClick={()=>setMasques(disponibles.map(b=>b.id))}>Tout masquer</button></div>
    <div className="water-export-actions" role="group" aria-label="Exporter les données filtrées"><button type="button" disabled={!donnees||!selection.length||exportEnCours||(!donnees.releves.length&&!reperes.length)} onClick={()=>void exporter('excel')}>↓ Exporter Excel</button><button type="button" disabled={!donnees||!selection.length||exportEnCours||(!donnees.releves.length&&!reperes.length)} onClick={()=>void exporter('pdf')}>↓ Exporter PDF</button>{exportEnCours&&<span role="status">Préparation de l’export…</span>}</div>
    <p className="water-analysis-note">Les exports reprennent le paramètre, la période et les bassins sélectionnés, avec les ajouts de produits correspondants.</p>
    {erreurExport&&<p role="alert">{erreurExport}</p>}
    <h3>Évolution {metrique==='ph'?'du pH':'de l’EC'}{periode==='jour'?' dans la journée':periode==='mois'?' sur le mois':' sur 7 jours'}</h3><p>Heures de Martinique · une couleur par bassin · touchez ou survolez un point pour voir son relevé. L’échelle verticale s’adapte aux valeurs affichées.</p>
    {!dateValide?<p role="status">Choisissez une date valide.</p>:!disponibles.length?<p role="status">Aucun bassin à comparer. Ajoutez un bassin ou un relevé rattaché à un bassin.</p>:!selection.length?<p role="status">Sélectionnez au moins un bassin.</p>:!donnees?.nbPoints?<p className="aquaponie-empty">Aucun relevé de {nom} avec une heure connue pour les bassins et la période sélectionnés.</p>:<>
      <div ref={zoneGraphique} className="water-time-chart" role="group" aria-label={`Comparaison du ${nom} par bassin avec les heures réelles des relevés`}>
        <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:16,right:16,bottom:20,left:0}}>
          <CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="instant" domain={[donnees.debut,donnees.fin]} ticks={periode==='mois'?Array.from({length:Math.ceil((donnees.fin-donnees.debut)/86400000/5)},(_,i)=>donnees.debut+i*5*86400000):Array.from({length:periode==='jour'?7:8},(_,i)=>donnees.debut+i*(periode==='jour'?4*3600000:86400000))} tickFormatter={v=>periode==='jour'?(v===donnees.fin?'24:00':heure(v)):jour(v)} tick={{fontSize:12}}/><YAxis type="number" dataKey="valeur" domain={donnees.domaine} tickFormatter={nombre} width={58} tick={{fontSize:12}}/>
          {reperes.filter((a,i,l)=>l.findIndex(b=>b.instant===a.instant)===i).map(a=><ReferenceLine key={a.id} x={a.instant} stroke="#b45309" strokeDasharray="5 4" label={(props:unknown)=>{const {viewBox}=props as {viewBox?:{x:number;y:number}};return viewBox?<text x={viewBox.x} y={viewBox.y+16} textAnchor="middle" fill="#b45309" fontSize={20} tabIndex={0} role="button" aria-label={`Voir l’ajout de ${a.product_name} à ${heure(a.instant)}`} style={{cursor:'pointer'}} onClick={()=>setProduitChoisi(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setProduitChoisi(a.id);}}}>＋</text>:<g/>;}} />)}
          <Tooltip cursor={{strokeDasharray:'3 3'}} content={({active,payload})=>{const point=payload?.[0]?.payload as {bassin:string;instant:number;valeur:number}|undefined;return active&&point?<div className="water-point-tooltip"><strong>{point.bassin}</strong><span>{jour(point.instant)} à {heure(point.instant)}</span><b>{nom} : {point.valeur.toLocaleString('fr-FR',{maximumFractionDigits:20})}</b></div>:null;}}/>
          {donnees.series.flatMap(serie=>serie.segments.map((points,i)=><Scatter key={`${serie.id}-${i}`} name={serie.name} data={points} fill={serie.couleur} shape={(props:unknown)=>{
            const {cx,cy,payload}=props as {cx:number;cy:number;payload:PointLecture};
            const choisir=()=>setLecture({metrique,date,periode,point:payload});
            return <circle className="water-chart-point" cx={cx} cy={cy} r={6} fill={serie.couleur} stroke="#fff" strokeWidth={1.5} tabIndex={0} role="button" aria-label={`${payload.bassin}, ${jour(payload.instant)} à ${heure(payload.instant)}, ${nom} ${nombre(payload.valeur)}`} onPointerDown={choisir} onClick={choisir} onFocus={choisir} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choisir();}}}/>;
          }} line={points.length>1?{stroke:serie.couleur,strokeWidth:2}:false} lineType="joint" isAnimationActive={false}/>))}
        </ScatterChart></ResponsiveContainer>
      </div>
      {lectureVisible&&lecture&&<div className="water-selected-reading" role="status"><strong>{lecture.point.bassin} · {jour(lecture.point.instant)} à {heure(lecture.point.instant)}</strong><b>{nom} : {lecture.point.valeur.toLocaleString('fr-FR',{maximumFractionDigits:20})}</b><button type="button" aria-label="Fermer le détail du relevé" onClick={()=>setLecture(null)}>×</button></div>}
      <div className="water-basin-summary">{donnees.series.map(serie=><article key={serie.id}><strong style={{color:serie.couleur}}>{serie.name}</strong>{serie.points.length?<><span>{serie.points.length} relevé(s) · min {nombre(Math.min(...serie.points.map(p=>p.valeur)))} · max {nombre(Math.max(...serie.points.map(p=>p.valeur)))}</span><b>Dernier : {nombre(serie.points.at(-1)!.valeur)} à {heure(serie.points.at(-1)!.instant)}</b></>:<span>Aucun relevé exploitable</span>}</article>)}</div>

    </>}
    {!!reperes.length&&<div className="water-product-markers" aria-label="Produits ajoutés pendant la période"><h4>＋ Ajouts de produits · repères orange</h4><p>Les repères indiquent l’heure d’ajout, sans valeur de pH ou d’EC associée. Touchez un produit pour voir le détail.</p><div>{reperes.map(a=><button type="button" key={a.id} aria-pressed={produitChoisi===a.id} onClick={()=>setProduitChoisi(a.id)}>{jour(a.instant)} à {heure(a.instant)} · {a.product_name}</button>)}</div>{produit&&<div className="water-selected-reading" role="status"><strong>{produit.product_name} · {produit.target_label}</strong><span>{jour(produit.instant)} à {heure(produit.instant)} · {Number(produit.quantity).toLocaleString('fr-FR',{maximumFractionDigits:20})} {produit.unit==='unite'?'unité(s)':produit.unit}</span>{produit.notes&&<p>{produit.notes}</p>}<button type="button" aria-label="Fermer le détail du produit" onClick={()=>setProduitChoisi(null)}>×</button></div>}<small>Ajouts des bassins sélectionnés et du circuit complet. Les ajouts en cuve restent dans l’historique.</small></div>}
    {!!donnees?.releves.length&&<details className="water-readings"><summary>Voir les relevés de la période ({donnees.releves.length})</summary><div className="aquaponie-table-wrap"><table><thead><tr><th>Bassin</th><th>Date</th><th>Heure</th><th>{nom}</th>{onModifier&&<th>Action</th>}</tr></thead><tbody>{[...donnees.releves].sort((a,b)=>a.date.localeCompare(b.date)||(a.heure||'').localeCompare(b.heure||'')||a.bassin.localeCompare(b.bassin)).map(p=><tr key={p.id}><td>{p.bassin}</td><td>{p.date.split('-').reverse().join('/')}</td><td>{p.heure?.slice(0,8)||'Non renseignée'}</td><td>{p.valeur===null?'—':p.valeur.toLocaleString('fr-FR',{maximumFractionDigits:20})}</td>{onModifier&&<td><button type="button" onClick={()=>onModifier(p.id)} aria-label={`Modifier le relevé du ${p.date} ${p.heure||''} du bassin ${p.bassin}`}>✎ Modifier</button></td>}</tr>)}</tbody></table></div></details>}
    {!!donnees?.sansHeure&&<p className="water-analysis-note">{donnees.sansHeure} relevé(s) sans heure connue : consultables ci-dessus, mais non placés sur la courbe horaire.</p>}
    {!!donnees?.sansValeur&&<p className="water-analysis-note">{donnees.sansValeur} relevé(s) sans valeur de {nom}. La courbe s’interrompt lorsqu’une valeur manque.</p>}
    {!!donnees?.generales&&<p className="water-analysis-note">{donnees.generales} relevé(s) global(aux) sans bassin précis : non attribués aux courbes des bassins. Les mesures des cuves restent dans l’historique.</p>}
  </section>;
}
