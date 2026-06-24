import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import ModalCloseButton from "../components/ModalCloseButton";
import { formatDateCourte } from "../outils/formatNombre";

type Lot = {
  id: string;
  nom: string;
  quantite: number;
  sujets_restants: number;
  date_arrivee: string;
  source: "sica" | "vente_directe";
};

type FeedReference = {
  id: string;
  feed_type: string;
  daily_consumption_g: number;
  age_min_days: number;
  age_max_days: number;
  feed_price_ht?: number;
};

type Consommation = {
  id: string;
  lot_id: string | null;
  direct_sale_lot_id: string | null;
  source_type: "sica" | "vente_directe";
  date: string;
  feed_type: string;
  quantite_kg: number;
  note?: string | null;
};

type LivraisonStock = {
  id: string;
  date: string;
  feed_type: string;
  quantite_kg: number;
  fournisseur?: string | null;
  prix_total_ht?: number | null;
  note?: string | null;
};

type StockRow = {
  feedType: string;
  entrees: number;
  consommations: number;
  stock: number;
};

type PrevisionRow = {
  feedType: string;
  besoinSacs: number;
  stockSacs: number;
  aCommanderSacs: number;
};

const POIDS_SAC_KG = 25;
const PREVISION_JOURS = 7;
const HORIZON_AUTONOMIE_JOURS = 180;
const DELAI_COMMANDE_JOURS = 3;
const ORDRE_ALIMENTS = ["starter", "croissance", "finition"];
const enSacs = (quantiteKg: number) => quantiteKg / POIDS_SAC_KG;
const sacsEntiers = (quantiteSacs: number) =>
  Math.max(0, Math.round(quantiteSacs));
const normaliserAliment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
const comparerAliments = (a: string, b: string) => {
  const indexA = ORDRE_ALIMENTS.indexOf(normaliserAliment(a));
  const indexB = ORDRE_ALIMENTS.indexOf(normaliserAliment(b));
  const rangA = indexA === -1 ? ORDRE_ALIMENTS.length : indexA;
  const rangB = indexB === -1 ? ORDRE_ALIMENTS.length : indexB;
  return rangA - rangB || a.localeCompare(b, "fr");
};
const aujourdHui = () => {
  const date = new Date();
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
};

const ageEntreDates = (dateArrivee: string, dateCible: string) => {
  const arrivee = new Date(`${dateArrivee}T00:00:00`);
  const cible = new Date(`${dateCible}T00:00:00`);
  return Math.floor((cible.getTime() - arrivee.getTime()) / 86400000);
};

const ageAuJour = (dateArrivee: string, decalageJours = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + decalageJours);
  const dateCible = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return Math.max(0, ageEntreDates(dateArrivee, dateCible));
};

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");

