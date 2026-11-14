import IconeEau from './IconeEau';
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
export default function AnalyseEau({mesures,bassins,onModifier,onSupprimer,ajouts=[]}:{ajouts?:AjoutProduitEau[];mesures:MesureAnalyseEau[];bassins:BassinAnalyseEau[];onModifier?:(id:string)=>void;onSupprimer?:(id:string)=>void}) {
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
  const mesuresParId=new Map(mesures.map(m=>[m.id,m]));
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
    {!!reperes.length&&<div className="water-product-markers" aria-label="Produits ajoutés pendant la période"><div className="water-product-banner-title"><span className="water-icon-bubble orange"><IconeEau nom="produit"/></span><div><h4>Ajouts de produits ({reperes.length})</h4><p>Produits ajoutés sur la période<br/>et les cuves concernées.</p></div></div><div className="water-product-strip">{reperes.map(a=><button type="button" key={a.id} aria-pressed={produitChoisi===a.id} onClick={()=>setProduitChoisi(a.id)}><IconeEau nom="produit"/><span><b>{jour(a.instant)} · {heure(a.instant)}</b><small>{a.product_name} · {a.target_label.replace(/^Cuve : /,'Cuve ')}</small></span></button>)}</div>{produit&&<div className="water-selected-reading" role="status"><strong>{produit.product_name} · {produit.target_label}</strong><span>{jour(produit.instant)} à {heure(produit.instant)} · {Number(produit.quantity).toLocaleString('fr-FR',{maximumFractionDigits:20})} {produit.unit==='unite'?'unité(s)':produit.unit}</span>{produit.notes&&<p>{produit.notes}</p>}<button type="button" aria-label="Fermer le détail du produit" onClick={()=>setProduitChoisi(null)}>×</button></div>}</div>}
    <div className="water-analysis-layout"><aside className="water-analysis-sidebar"><h3>Paramètres et comparaison</h3><span className="water-control-caption">Paramètre</span>
    <div className="water-metric-tabs" role="group" aria-label="Paramètre à analyser"><button type="button" aria-pressed={metrique==='ph'} onClick={()=>setMetrique('ph')}>pH</button><button type="button" aria-pressed={metrique==='conductivity'} onClick={()=>setMetrique('conductivity')}>EC</button></div>
    <div className="water-analysis-controls"><label>Période<select value={periode} onChange={e=>setPeriode(e.target.value as 'jour'|'semaine'|'mois')}><option value="jour">Une journée</option><option value="semaine">7 jours jusqu’à la date choisie</option><option value="mois">Un mois</option></select></label><label>{periode==='jour'?'Journée':periode==='mois'?'Mois':'Jusqu’au'}<input type={periode==='mois'?'month':'date'} value={periode==='mois'?date.slice(0,7):date} onChange={e=>setDate(periode==='mois'&&e.target.value?`${e.target.value}-01`:e.target.value)}/></label></div>
    <fieldset className="water-basin-filters"><legend>Bassins à comparer</legend>{disponibles.map((b,i)=><label key={b.id}><input type="checkbox" checked={!masques.includes(b.id)} onChange={e=>setMasques(ancien=>e.target.checked?ancien.filter(id=>id!==b.id):[...ancien,b.id])}/><span style={{background:donnees?.series.find(s=>s.id===b.id)?.couleur||couleursEau[i%couleursEau.length]}} aria-hidden="true"/>{b.name}</label>)}</fieldset>
    <div className="water-basin-actions"><button type="button" onClick={()=>setMasques([])}>Tous les bassins</button><button type="button" onClick={()=>setMasques(disponibles.map(b=>b.id))}>Tout masquer</button></div>
    <div className="water-export-actions" role="group" aria-label="Exporter les données filtrées"><button type="button" disabled={!donnees||!selection.length||exportEnCours||(!donnees.releves.length&&!reperes.length)} onClick={()=>void exporter('excel')}><IconeEau nom="export"/> Exporter Excel</button><button type="button" disabled={!donnees||!selection.length||exportEnCours||(!donnees.releves.length&&!reperes.length)} onClick={()=>void exporter('pdf')}><IconeEau nom="export"/> Exporter PDF</button>{exportEnCours&&<span role="status">Préparation de l’export…</span>}</div>
    {erreurExport&&<p role="alert">{erreurExport}</p>}
    </aside><div className="water-analysis-main">
    <h3>Évolution {metrique==='ph'?'du pH':'de l’EC'}{periode==='jour'?' dans la journée':periode==='mois'?' sur le mois':' sur 7 jours'}</h3><p>Heures de Martinique · une couleur par bassin · les repères orange indiquent un ajout de produit.</p>
    {!dateValide?<p role="status">Choisissez une date valide.</p>:!disponibles.length?<p role="status">Aucun bassin à comparer. Ajoutez un bassin ou un relevé rattaché à un bassin.</p>:!selection.length?<p role="status">Sélectionnez au moins un bassin.</p>:!donnees||(!donnees.nbPoints&&!reperes.length)?<p className="aquaponie-empty">Aucun relevé de {nom} avec une heure connue pour les bassins et la période sélectionnés.</p>:<>
      {!donnees?.nbPoints&&<p role="status">Aucun relevé de {nom} exploitable : seuls les ajouts de produits sont positionnés à leur heure réelle, sans valeur de {nom} associée.</p>}
      <div ref={zoneGraphique} className="water-time-chart" role="group" aria-label={`Comparaison du ${nom} par bassin avec les heures réelles des relevés`}>
        <ResponsiveContainer width="100%" height="100%"><ScatterChart data={donnees.nbPoints?undefined:[{instant:donnees.debut,valeur:donnees.domaine[0]},{instant:donnees.fin,valeur:donnees.domaine[1]}]} margin={{top:16,right:16,bottom:20,left:0}}>
          <CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="instant" domain={[donnees.debut,donnees.fin]} ticks={periode==='mois'?Array.from({length:Math.ceil((donnees.fin-donnees.debut)/86400000/5)},(_,i)=>donnees.debut+i*5*86400000):Array.from({length:periode==='jour'?7:8},(_,i)=>donnees.debut+i*(periode==='jour'?4*3600000:86400000))} tickFormatter={v=>periode==='jour'?(v===donnees.fin?'24:00':heure(v)):jour(v)} tick={{fontSize:12}}/><YAxis type="number" dataKey="valeur" domain={donnees.domaine} tickFormatter={nombre} width={58} tick={{fontSize:12}}/>
          {reperes.filter((a,i,l)=>l.findIndex(b=>b.instant===a.instant)===i).map(a=><ReferenceLine key={a.id} x={a.instant} stroke="#b45309" strokeDasharray="5 4" label={(props:unknown)=>{const {viewBox}=props as {viewBox?:{x:number;y:number}};return viewBox?<g transform={`translate(${viewBox.x},${viewBox.y+12})`} tabIndex={0} role="button" aria-label={`Voir l’ajout de ${a.product_name} à ${heure(a.instant)}`} style={{cursor:'pointer'}} onClick={()=>setProduitChoisi(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setProduitChoisi(a.id);}}}><circle r={11} fill="#ffa21a" stroke="white"/><g transform="translate(-7,-7)" color="white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 3h6M10 3v7L4 20h16l-6-10V3M7 16h10"/></svg></g></g>:<g/>;}} />)}
          <Tooltip cursor={{strokeDasharray:'3 3'}} content={({active,payload})=>{const point=payload?.[0]?.payload as {bassin:string;instant:number;valeur:number}|undefined;return active&&point?<div className="water-point-tooltip"><strong>{point.bassin}</strong><span>{jour(point.instant)} à {heure(point.instant)}</span><b>{nom} : {point.valeur.toLocaleString('fr-FR',{maximumFractionDigits:20})}</b></div>:null;}}/>
          {donnees.series.flatMap(serie=>serie.segments.map((points,i)=><Scatter key={`${serie.id}-${i}`} name={serie.name} data={points} fill={serie.couleur} shape={(props:unknown)=>{
            const {cx,cy,payload}=props as {cx:number;cy:number;payload:PointLecture};
            const choisir=()=>setLecture({metrique,date,periode,point:payload});
            return <circle className="water-chart-point" cx={cx} cy={cy} r={6} fill={serie.couleur} stroke="#fff" strokeWidth={1.5} tabIndex={0} role="button" aria-label={`${payload.bassin}, ${jour(payload.instant)} à ${heure(payload.instant)}, ${nom} ${nombre(payload.valeur)}`} onPointerDown={choisir} onClick={choisir} onFocus={choisir} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choisir();}}}/>;
          }} line={points.length>1?{stroke:serie.couleur,strokeWidth:2}:false} lineType="joint" isAnimationActive={false}/>))}
        </ScatterChart></ResponsiveContainer>
      </div>
      {lectureVisible&&lecture&&<div className="water-selected-reading" role="status"><strong>{lecture.point.bassin} · {jour(lecture.point.instant)} à {heure(lecture.point.instant)}</strong><b>{nom} : {lecture.point.valeur.toLocaleString('fr-FR',{maximumFractionDigits:20})}</b><button type="button" aria-label="Fermer le détail du relevé" onClick={()=>setLecture(null)}>×</button></div>}
      <div className="water-chart-legend">{donnees.series.map(s=><span key={s.id}><i style={{background:s.couleur}}/>{s.name}</span>)}</div>
      <div className="water-basin-summary">{donnees.series.map(serie=><article key={serie.id} style={{borderColor:serie.couleur+'40',background:serie.couleur+'06'}}><strong style={{color:serie.couleur}}><span className="water-icon-bubble"><IconeEau nom="bassin"/></span>{serie.name}</strong>{serie.points.length?<><span>{serie.points.length} relevé(s) · min {nombre(Math.min(...serie.points.map(p=>p.valeur)))} · max {nombre(Math.max(...serie.points.map(p=>p.valeur)))}</span><b className="water-summary-last"><small>Dernier relevé</small>{nombre(serie.points.at(-1)!.valeur)} à {heure(serie.points.at(-1)!.instant)}</b></>:<span>Aucun relevé exploitable</span>}</article>)}</div>

    </>}
    </div></div>
    {!!donnees?.releves.length&&<details open className="water-readings"><summary>Relevés de la période ({donnees.releves.length})</summary><div className="aquaponie-table-wrap"><table><thead><tr><th>Date / heure</th><th>Bassin</th><th>Temp. (°C)</th><th>pH</th><th>EC</th>{(onModifier||onSupprimer)&&<th>Actions</th>}</tr></thead><tbody>{[...donnees.releves].sort((a,b)=>b.date.localeCompare(a.date)||(b.heure||'').localeCompare(a.heure||'')||a.bassin.localeCompare(b.bassin)).map(p=><tr key={p.id}><td>{p.date.split('-').reverse().join('/')} {p.heure?.slice(0,5)||'—'}</td><td><span className="water-table-dot" style={{background:donnees.series.find(s=>s.name===p.bassin)?.couleur}}/>{p.bassin}</td>{(['temperature_c','ph','conductivity'] as const).map(cle=>{const valeur=mesuresParId.get(p.id)?.[cle];return <td key={cle}>{valeur==null?'—':nombre(Number(valeur))}</td>;})}{(onModifier||onSupprimer)&&<td><div className="water-reading-actions">{onModifier&&<button type="button" onClick={()=>onModifier(p.id)} aria-label={`Modifier le relevé du ${p.date} ${p.heure||''} du bassin ${p.bassin}`}><IconeEau nom="modifier"/></button>}{onSupprimer&&<button type="button" className="water-delete-reading" onClick={()=>onSupprimer(p.id)} aria-label={`Supprimer le relevé du ${p.date} du bassin ${p.bassin}`}><IconeEau nom="supprimer"/></button>}</div></td>}</tr>)}</tbody></table></div></details>}
  </section>;
}
