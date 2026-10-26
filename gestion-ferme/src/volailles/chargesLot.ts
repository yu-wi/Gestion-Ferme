import { appliquerCoutAliment } from "./coutAliment.ts";
import { completerChargesLivraisons, type TarifsCharges } from "./tarifsCharges.ts";

// Source commune de l'historique SICA et de l'analyse complète du lot.
export function calculerChargesLot(
  charges: { type_charge: string; montant: number }[],
  livraisons: { quantite: number }[],
  coutAliment: number | null,
  tarifs: TarifsCharges,
) {
  return appliquerCoutAliment(completerChargesLivraisons(charges, livraisons, tarifs), coutAliment);
}
