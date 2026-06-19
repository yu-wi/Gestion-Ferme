import * as XLSX from 'xlsx';
import type {
  LivraisonVolaille,
  MortaliteVolaille,
} from '../volailles/volaillesData';

type LotExportable = {
  nom: string;
  quantite: number;
  dateArrivee: string;
  batiment: string;
  mortalites?: MortaliteVolaille[];
  livraisons?: LivraisonVolaille[];
  autoconsommation?: number;
  resultat_brut?: number;
};

const ajouterMiseEnForme = (
  feuille: XLSX.WorkSheet,
  largeurs: number[],
  derniereColonne: string,
  derniereLigne: number
) => {
  feuille['!cols'] = largeurs.map((wch) => ({ wch }));
  if (derniereLigne > 1) {
    feuille['!autofilter'] = { ref: `A1:${derniereColonne}${derniereLigne}` };
  }
};

function creerFeuille<T extends object>(
  donnees: T[],
  entetes: string[]
) {
  if (donnees.length === 0) {
    return XLSX.utils.aoa_to_sheet([entetes]);
  }

  return XLSX.utils.json_to_sheet(donnees, { header: entetes });
}

export const exportToExcel = (lots: LotExportable[]) => {
  const synthese = lots.map((lot) => {
    const mortalites = lot.mortalites || [];
    const livraisons = lot.livraisons || [];
    const totalMortalites = mortalites.reduce(
      (total, mortalite) => total + (Number(mortalite.nombre) || 0),
      0
    );
    const quantiteLivree = livraisons.reduce(
      (total, livraison) => total + (Number(livraison.quantite) || 0),
      0
    );
    const poidsLivre = livraisons.reduce(
      (total, livraison) => total + (Number(livraison.poids) || 0),
      0
    );
    const autoconsommation = Number(lot.autoconsommation) || 0;

    return {
      Lot: lot.nom,
      Bâtiment: lot.batiment,
      'Date arrivée': lot.dateArrivee,
      'Quantité initiale': Number(lot.quantite) || 0,
      'Mortalité totale': totalMortalites,
      'Taux mortalité (%)':
        lot.quantite > 0 ? Number(((totalMortalites / lot.quantite) * 100).toFixed(2)) : 0,
      Autoconsommation: autoconsommation,
      'Sujets restants':
        (Number(lot.quantite) || 0) - totalMortalites - autoconsommation,
      'Nombre de livraisons': livraisons.length,
      'Quantité livrée': quantiteLivree,
      'Poids livré (kg)': Number(poidsLivre.toFixed(2)),
      'Résultat brut (€)': Number(lot.resultat_brut) || 0,
    };
  });

  const detailMortalites = lots.flatMap((lot) =>
    (lot.mortalites || []).map((mortalite) => ({
      Lot: lot.nom,
      Bâtiment: lot.batiment,
      Date: mortalite.date,
      Nombre: Number(mortalite.nombre) || 0,
    }))
  );

  const detailLivraisons = lots.flatMap((lot) =>
    (lot.livraisons || []).map((livraison) => ({
      Lot: lot.nom,
      Bâtiment: lot.batiment,
      Date: livraison.date,
      Quantité: Number(livraison.quantite) || 0,
      'Poids (kg)': Number(Number(livraison.poids).toFixed(2)) || 0,
    }))
  );

  const feuilleSynthese = creerFeuille(synthese, [
    'Lot',
    'Bâtiment',
    'Date arrivée',
    'Quantité initiale',
    'Mortalité totale',
    'Taux mortalité (%)',
    'Autoconsommation',
    'Sujets restants',
    'Nombre de livraisons',
    'Quantité livrée',
    'Poids livré (kg)',
    'Résultat brut (€)',
  ]);
  const feuilleMortalites = creerFeuille(detailMortalites, [
    'Lot',
    'Bâtiment',
    'Date',
    'Nombre',
  ]);
  const feuilleLivraisons = creerFeuille(detailLivraisons, [
    'Lot',
    'Bâtiment',
    'Date',
    'Quantité',
    'Poids (kg)',
  ]);

  ajouterMiseEnForme(
    feuilleSynthese,
    [18, 14, 14, 17, 17, 19, 18, 16, 20, 17, 18, 18],
    'L',
    synthese.length + 1
  );
  ajouterMiseEnForme(
    feuilleMortalites,
    [18, 14, 14, 12],
    'D',
    detailMortalites.length + 1
  );
  ajouterMiseEnForme(
    feuilleLivraisons,
    [18, 14, 14, 14, 14],
    'E',
    detailLivraisons.length + 1
  );

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'Gestion des volailles',
    Subject: 'Synthèse des lots, mortalités et livraisons',
    Author: 'Gestion Ferme',
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, feuilleSynthese, 'Synthèse');
  XLSX.utils.book_append_sheet(workbook, feuilleMortalites, 'Mortalités');
  XLSX.utils.book_append_sheet(workbook, feuilleLivraisons, 'Livraisons');

  const dateExport = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `volailles_${dateExport}.xlsx`);
};
