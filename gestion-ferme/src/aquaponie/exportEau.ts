import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nomRapportEau, type RapportEau } from './rapportEau.ts';
const note = 'Heures de Martinique. Les heures inconnues et valeurs manquantes sont conservées dans les tableaux. EC : unité des saisies, sans conversion. Ajouts : bassins sélectionnés et circuit complet ; cuves exclues.';
const unite = (u: string) => u === 'unite' ? 'unité(s)' : u;
export function construireClasseurEau(r: RapportEau) {
  const book = XLSX.utils.book_new();
  const ajouter = (nom: string, lignes: (string | number | null)[][], largeurs: number[]) => {
    const feuille = XLSX.utils.aoa_to_sheet(lignes);
    feuille['!cols'] = largeurs.map(wch => ({ wch }));
    if (nom !== 'Filtres' && lignes.length > 1) feuille['!autofilter'] = { ref: feuille['!ref']! };
    XLSX.utils.book_append_sheet(book, feuille, nom);
  };
  ajouter('Filtres', [['Paramètre', r.metrique], ['Période', r.periode], ['Du', r.debut], ['Au (inclus)', r.fin], ['Bassins', r.bassins.join(', ')], ['Relevés', r.releves.length], ['Ajouts de produits', r.ajouts.length], ['Précisions', note]], [26, 100]);
  ajouter('Relevés', [['Bassin', 'Date', 'Heure (Martinique)', r.metrique], ...r.releves.map(p => [p.bassin, p.date, p.heure || 'Non renseignée', p.valeur])], [32, 16, 24, 20]);
  ajouter('Ajouts produits', [['Date', 'Heure (Martinique)', 'Destination', 'Produit', 'Quantité', 'Unité', 'Observation'], ...r.ajouts.map(a => [a.addition_date, a.addition_time, a.target_label, a.product_name, Number(a.quantity), unite(a.unit), a.notes || ''])], [16, 24, 32, 32, 16, 12, 60]);
  return book;
}
export function exporterEauExcel(r: RapportEau) {
  XLSX.writeFile(construireClasseurEau(r), `${nomRapportEau(r)}.xlsx`);
}
export function construirePdfEau(r: RapportEau) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(17); doc.text(`Aquaponie - relevés ${r.metrique}`, 14, 17);
  doc.setFontSize(10); doc.text(`${r.periode} - du ${r.debut} au ${r.fin} inclus - heures de Martinique`, 14, 25);
  const bassins = doc.splitTextToSize(`Bassins : ${r.bassins.join(', ')}`, 267) as string[];
  doc.text(bassins, 14, 32);
  autoTable(doc, { startY: 35 + bassins.length * 4, head: [['Bassin', 'Date', 'Heure (Martinique)', r.metrique]], body: r.releves.length ? r.releves.map(p => [p.bassin, p.date, p.heure || 'Non renseignée', p.valeur === null ? 'Non renseignée' : p.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 20 })]) : [['Aucun relevé pour ces filtres', '', '', '']], styles: { fontSize: 9, overflow: 'linebreak' }, margin: { bottom: 16 }, headStyles: { fillColor: [22, 132, 60] } });
  doc.addPage(); doc.setFontSize(16); doc.text('Ajouts de produits', 14, 17);
  autoTable(doc, { startY: 24, head: [['Date', 'Heure', 'Destination', 'Produit', 'Quantité', 'Unité', 'Observation']], body: r.ajouts.length ? r.ajouts.map(a => [a.addition_date, a.addition_time, a.target_label, a.product_name, Number(a.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 20 }), unite(a.unit), a.notes || '']) : [['Aucun ajout pour ces filtres', '', '', '', '', '', '']], styles: { fontSize: 9, overflow: 'linebreak' }, margin: { bottom: 16 }, headStyles: { fillColor: [180, 83, 9] } });
  doc.addPage(); doc.setFontSize(14); doc.text('Filtres et précisions', 14, 17); doc.setFontSize(10); doc.text(doc.splitTextToSize(`${r.metrique} - ${r.periode} - du ${r.debut} au ${r.fin} inclus\nBassins : ${r.bassins.join(', ')}\n${r.releves.length} relevé(s), ${r.ajouts.length} ajout(s)\n\n${note}`, 267), 14, 27);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`${r.metrique} - ${r.debut} / ${r.fin} | ${i} / ${total}`, 14, 202); }
  return doc;
}
export function exporterEauPdf(r: RapportEau) { construirePdfEau(r).save(`${nomRapportEau(r)}.pdf`); }
