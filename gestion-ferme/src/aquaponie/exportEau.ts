import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nomRapportEau, type RapportEau } from './rapportEau.ts';
const note = 'Heures de Martinique. Les heures inconnues et valeurs manquantes sont conservées dans les tableaux. EC : unité des saisies, sans conversion. Ajouts : bassins sélectionnés, circuit complet et cuves. Les ajouts en cuve sont des événements sans attribution à un bassin.';
const unite = (u: string) => u === 'unite' ? 'unité(s)' : u;
export function construireClasseurEau(r: RapportEau, graphique?:string) {
  const book = new ExcelJS.Workbook();
  const feuille=book.addWorksheet('Graphique et relevés');
  feuille.columns=[{width:32},{width:18},{width:25},{width:20},{width:20},{width:20},{width:20}];
  feuille.getCell('A1').value=`Aquaponie - évolution ${r.metrique}`;
  feuille.getCell('A2').value=`${r.periode} - du ${r.debut} au ${r.fin} inclus - heures de Martinique`;
  feuille.getCell('A3').value=`Bassins : ${r.bassins.join(', ')}`;
  for(const n of [1,2,3])feuille.mergeCells(`A${n}:G${n}`);
  if(graphique){const id=book.addImage({base64:graphique,extension:'png'});feuille.addImage(id,'A5:G30');}
  else feuille.getCell('A5').value='Graphique indisponible';
  feuille.getCell('A32').value='Tableau des relevés';
  feuille.getRow(33).values=['Bassin','Date','Heure (Martinique)',r.metrique];
  r.releves.forEach(p=>feuille.addRow([p.bassin,p.date,p.heure||'Non renseignée',p.valeur]));
  feuille.autoFilter={from:'A33',to:`D${33+r.releves.length}`};
  feuille.getRow(33).font={bold:true};feuille.views=[{state:'normal'}];
  const produits=book.addWorksheet('Ajouts produits');
  produits.columns=[{width:18},{width:24},{width:32},{width:32},{width:16},{width:12},{width:60}];
  produits.addRow(['Date','Heure (Martinique)','Destination','Produit','Quantité','Unité','Observation']);
  r.ajouts.forEach(a=>produits.addRow([a.addition_date,a.addition_time,a.target_label,a.product_name,Number(a.quantity),unite(a.unit),a.notes||'']));
  produits.getRow(1).font={bold:true};
  const filtres=book.addWorksheet('Filtres');filtres.columns=[{width:26},{width:100}];
  filtres.addRows([['Paramètre',r.metrique],['Période',r.periode],['Du',r.debut],['Au (inclus)',r.fin],['Bassins',r.bassins.join(', ')],['Précisions',note]]);
  return book;
}
export async function exporterEauExcel(r:RapportEau,graphique:string) {
  const buffer=await construireClasseurEau(r,graphique).xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const lien=document.createElement('a');lien.href=url;lien.download=`${nomRapportEau(r)}.xlsx`;document.body.appendChild(lien);lien.click();lien.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function construirePdfEau(r: RapportEau, graphique?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(17); doc.text(`Aquaponie - relevés ${r.metrique}`, 14, 17);
  doc.setFontSize(10); doc.text(`${r.periode} - du ${r.debut} au ${r.fin} inclus - heures de Martinique`, 14, 25);
  const bassins = doc.splitTextToSize(`Bassins : ${r.bassins.join(', ')}`, 267) as string[];
  doc.text(bassins, 14, 32);
  if(graphique){const image=doc.getImageProperties(graphique);const echelle=Math.min(267/image.width,148/image.height);doc.addImage(graphique,'PNG',14,38,image.width*echelle,image.height*echelle,undefined,'FAST');doc.addPage();doc.setFontSize(16);doc.text('Tableau des relevés',14,17);}
  autoTable(doc, { startY: graphique?24:35 + bassins.length * 4, head: [['Bassin', 'Date', 'Heure (Martinique)', r.metrique]], body: r.releves.length ? r.releves.map(p => [p.bassin, p.date, p.heure || 'Non renseignée', p.valeur === null ? 'Non renseignée' : p.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 20 })]) : [['Aucun relevé pour ces filtres', '', '', '']], styles: { fontSize: 9, overflow: 'linebreak' }, margin: { bottom: 16 }, headStyles: { fillColor: [22, 132, 60] } });
  doc.addPage(); doc.setFontSize(16); doc.text('Ajouts de produits', 14, 17);
  autoTable(doc, { startY: 24, head: [['Date', 'Heure', 'Destination', 'Produit', 'Quantité', 'Unité', 'Observation']], body: r.ajouts.length ? r.ajouts.map(a => [a.addition_date, a.addition_time, a.target_label, a.product_name, Number(a.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 20 }), unite(a.unit), a.notes || '']) : [['Aucun ajout pour ces filtres', '', '', '', '', '', '']], styles: { fontSize: 9, overflow: 'linebreak' }, margin: { bottom: 16 }, headStyles: { fillColor: [180, 83, 9] } });
  doc.addPage(); doc.setFontSize(14); doc.text('Filtres et précisions', 14, 17); doc.setFontSize(10); doc.text(doc.splitTextToSize(`${r.metrique} - ${r.periode} - du ${r.debut} au ${r.fin} inclus\nBassins : ${r.bassins.join(', ')}\n${r.releves.length} relevé(s), ${r.ajouts.length} ajout(s)\n\n${note}`, 267), 14, 27);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`${r.metrique} - ${r.debut} / ${r.fin} | ${i} / ${total}`, 14, 202); }
  return doc;
}
export function exporterEauPdf(r: RapportEau,graphique:string) { construirePdfEau(r,graphique).save(`${nomRapportEau(r)}.pdf`); }