export default function DashboardFeed() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [references, setReferences] = useState<FeedReference[]>([]);
  const [consommations, setConsommations] = useState<Consommation[]>([]);
  const [livraisons, setLivraisons] = useState<LivraisonStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [directConsumptionReady, setDirectConsumptionReady] = useState(true);
  const [consommationModalOpen, setConsommationModalOpen] = useState(false);
  const [livraisonModalOpen, setLivraisonModalOpen] = useState(false);
  const [referencesInfoOpen, setReferencesInfoOpen] = useState(false);
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [referenceEnModification, setReferenceEnModification] =
    useState<FeedReference | null>(null);
  const [referenceType, setReferenceType] = useState("");
  const [referenceAgeMin, setReferenceAgeMin] = useState("");
  const [referenceAgeMax, setReferenceAgeMax] = useState("");
  const [referenceConso, setReferenceConso] = useState("");
  const [referencePrix, setReferencePrix] = useState("");

  const [consommationLotId, setConsommationLotId] = useState("");
  const [consommationDate, setConsommationDate] = useState(aujourdHui());
  const [consommationType, setConsommationType] = useState("");
  const [consommationSacs, setConsommationSacs] = useState("");
  const [consommationNote, setConsommationNote] = useState("");
  const [consommationEnModification, setConsommationEnModification] =
    useState<Consommation | null>(null);

  const [livraisonDate, setLivraisonDate] = useState(aujourdHui());
  const [livraisonType, setLivraisonType] = useState("");
  const [livraisonSacs, setLivraisonSacs] = useState("");
  const [livraisonFournisseur, setLivraisonFournisseur] = useState("");
  const [livraisonPrix, setLivraisonPrix] = useState("");
  const [livraisonEnModification, setLivraisonEnModification] =
    useState<LivraisonStock | null>(null);

  const chargerDonnees = async () => {
    const [lotsResult, directLotsResult, refsResult, livraisonsResult] =
      await Promise.all([
        supabase
          .from("lots_volailles")
          .select("id, nom, quantite, sujets_restants, date_arrivee")
          .eq("is_active", true)
          .order("nom"),
        supabase
          .from("direct_sale_lots")
          .select(
            "id, name, initial_quantity, remaining_quantity, arrival_date"
          )
          .neq("status", "termine")
          .order("name"),
        supabase
          .from("feed_reference")
          .select(
            "id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht"
          )
          .order("age_min_days"),
        supabase
          .from("livraisons_aliment")
          .select(
            "id, date, feed_type, quantite_kg, fournisseur, prix_total_ht, note"
          )
          .order("date", { ascending: false }),
      ]);

    const consommationsEtendues = await supabase
      .from("consommations_aliment")
      .select(
        "id, lot_id, direct_sale_lot_id, source_type, date, feed_type, quantite_kg, note"
      )
      .order("date", { ascending: false });

    let consommationEtendueDisponible = true;
    let consommationError = consommationsEtendues.error;
    let consommationRows = (consommationsEtendues.data || []) as unknown as Array<
      Record<string, unknown>
    >;
    if (consommationsEtendues.error) {
      const ancienResultat = await supabase
        .from("consommations_aliment")
        .select("id, lot_id, date, feed_type, quantite_kg, note")
        .order("date", { ascending: false });
      if (!ancienResultat.error) {
        consommationEtendueDisponible = false;
        consommationError = null;
        consommationRows = (ancienResultat.data || []) as unknown as Array<
          Record<string, unknown>
        >;
      } else {
        consommationError = ancienResultat.error;
      }
    }
    setDirectConsumptionReady(consommationEtendueDisponible);

    const error =
      lotsResult.error ||
      directLotsResult.error ||
      refsResult.error ||
      consommationError ||
      livraisonsResult.error;

    if (error) {
      console.error("Erreur chargement alimentation:", error);
      toast.error("Le suivi d'alimentation n'a pas pu être chargé.");
    } else {
      const lotsSica = (lotsResult.data || []).map((lot) => ({
        ...lot,
        source: "sica" as const,
      }));
      const lotsVenteDirecte = (directLotsResult.data || []).map((lot) => ({
        id: lot.id,
        nom: lot.name,
        quantite: Number(lot.initial_quantity) || 0,
        sujets_restants: Number(lot.remaining_quantity) || 0,
        date_arrivee: lot.arrival_date,
        source: "vente_directe" as const,
      }));
      setLots([...lotsSica, ...lotsVenteDirecte] as Lot[]);
      setReferences(
        (refsResult.data || []).map((item) => ({
          ...item,
          daily_consumption_g: Number(item.daily_consumption_g) || 0,
          age_min_days: Number(item.age_min_days) || 0,
          age_max_days: Number(item.age_max_days) || 0,
          feed_price_ht: Number(item.feed_price_ht) || 0,
        })) as FeedReference[]
      );
      setConsommations(
        consommationRows.map((item) => ({
          id: String(item.id || ""),
          lot_id: item.lot_id ? String(item.lot_id) : null,
          direct_sale_lot_id: item.direct_sale_lot_id
            ? String(item.direct_sale_lot_id)
            : null,
          source_type:
            consommationEtendueDisponible &&
            item.source_type === "vente_directe"
              ? "vente_directe"
              : "sica",
          date: String(item.date || ""),
          feed_type: String(item.feed_type || ""),
          quantite_kg: Number(item.quantite_kg) || 0,
          note: item.note == null ? null : String(item.note),
        })) as Consommation[]
      );
      setLivraisons(
        (livraisonsResult.data || []).map((item) => ({
          ...item,
          quantite_kg: Number(item.quantite_kg) || 0,
          prix_total_ht:
            item.prix_total_ht == null ? null : Number(item.prix_total_ht) || 0,
        })) as LivraisonStock[]
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const typesAliment = useMemo(
    () =>
      Array.from(
        new Set([
          ...references.map((item) => item.feed_type),
          ...consommations.map((item) => item.feed_type),
          ...livraisons.map((item) => item.feed_type),
        ])
      ).sort(comparerAliments),
    [references, consommations, livraisons]
  );

  useEffect(() => {
    if (!consommationType && typesAliment.length) {
      setConsommationType(typesAliment[0]);
    }
    if (!livraisonType && typesAliment.length) {
      setLivraisonType(typesAliment[0]);
    }
  }, [typesAliment, consommationType, livraisonType]);

  const lotConsommationSelectionne = useMemo(
    () =>
      lots.find(
        (lot) => `${lot.source}:${lot.id}` === consommationLotId
      ) || null,
    [lots, consommationLotId]
  );

  const suggestionConsommation = useMemo(() => {
    if (!lotConsommationSelectionne || !consommationDate) return null;

    const age = ageEntreDates(
      lotConsommationSelectionne.date_arrivee,
      consommationDate
    );
    if (age < 0) return null;

    const reference = references.find(
      (item) => age >= item.age_min_days && age <= item.age_max_days
    );
    if (!reference) return null;

    const sujets =
      lotConsommationSelectionne.sujets_restants == null
        ? Number(lotConsommationSelectionne.quantite) || 0
        : Number(lotConsommationSelectionne.sujets_restants) || 0;
    const sacs =
      (reference.daily_consumption_g * sujets) /
      1000 /
      POIDS_SAC_KG;

    return { age, reference, sujets, sacs };
  }, [lotConsommationSelectionne, consommationDate, references]);

  useEffect(() => {
    if (suggestionConsommation && !consommationEnModification) {
      setConsommationType(suggestionConsommation.reference.feed_type);
    }
  }, [suggestionConsommation, consommationEnModification]);

  const stock = useMemo<StockRow[]>(
    () =>
      typesAliment.map((feedType) => {
        const entrees = livraisons
          .filter((item) => item.feed_type === feedType)
          .reduce((total, item) => total + item.quantite_kg, 0);
        const sorties = consommations
          .filter((item) => item.feed_type === feedType)
          .reduce((total, item) => total + item.quantite_kg, 0);
        return {
          feedType,
          entrees,
          consommations: sorties,
          stock: entrees - sorties,
        };
      }),
    [typesAliment, livraisons, consommations]
  );

  const prevision = useMemo<PrevisionRow[]>(() => {
    const besoins = new Map<string, number>();

    lots.forEach((lot) => {
      const sujets =
        lot.sujets_restants == null
          ? Number(lot.quantite) || 0
          : Number(lot.sujets_restants) || 0;
      if (sujets <= 0) return;

      for (let jour = 0; jour < PREVISION_JOURS; jour += 1) {
        const age = ageAuJour(lot.date_arrivee, jour);
        const reference = references.find(
          (item) => age >= item.age_min_days && age <= item.age_max_days
        );
        if (!reference) continue;
        const besoin = (reference.daily_consumption_g * sujets) / 1000;
        besoins.set(
          reference.feed_type,
          (besoins.get(reference.feed_type) || 0) + besoin
        );
      }
    });

    return Array.from(
      new Set([...typesAliment, ...Array.from(besoins.keys())])
    )
      .map((feedType) => {
        const besoinSacs = enSacs(besoins.get(feedType) || 0);
        const stockSacs = enSacs(
          stock.find((item) => item.feedType === feedType)?.stock || 0
        );
        const aCommanderSacs = Math.ceil(
          Math.max(0, besoinSacs - stockSacs)
        );
        return {
          feedType,
          besoinSacs,
          stockSacs,
          aCommanderSacs,
        };
      })
      .filter((item) => item.besoinSacs > 0 || item.stockSacs !== 0)
      .sort((a, b) => comparerAliments(a.feedType, b.feedType));
  }, [lots, references, stock, typesAliment]);

  const autonomieStock = useMemo(() => {
    const stockRestant = new Map(
      stock.map((item) => [item.feedType, Math.max(0, item.stock)])
    );
    let consommationTrouvee = false;

    for (let jour = 0; jour <= HORIZON_AUTONOMIE_JOURS; jour += 1) {
      const besoinsDuJour = new Map<string, number>();

      lots.forEach((lot) => {
        const sujets =
          lot.sujets_restants == null
            ? Number(lot.quantite) || 0
            : Number(lot.sujets_restants) || 0;
        if (sujets <= 0) return;

        const age = ageAuJour(lot.date_arrivee, jour);
        const reference = references.find(
          (item) => age >= item.age_min_days && age <= item.age_max_days
        );
        if (!reference) return;

        consommationTrouvee = true;
        const besoinKg = (reference.daily_consumption_g * sujets) / 1000;
        besoinsDuJour.set(
          reference.feed_type,
          (besoinsDuJour.get(reference.feed_type) || 0) + besoinKg
        );
      });

      for (const [feedType, besoinKg] of besoinsDuJour) {
        const disponibleKg = stockRestant.get(feedType) || 0;
        if (disponibleKg < besoinKg) {
          const dateRupture = new Date();
          dateRupture.setHours(0, 0, 0, 0);
          dateRupture.setDate(dateRupture.getDate() + jour);
          const dateFinStock = new Date(dateRupture);
          if (jour > 0) dateFinStock.setDate(dateFinStock.getDate() - 1);

          const dateCommande = new Date(dateRupture);
          dateCommande.setDate(dateCommande.getDate() - DELAI_COMMANDE_JOURS);
          const maintenant = new Date();
          maintenant.setHours(0, 0, 0, 0);
          if (dateCommande < maintenant) dateCommande.setTime(maintenant.getTime());

          return { dateRupture, dateFinStock, dateCommande, feedType };
        }
        stockRestant.set(feedType, disponibleKg - besoinKg);
      }
    }

    return consommationTrouvee
      ? { dateRupture: null, dateFinStock: null, dateCommande: null, feedType: "" }
      : null;
  }, [lots, references, stock]);

  const joursSansReference = useMemo(() => {
    let total = 0;
    lots.forEach((lot) => {
      const sujets =
        lot.sujets_restants == null
          ? Number(lot.quantite) || 0
          : Number(lot.sujets_restants) || 0;
      if (sujets <= 0) return;
      for (let jour = 0; jour < PREVISION_JOURS; jour += 1) {
        const age = ageAuJour(lot.date_arrivee, jour);
        if (
          !references.some(
            (item) => age >= item.age_min_days && age <= item.age_max_days
          )
        ) {
          total += 1;
        }
      }
    });
    return total;
  }, [lots, references]);

  const enregistrerConsommation = async () => {
    const nombreSacs = Number(consommationSacs);
    if (
      saving ||
      !consommationLotId ||
      !consommationDate ||
      !consommationType ||
      !Number.isFinite(nombreSacs) ||
      nombreSacs <= 0
    ) {
      toast.error("Complétez le lot, la date, l'aliment et la quantité.");
      return;
    }
    if (
      lotConsommationSelectionne?.source === "vente_directe" &&
      !directConsumptionReady
    ) {
      toast.error(
        "La mise à jour Supabase pour les lots Vente directe doit être appliquée."
      );
      return;
    }

    setSaving(true);
    const valeursCommunes = {
      date: consommationDate,
      feed_type: consommationType,
      quantite_kg: nombreSacs * POIDS_SAC_KG,
      note: consommationNote.trim() || null,
    };
    const valeurs = directConsumptionReady ? {
      lot_id:
        lotConsommationSelectionne?.source === "sica"
          ? lotConsommationSelectionne.id
          : null,
      direct_sale_lot_id:
        lotConsommationSelectionne?.source === "vente_directe"
          ? lotConsommationSelectionne.id
          : null,
      source_type: lotConsommationSelectionne?.source || "sica",
      ...valeursCommunes,
    } : {
      lot_id: lotConsommationSelectionne?.id || null,
      ...valeursCommunes,
    };
    const resultat = consommationEnModification
      ? await supabase
          .from("consommations_aliment")
          .update(valeurs)
          .eq("id", consommationEnModification.id)
          .select("*")
          .single()
      : await supabase
          .from("consommations_aliment")
          .insert(valeurs)
          .select("*")
          .single();
    const { data, error } = resultat;

    if (error) {
      console.error("Erreur consommation aliment:", error);
      toast.error("La consommation n'a pas pu être enregistrée.");
    } else if (data) {
      const ligne = data as unknown as Record<string, unknown>;
      const consommation = {
        id: String(ligne.id || ""),
        lot_id: ligne.lot_id ? String(ligne.lot_id) : null,
        direct_sale_lot_id: ligne.direct_sale_lot_id
          ? String(ligne.direct_sale_lot_id)
          : null,
        source_type:
          ligne.source_type === "vente_directe" ? "vente_directe" : "sica",
        date: String(ligne.date || ""),
        feed_type: String(ligne.feed_type || ""),
        quantite_kg: Number(ligne.quantite_kg) || 0,
        note: ligne.note == null ? null : String(ligne.note),
      } as Consommation;
      setConsommations((items) => [
        consommation,
        ...items.filter((item) => item.id !== consommation.id),
      ]);
      setConsommationSacs("");
      setConsommationNote("");
      setConsommationEnModification(null);
      setConsommationModalOpen(false);
      toast.success(
        consommationEnModification
          ? "Consommation modifiée."
          : "Consommation enregistrée."
      );
    }
    setSaving(false);
  };

  const enregistrerLivraison = async () => {
    const nombreSacs = Number(livraisonSacs);
    const prix = livraisonPrix.trim() ? Number(livraisonPrix) : null;
    if (
      saving ||
      !livraisonDate ||
      !livraisonType ||
      !Number.isFinite(nombreSacs) ||
      nombreSacs <= 0 ||
      (prix != null && (!Number.isFinite(prix) || prix < 0))
    ) {
      toast.error("Complétez la date, l'aliment et une quantité positive.");
      return;
    }

    setSaving(true);
    const valeurs = {
      date: livraisonDate,
      feed_type: livraisonType,
      quantite_kg: nombreSacs * POIDS_SAC_KG,
      fournisseur: livraisonFournisseur.trim() || null,
      prix_total_ht: prix,
    };
    const resultat = livraisonEnModification
      ? await supabase
          .from("livraisons_aliment")
          .update(valeurs)
          .eq("id", livraisonEnModification.id)
          .select(
            "id, date, feed_type, quantite_kg, fournisseur, prix_total_ht, note"
          )
          .single()
      : await supabase
          .from("livraisons_aliment")
          .insert(valeurs)
          .select(
            "id, date, feed_type, quantite_kg, fournisseur, prix_total_ht, note"
          )
          .single();
    const { data, error } = resultat;

    if (error) {
      console.error("Erreur livraison aliment:", error);
      toast.error("La livraison n'a pas pu être enregistrée.");
    } else if (data) {
      const livraison = {
        ...data,
        quantite_kg: Number(data.quantite_kg) || 0,
        prix_total_ht:
          data.prix_total_ht == null ? null : Number(data.prix_total_ht) || 0,
      } as LivraisonStock;
      setLivraisons((items) => [
        livraison,
        ...items.filter((item) => item.id !== livraison.id),
      ]);
      setLivraisonSacs("");
      setLivraisonFournisseur("");
      setLivraisonPrix("");
      setLivraisonEnModification(null);
      setLivraisonModalOpen(false);
      toast.success(
        livraisonEnModification
          ? "Livraison modifiée."
          : "Livraison ajoutée au stock."
      );
    }
    setSaving(false);
  };

  const modifierConsommation = (item: Consommation) => {
    setConsommationEnModification(item);
    setConsommationLotId(
      item.source_type === "vente_directe"
        ? `vente_directe:${item.direct_sale_lot_id}`
        : `sica:${item.lot_id}`
    );
    setConsommationDate(item.date);
    setConsommationType(item.feed_type);
    setConsommationSacs(String(sacsEntiers(enSacs(item.quantite_kg))));
    setConsommationNote(item.note || "");
    setConsommationModalOpen(true);
  };

  const annulerModificationConsommation = () => {
    setConsommationEnModification(null);
    setConsommationLotId("");
    setConsommationDate(aujourdHui());
    setConsommationSacs("");
    setConsommationNote("");
  };

  const modifierLivraison = (item: LivraisonStock) => {
    setLivraisonEnModification(item);
    setLivraisonDate(item.date);
    setLivraisonType(item.feed_type);
    setLivraisonSacs(String(sacsEntiers(enSacs(item.quantite_kg))));
    setLivraisonFournisseur(item.fournisseur || "");
    setLivraisonPrix(
      item.prix_total_ht == null ? "" : String(item.prix_total_ht)
    );
    setLivraisonModalOpen(true);
  };

  const annulerModificationLivraison = () => {
    setLivraisonEnModification(null);
    setLivraisonDate(aujourdHui());
    setLivraisonSacs("");
    setLivraisonFournisseur("");
    setLivraisonPrix("");
  };

  const supprimerConsommation = async (item: Consommation) => {
    if (saving || !window.confirm("Supprimer cette consommation ?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("consommations_aliment")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error("La consommation n'a pas pu être supprimée.");
    } else {
      setConsommations((items) => items.filter((ligne) => ligne.id !== item.id));
      if (consommationEnModification?.id === item.id) {
        annulerModificationConsommation();
      }
      toast.success("Consommation supprimée.");
    }
    setSaving(false);
  };

  const supprimerLivraison = async (item: LivraisonStock) => {
    if (saving || !window.confirm("Supprimer cette livraison de stock ?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("livraisons_aliment")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error("La livraison n'a pas pu être supprimée.");
    } else {
      setLivraisons((items) => items.filter((ligne) => ligne.id !== item.id));
      if (livraisonEnModification?.id === item.id) {
        annulerModificationLivraison();
      }
      toast.success("Livraison supprimée.");
    }
    setSaving(false);
  };

  const ouvrirNouvelleReference = () => {
    setReferenceEnModification(null);
    setReferenceType("");
    setReferenceAgeMin("");
    setReferenceAgeMax("");
    setReferenceConso("");
    setReferencePrix("");
    setReferenceModalOpen(true);
  };

  const ouvrirModificationReference = (reference: FeedReference) => {
    setReferenceEnModification(reference);
    setReferenceType(reference.feed_type);
    setReferenceAgeMin(String(reference.age_min_days));
    setReferenceAgeMax(String(reference.age_max_days));
    setReferenceConso(String(reference.daily_consumption_g));
    setReferencePrix(String(reference.feed_price_ht || 0));
    setReferenceModalOpen(true);
  };

  const enregistrerReference = async () => {
    const ageMin = Number(referenceAgeMin);
    const ageMax = Number(referenceAgeMax);
    const consommation = Number(referenceConso);
    const prix = Number(referencePrix);
    if (
      saving ||
      !referenceType.trim() ||
      !Number.isInteger(ageMin) ||
      !Number.isInteger(ageMax) ||
      ageMin < 0 ||
      ageMax < ageMin ||
      !Number.isFinite(consommation) ||
      consommation <= 0 ||
      !Number.isFinite(prix) ||
      prix < 0
    ) {
      toast.error("Vérifiez le type, les âges, la consommation et le prix.");
      return;
    }

    const chevauchement = references.some(
      (item) =>
        item.id !== referenceEnModification?.id &&
        ageMin <= item.age_max_days &&
        ageMax >= item.age_min_days
    );
    if (chevauchement) {
      toast.error("Cette tranche d’âge chevauche une référence existante.");
      return;
    }

    setSaving(true);
    const valeurs = {
      feed_type: referenceType.trim(),
      age_min_days: ageMin,
      age_max_days: ageMax,
      daily_consumption_g: consommation,
      feed_price_ht: prix,
    };
    const resultat = referenceEnModification
      ? await supabase
          .from("feed_reference")
          .update(valeurs)
          .eq("id", referenceEnModification.id)
          .select(
            "id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht"
          )
          .single()
      : await supabase
          .from("feed_reference")
          .insert(valeurs)
          .select(
            "id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht"
          )
          .single();
    const { data, error } = resultat;

    if (error) {
      console.error("Erreur référence alimentaire:", error);
      toast.error("La référence n'a pas pu être enregistrée.");
    } else if (data) {
      const reference = {
        ...data,
        daily_consumption_g: Number(data.daily_consumption_g) || 0,
        age_min_days: Number(data.age_min_days) || 0,
        age_max_days: Number(data.age_max_days) || 0,
        feed_price_ht: Number(data.feed_price_ht) || 0,
      } as FeedReference;
      setReferences((items) =>
        [...items.filter((item) => item.id !== reference.id), reference].sort(
          (a, b) => a.age_min_days - b.age_min_days
        )
      );
      setReferenceModalOpen(false);
      toast.success(
        referenceEnModification ? "Référence modifiée." : "Référence ajoutée."
      );
    }
    setSaving(false);
  };

  const supprimerReference = async (reference: FeedReference) => {
    if (
      saving ||
      !window.confirm(
        "Supprimer cette référence ? Les anciennes saisies de stock resteront conservées."
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("feed_reference")
      .delete()
      .eq("id", reference.id);
    if (error) {
      toast.error("La référence n'a pas pu être supprimée.");
    } else {
      setReferences((items) =>
        items.filter((item) => item.id !== reference.id)
      );
      toast.success("Référence supprimée.");
    }
    setSaving(false);
  };

  const consommationDuJour = consommations
    .filter((item) => item.date === aujourdHui())
    .reduce((total, item) => total + item.quantite_kg, 0);
  const stockTotal = stock.reduce((total, item) => total + item.stock, 0);
  const besoinTotalSacs = prevision.reduce(
    (total, item) => total + item.besoinSacs,
    0
  );
  const commandeTotaleSacs = prevision.reduce(
    (total, item) => total + item.aCommanderSacs,
    0
  );

  if (loading) return <div className="feed-loading">Chargement...</div>;

  return (
    <div className="feed-page">
      <header className="feed-heading">
        <div><h1>Suivi de l’alimentation</h1><p>Consommations quotidiennes, stock disponible et besoins sur 7 jours.</p></div>
        <div>
          <button type="button" onClick={() => { annulerModificationConsommation(); setConsommationModalOpen(true); }}>▥ Saisir une consommation</button>
          <button type="button" className="feed-primary-action" onClick={() => { annulerModificationLivraison(); setLivraisonModalOpen(true); }}>🚚 Ajouter une livraison</button>
          <button type="button" className="feed-info-button" title="Références alimentaires" aria-label="Afficher les références alimentaires" onClick={() => setReferencesInfoOpen(true)}>i</button>
        </div>
      </header>

      <nav className="poultry-tabs" aria-label="Sections volailles">
        <Link to="/volailles">Résumé</Link>
        <Link to="/volailles/sica">Lots SICA Madras</Link>
        <Link to="/volailles/sica/historique">Historique SICA</Link>
        <Link to="/volailles/vente-directe">Vente directe</Link>
        <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
        <Link to="/volailles/alimentation" className="poultry-tab-active">Alimentation</Link>
      </nav>

      {!directConsumptionReady && (
        <div className="feed-warning">
          ⓘ Le suivi des lots Vente directe nécessite la mise à jour
          Supabase <code>alimentation-vente-directe.sql</code>. Les données
          SICA Madras restent accessibles.
        </div>
      )}

      <section className="feed-kpis">
        <FeedKpi tone="green" icon="▣" label="Stock total" value={`${sacsEntiers(enSacs(stockTotal))} sacs`} note="Disponible en stock" />
        <FeedKpi tone="blue" icon="▥" label="Consommé aujourd’hui" value={`${sacsEntiers(enSacs(consommationDuJour))} sacs`} note="Toutes références" />
        <FeedKpi tone="violet" icon="□" label="Besoin sur 7 jours" value={`${Math.ceil(besoinTotalSacs)} sacs`} note="Prévision calculée" />
        <FeedKpi
          tone="orange"
          icon="⌛"
          label="Stock jusqu’au"
          value={autonomieStock?.dateFinStock ? formatDateCourte(autonomieStock.dateFinStock) : autonomieStock ? "Après 180 j" : "Non calculé"}
          note={autonomieStock?.feedType ? `Rupture prévue : ${autonomieStock.feedType}` : "Selon les lots actifs"}
        />
        <FeedKpi
          tone="green"
          icon="⌑"
          label="Commander le"
          value={autonomieStock?.dateCommande ? formatDateCourte(autonomieStock.dateCommande) : autonomieStock ? "Pas nécessaire" : "À définir"}
          note={autonomieStock?.dateCommande ? `${DELAI_COMMANDE_JOURS} jours avant la rupture` : "Aucune rupture proche"}
        />
      </section>

      <section className="feed-panel">
        <div className="feed-panel-heading"><div><h2>Stock par aliment</h2><p>Situation actuelle calculée à partir des livraisons et consommations.</p></div></div>
        <div className="feed-stock-grid">
          {stock.map((item, index) => (
            <article key={item.feedType} className={item.stock < 0 ? "feed-stock-alert" : ""}>
              <div className="feed-stock-heading"><span className={`feed-type-icon feed-type-${index % 3}`}>{index % 3 === 0 ? "⌁" : index % 3 === 1 ? "◔" : "♧"}</span><strong>{item.feedType}</strong><b>{sacsEntiers(enSacs(item.stock))} sacs</b></div>
              <div><span>Livré <b>{sacsEntiers(enSacs(item.entrees))} sacs</b></span><span>Consommé <b>{sacsEntiers(enSacs(item.consommations))} sacs</b></span></div>
            </article>
          ))}
          {!stock.length && <div className="feed-empty">Aucun mouvement de stock enregistré.</div>}
        </div>
      </section>

      <section className="feed-panel feed-forecast">
        <div className="feed-panel-heading"><div><h2>Prévision de commande à 7 jours</h2><p>Calculée avec les lots actifs, leur âge, les sujets restants et le stock.</p></div></div>
        {joursSansReference > 0 && <div className="feed-warning">ⓘ {joursSansReference} journée(s) de lot ne disposent pas d’une référence. La prévision peut être sous-estimée.</div>}
        <div className="feed-table-wrap">
          <table className="feed-table">
            <thead><tr><th>Aliment</th><th>Sacs à consommer</th><th>Stock en sacs</th><th>Sacs à commander</th></tr></thead>
            <tbody>{prevision.map((item, index) => <tr key={item.feedType}><td><span className={`feed-type-icon feed-type-${index % 3}`}>{index % 3 === 0 ? "⌁" : index % 3 === 1 ? "◔" : "♧"}</span>{item.feedType}</td><td>{Math.ceil(item.besoinSacs)}</td><td>{sacsEntiers(item.stockSacs)}</td><td className={item.aCommanderSacs > 0 ? "feed-order-needed" : "feed-order-ok"}>{item.aCommanderSacs}</td></tr>)}</tbody>
            {!!prevision.length && <tfoot><tr><td>Total</td><td>{Math.ceil(besoinTotalSacs)}</td><td>{sacsEntiers(enSacs(stockTotal))}</td><td>{commandeTotaleSacs}</td></tr></tfoot>}
          </table>
        </div>
      </section>

      <section className="feed-history-grid">
        <FeedHistory title="Dernières consommations" empty="Aucune consommation enregistrée.">
          {consommations.slice(0, 6).map((item) => {
            const lotId =
              item.source_type === "vente_directe"
                ? item.direct_sale_lot_id
                : item.lot_id;
            const lot = lots.find(
              (candidate) =>
                candidate.id === lotId &&
                candidate.source === item.source_type
            );
            return <Mouvement key={item.id} titre={`${lot?.nom || "Lot"} · ${item.feed_type}`} sousTitre={`${item.source_type === "vente_directe" ? "Vente directe" : "SICA Madras"} · ${formatDate(item.date)}`} valeur={`-${sacsEntiers(enSacs(item.quantite_kg))} sacs`} onEdit={() => modifierConsommation(item)} onDelete={() => supprimerConsommation(item)} saving={saving} />;
          })}
        </FeedHistory>
        <FeedHistory title="Dernières livraisons de stock" empty="Aucune livraison enregistrée.">
          {livraisons.slice(0, 6).map((item) => <Mouvement key={item.id} titre={`${item.feed_type}${item.fournisseur ? ` · ${item.fournisseur}` : ""}`} sousTitre={formatDate(item.date)} valeur={`+${sacsEntiers(enSacs(item.quantite_kg))} sacs`} onEdit={() => modifierLivraison(item)} onDelete={() => supprimerLivraison(item)} saving={saving} />)}
        </FeedHistory>
      </section>

      {consommationModalOpen && <div className="poultry-modal-backdrop"><div className="poultry-modal poultry-modal-medium"><ModalCloseButton onClick={() => { setConsommationModalOpen(false); annulerModificationConsommation(); }} disabled={saving} /><div className="poultry-modal-header"><span className="poultry-modal-icon">▥</span><div><h2>{consommationEnModification ? "Modifier la consommation" : "Saisir une consommation"}</h2><p>Enregistrer les sacs consommés par un lot.</p></div></div><div className="poultry-form-grid"><label>Lot<select value={consommationLotId} onChange={(event) => setConsommationLotId(event.target.value)}><option value="">Choisir un lot</option><optgroup label="Lots SICA Madras">{lots.filter((lot) => lot.source === "sica").map((lot) => <option key={`sica-${lot.id}`} value={`sica:${lot.id}`}>{lot.nom}</option>)}</optgroup><optgroup label="Lots Vente directe">{lots.filter((lot) => lot.source === "vente_directe").map((lot) => <option key={`vente-${lot.id}`} value={`vente_directe:${lot.id}`}>{lot.nom}</option>)}</optgroup></select></label><label>Date<input type="date" value={consommationDate} onChange={(event) => setConsommationDate(event.target.value)} /></label><label>Type d’aliment<select value={consommationType} onChange={(event) => setConsommationType(event.target.value)}><option value="">Choisir un aliment</option>{typesAliment.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Nombre de sacs consommés (25 kg)<input type="number" min={1} step={1} value={consommationSacs} onChange={(event) => setConsommationSacs(event.target.value)} /></label></div>{suggestionConsommation && <div className="feed-suggestion"><div><strong>Suggestion : {Math.ceil(suggestionConsommation.sacs)} sacs de {suggestionConsommation.reference.feed_type}</strong><span>{lotConsommationSelectionne?.source === "vente_directe" ? "Vente directe" : "SICA Madras"} · Lot âgé de {suggestionConsommation.age} jours · {suggestionConsommation.sujets} sujets.</span></div><button type="button" onClick={() => setConsommationSacs(String(Math.ceil(suggestionConsommation.sacs)))}>Utiliser</button></div>}<div className="poultry-form-stack feed-note-field"><label>Note facultative<input type="text" value={consommationNote} onChange={(event) => setConsommationNote(event.target.value)} /></label></div><div className="poultry-modal-actions"><button type="button" className="poultry-modal-primary" onClick={enregistrerConsommation} disabled={saving}>{saving ? "Enregistrement..." : "▣ Enregistrer la consommation"}</button><button type="button" className="poultry-modal-secondary" onClick={() => { setConsommationModalOpen(false); annulerModificationConsommation(); }}>Annuler</button></div></div></div>}

      {livraisonModalOpen && <div className="poultry-modal-backdrop"><div className="poultry-modal poultry-modal-medium"><ModalCloseButton onClick={() => { setLivraisonModalOpen(false); annulerModificationLivraison(); }} disabled={saving} /><div className="poultry-modal-header"><span className="poultry-modal-icon">🚚</span><div><h2>{livraisonEnModification ? "Modifier la livraison" : "Ajouter une livraison au stock"}</h2><p>Enregistrer une entrée de sacs de 25 kg.</p></div></div><div className="poultry-form-grid"><label>Date<input type="date" value={livraisonDate} onChange={(event) => setLivraisonDate(event.target.value)} /></label><label>Type d’aliment<select value={livraisonType} onChange={(event) => setLivraisonType(event.target.value)}><option value="">Choisir un aliment</option>{typesAliment.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Nombre de sacs livrés (25 kg)<input type="number" min={1} step={1} value={livraisonSacs} onChange={(event) => setLivraisonSacs(event.target.value)} /></label><label>Fournisseur<input type="text" value={livraisonFournisseur} onChange={(event) => setLivraisonFournisseur(event.target.value)} /></label></div><div className="poultry-form-stack feed-note-field"><label>Prix total HT facultatif (€)<input type="number" min={0} step="0.01" value={livraisonPrix} onChange={(event) => setLivraisonPrix(event.target.value)} /></label></div><div className="poultry-modal-actions"><button type="button" className="poultry-modal-primary" onClick={enregistrerLivraison} disabled={saving}>{saving ? "Enregistrement..." : "▣ Ajouter au stock"}</button><button type="button" className="poultry-modal-secondary" onClick={() => { setLivraisonModalOpen(false); annulerModificationLivraison(); }}>Annuler</button></div></div></div>}

      {referencesInfoOpen && <div className="poultry-modal-backdrop"><div className="poultry-modal poultry-modal-large feed-reference-modal"><ModalCloseButton onClick={() => setReferencesInfoOpen(false)} disabled={saving} /><div className="poultry-modal-header"><span className="poultry-modal-icon">i</span><div><h2>Références alimentaires</h2><p>Valeurs utilisées pour calculer la consommation prévisionnelle selon l’âge des lots.</p></div></div><div className="feed-reference-heading"><span>{references.length} référence(s)</span><button type="button" onClick={ouvrirNouvelleReference}>＋ Ajouter une référence</button></div><div className="feed-table-wrap"><table className="feed-table feed-reference-table"><thead><tr><th>Aliment</th><th>Âge minimum</th><th>Âge maximum</th><th>Consommation / sujet / jour</th><th>Prix du sac HT</th><th>Actions</th></tr></thead><tbody>{references.map((reference, index) => <tr key={reference.id}><td><span className={`feed-type-icon feed-type-${index % 3}`}>⌁</span>{reference.feed_type}</td><td>{reference.age_min_days} jours</td><td>{reference.age_max_days} jours</td><td>{reference.daily_consumption_g} g</td><td>{(reference.feed_price_ht || 0).toFixed(2)} €</td><td><div className="feed-row-actions"><button type="button" title="Modifier" onClick={() => ouvrirModificationReference(reference)}>✎</button><button type="button" title="Supprimer" onClick={() => supprimerReference(reference)}>🗑</button></div></td></tr>)}</tbody></table></div></div></div>}

      {referenceModalOpen && <div className="poultry-modal-backdrop poultry-modal-backdrop-front"><div className="poultry-modal poultry-modal-small"><ModalCloseButton onClick={() => setReferenceModalOpen(false)} disabled={saving} /><div className="poultry-modal-header"><span className="poultry-modal-icon">⌁</span><div><h2>{referenceEnModification ? "Modifier la référence" : "Ajouter une référence"}</h2><p>Les tranches d’âge ne doivent pas se chevaucher.</p></div></div><div className="poultry-form-stack"><label>Type d’aliment<input type="text" value={referenceType} onChange={(event) => setReferenceType(event.target.value)} placeholder="Ex. Démarrage" /></label><label>Âge minimum (jours)<input type="number" min={0} step={1} value={referenceAgeMin} onChange={(event) => setReferenceAgeMin(event.target.value)} /></label><label>Âge maximum (jours)<input type="number" min={0} step={1} value={referenceAgeMax} onChange={(event) => setReferenceAgeMax(event.target.value)} /></label><label>Consommation par sujet et par jour (g)<input type="number" min={0.01} step="0.01" value={referenceConso} onChange={(event) => setReferenceConso(event.target.value)} /></label><label>Prix HT d’un sac de 25 kg (€)<input type="number" min={0} step="0.01" value={referencePrix} onChange={(event) => setReferencePrix(event.target.value)} /></label></div><div className="poultry-modal-actions"><button type="button" className="poultry-modal-primary" onClick={enregistrerReference} disabled={saving}>{saving ? "Enregistrement..." : "▣ Enregistrer"}</button><button type="button" className="poultry-modal-secondary" onClick={() => setReferenceModalOpen(false)}>Annuler</button></div></div></div>}
    </div>
  );
}

function FeedKpi({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: string; note: string }) {
  return <article className="feed-kpi"><span className={`feed-kpi-icon feed-kpi-${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function FeedHistory({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return <section className="feed-panel feed-history"><h2>{title}</h2><div>{items.length && items[0] ? children : <div className="feed-empty">{empty}</div>}</div></section>;
}

function Mouvement({
  titre,
  sousTitre,
  valeur,
  onEdit,
  onDelete,
  saving,
}: {
  titre: string;
  sousTitre: string;
  valeur: string;
  onEdit: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className="feed-movement">
      <div>
        <strong>{titre}</strong>
        <small>{sousTitre}</small>
      </div>
      <b>{valeur}</b>
      <div className="feed-row-actions">
        <button type="button" title="Modifier" onClick={onEdit} disabled={saving}>✎</button>
        <button type="button" title="Supprimer" onClick={onDelete} disabled={saving}>🗑</button>
      </div>
    </div>
  );
}
