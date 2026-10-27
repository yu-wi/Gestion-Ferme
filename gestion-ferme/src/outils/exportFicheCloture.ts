import * as XLSX from 'xlsx';
import { nomFichierFiche, type FicheCloture } from '../volailles/ficheCloture.ts';

export function construireClasseurFiche(fiche:FicheCloture) {
  const book=XLSX.utils.book_new();
  const ajouter=(nom:string, lignes:(string|number|null)[][], largeurs:number[])=>{
    const sheet=XLSX.utils.aoa_to_sheet(lignes);
    sheet['!cols']=largeurs.map(wch=>({wch}));
    XLSX.utils.book_append_sheet(book,sheet,nom);
  };
  book.Props={Title:`Fiche de clôture – Lot ${fiche.lot.nom}`,Author:'La Ferme de Bernard',CreatedDate:new Date(fiche.date)};
  ajouter('Synthèse',[
    ['Information','Valeur'],['Lot',fiche.lot.nom],['Bâtiment',fiche.lot.batiment],['Arrivée',fiche.lot.date_arrivee],
    ['Données établies le (Martinique)',new Date(fiche.date).toLocaleString('fr-FR',{timeZone:'America/Martinique'})],
    ['Statut',fiche.statut],['Points à compléter',fiche.raisons.join(' ; ') || 'Aucun'],
    ['Tarifs',fiche.gel ? `Figés le ${fiche.gel.date} (${fiche.gel.origine})` : 'Prix actuels non figés'],
    ['Recettes (€)',fiche.recettes],['Total charges (€)',fiche.totalCharges],['Marge nette (€)',fiche.marge],['Taux de marge (%)',fiche.tauxMarge],
    ['Note','Les montants saisis sont repris sans conversion. Les charges calculées incluent leur TVA.'],
  ],[38,95]);
  ajouter('Production',[
    ['Indicateur','Valeur','Unité'],['Quantité initiale',fiche.lot.quantite,'sujets'],['Sujets livrés',fiche.livres,'sujets'],
    ['Mortalités',fiche.lot.nb_morts,'sujets'],['Taux de mortalité',fiche.mortalite,'%'],['Autoconsommation',fiche.lot.autoconsommation,'sujets'],
    ['Quantité retenue',fiche.lot.quantite_retenue,'sujets'],['Sujets restants',fiche.lot.sujets_restants,'sujets'],
    ['Poids livré',fiche.poids,'kg'],['Poids moyen livré',fiche.poidsMoyen,'kg/sujet'],['Nombre de livraisons',fiche.lot.livraisons.length,''],
    ['Âge à la clôture',fiche.lot.age,'jours'],['Aliment consommé saisi',fiche.consommationKg,'kg'],
  ],[32,22,18]);
  ajouter('Charges',[
    ['Catégorie','Montant (€)','Statut'],...fiche.charges.map(c=>[c.label,c.montant,c.statut]),['Total',fiche.totalCharges,fiche.statut],
  ],[30,22,38]);
  ajouter('Livraisons',[
    ['Date','Sujets livrés','Poids (kg)','Poids moyen (kg)'],
    ...fiche.lot.livraisons.map(l=>[l.date,l.quantite,l.poids,l.quantite>0 ? l.poids/l.quantite : null]),
  ],[18,20,20,24]);
  ajouter('Mortalités',[
    ['Date','Nombre'],...fiche.lot.mortalites.map(m=>[m.date,m.nombre]),
  ],[18,20]);
  ajouter('Consommations',[
    ['Date','Aliment','Quantité (kg)'],...fiche.consommations.map(c=>[c.date,c.feed_type,c.quantite_kg]),
  ],[18,30,24]);
  ajouter('Tarifs',[
    ['Tarif utilisé','Valeur','Unité'],
    ['Ramassage HT',Number(fiche.tarifs.poultry_collection_price_ht),'€/sujet'],['TVA ramassage',Number(fiche.tarifs.poultry_collection_vat),'%'],
    ['Transport HT',Number(fiche.tarifs.poultry_transport_price_ht),'€/livraison'],['TVA transport',Number(fiche.tarifs.poultry_transport_vat),'%'],['TVA aliment',fiche.tvaAliment*100,'%'],
    ...fiche.references.map(r=>[`Sac de 25 kg – ${r.feed_type}`,r.feed_price_ht,'€ HT']),
  ],[40,22,22]);
  for(const nom of ['Charges','Livraisons','Mortalités','Consommations']) {
    const sheet=book.Sheets[nom]; if(sheet['!ref']) {
      const plage=XLSX.utils.decode_range(sheet['!ref']);
      if(nom==='Charges' && plage.e.r>0) plage.e.r-=1;
      sheet['!autofilter']={ref:XLSX.utils.encode_range(plage)};
    }
  }
  for(const [nom,colonne] of [['Charges','B'],['Livraisons','C'],['Livraisons','D'],['Consommations','C']]) {
    const sheet=book.Sheets[nom];
    const fin=XLSX.utils.decode_range(sheet['!ref'] || 'A1').e.r+1;
    for(let row=2;row<=fin;row++){const cell=sheet[`${colonne}${row}`];if(cell?.t==='n')cell.z='#,##0.00';}
  }
  for(const row of [9,10,11,12]) { const cell=book.Sheets['Synthèse'][`B${row}`];if(cell?.t==='n')cell.z='#,##0.00'; }
  book.Sheets['Tarifs'].B2.z='0.0000';
  return book;
}
export function exporterFicheExcel(fiche:FicheCloture) {
  XLSX.writeFile(construireClasseurFiche(fiche),`${nomFichierFiche(fiche)}.xlsx`);
}
