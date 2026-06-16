import * as XLSX from 'xlsx';

export const exportToExcel = (lots: any[]) => {
  const data = lots.map(lot => ({
    Nom: lot.nom,
    Quantité: lot.quantite,
    'Date Arrivée': lot.dateArrivee,
    Bâtiment: lot.batiment,
    'Mortalité Totale': lot.mortalites.reduce((sum: number, m: any) => sum + m.nombre, 0),
    'Sujets Restants': lot.quantite - lot.mortalites.reduce((sum: number, m: any) => sum + m.nombre, 0),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lots');

  XLSX.writeFile(workbook, 'lots_volailles.xlsx');
};
