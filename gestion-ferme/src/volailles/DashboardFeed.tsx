import { Children, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";

type Lot = {
  id: string;
  nom: string;
  quantite: number;
  sujets_restants: number;
  date_arrivee: string;
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
  lot_id: string;
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
const PREVISION_JOURS = 15;
const enSacs = (quantiteKg: number) => quantiteKg / POIDS_SAC_KG;
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
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [referenceEnModification, setReferenceEnModification] =
    useState<FeedReference | null>(null);
  const [referenceType, setReferenceType] = useState("");
  const [referenceAgeMin, setReferenceAgeMin] = useState("0");
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
    const [lotsResult, refsResult, consommationsResult, livraisonsResult] =
      await Promise.all([
        supabase
          .from("lots_volailles")
          .select("id, nom, quantite, sujets_restants, date_arrivee")
          .eq("is_active", true)
          .order("nom"),
        supabase
          .from("feed_reference")
          .select(
            "id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht"
          )
          .order("age_min_days"),
        supabase
          .from("consommations_aliment")
          .select("id, lot_id, date, feed_type, quantite_kg, note")
          .order("date", { ascending: false }),
        supabase
          .from("livraisons_aliment")
          .select(
            "id, date, feed_type, quantite_kg, fournisseur, prix_total_ht, note"
          )
          .order("date", { ascending: false }),
      ]);

    const error =
      lotsResult.error ||
      refsResult.error ||
      consommationsResult.error ||
      livraisonsResult.error;

    if (error) {
      console.error("Erreur chargement alimentation:", error);
      toast.error("Le suivi d'alimentation n'a pas pu être chargé.");
    } else {
      setLots((lotsResult.data || []) as Lot[]);
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
        (consommationsResult.data || []).map((item) => ({
          ...item,
          quantite_kg: Number(item.quantite_kg) || 0,
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
      ).sort((a, b) => a.localeCompare(b)),
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
    () => lots.find((lot) => lot.id === consommationLotId) || null,
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
      .sort((a, b) => b.aCommanderSacs - a.aCommanderSacs);
  }, [lots, references, stock, typesAliment]);

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

    setSaving(true);
    const valeurs = {
      lot_id: consommationLotId,
      date: consommationDate,
      feed_type: consommationType,
      quantite_kg: nombreSacs * POIDS_SAC_KG,
      note: consommationNote.trim() || null,
    };
    const resultat = consommationEnModification
      ? await supabase
          .from("consommations_aliment")
          .update(valeurs)
          .eq("id", consommationEnModification.id)
          .select("id, lot_id, date, feed_type, quantite_kg, note")
          .single()
      : await supabase
          .from("consommations_aliment")
          .insert(valeurs)
          .select("id, lot_id, date, feed_type, quantite_kg, note")
          .single();
    const { data, error } = resultat;

    if (error) {
      console.error("Erreur consommation aliment:", error);
      toast.error("La consommation n'a pas pu être enregistrée.");
    } else if (data) {
      const consommation = {
        ...data,
        quantite_kg: Number(data.quantite_kg) || 0,
      } as Consommation;
      setConsommations((items) => [
        consommation,
        ...items.filter((item) => item.id !== consommation.id),
      ]);
      setConsommationSacs("");
      setConsommationNote("");
      setConsommationEnModification(null);
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
    setConsommationLotId(item.lot_id);
    setConsommationDate(item.date);
    setConsommationType(item.feed_type);
    setConsommationSacs(enSacs(item.quantite_kg).toFixed(2));
    setConsommationNote(item.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    setLivraisonSacs(enSacs(item.quantite_kg).toFixed(2));
    setLivraisonFournisseur(item.fournisseur || "");
    setLivraisonPrix(
      item.prix_total_ht == null ? "" : String(item.prix_total_ht)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    setReferenceAgeMin("0");
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

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suivi de l’alimentation</h1>
        <p className="text-sm text-gray-600">
          Consommations quotidiennes, stock disponible et besoins sur 15 jours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          label="Stock total"
          value={`${enSacs(stockTotal).toFixed(2)} sacs`}
        />
        <Indicateur
          label="Consommé aujourd’hui"
          value={`${enSacs(consommationDuJour).toFixed(2)} sacs`}
        />
        <Indicateur
          label="Besoin sur 15 jours"
          value={`${besoinTotalSacs.toFixed(2)} sacs`}
        />
        <Indicateur
          label="À commander"
          value={`${commandeTotaleSacs} sacs`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Formulaire
          title={
            consommationEnModification
              ? "Modifier la consommation"
              : "Saisir une consommation"
          }
        >
          {consommationEnModification && (
            <div className="flex items-center justify-between gap-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <span>La consommation sélectionnée est en cours de modification.</span>
              <button
                type="button"
                onClick={annulerModificationConsommation}
                disabled={saving}
                className="shrink-0 rounded !bg-gray-200 px-3 py-2 !text-gray-900 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Champ label="Lot">
              <select
                value={consommationLotId}
                onChange={(event) => setConsommationLotId(event.target.value)}
                className="w-full rounded border p-2"
              >
                <option value="">Choisir un lot</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Date">
              <input
                type="date"
                value={consommationDate}
                onChange={(event) => setConsommationDate(event.target.value)}
                className="w-full rounded border p-2"
              />
            </Champ>
            <Champ label="Type d’aliment">
              <select
                value={consommationType}
                onChange={(event) => setConsommationType(event.target.value)}
                className="w-full rounded border p-2"
              >
                <option value="">Choisir un aliment</option>
                {typesAliment.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Nombre de sacs consommés (25 kg)">
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={consommationSacs}
                onChange={(event) => setConsommationSacs(event.target.value)}
                className="w-full rounded border p-2"
              />
            </Champ>
          </div>
          {lotConsommationSelectionne && suggestionConsommation && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <div className="font-semibold">
                Suggestion : {suggestionConsommation.sacs.toFixed(2)} sacs de{" "}
                {suggestionConsommation.reference.feed_type}
              </div>
              <div className="mt-1 text-blue-800">
                Lot âgé de {suggestionConsommation.age} jours, calculé pour{" "}
                {suggestionConsommation.sujets} sujet(s).
              </div>
              <button
                type="button"
                onClick={() =>
                  setConsommationSacs(suggestionConsommation.sacs.toFixed(2))
                }
                className="mt-3 rounded !bg-blue-600 px-3 py-2 !text-white"
              >
                Utiliser cette quantité
              </button>
            </div>
          )}
          {lotConsommationSelectionne &&
            consommationDate &&
            !suggestionConsommation && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Aucune référence alimentaire ne correspond à l’âge de ce lot à
                cette date. La quantité peut être saisie manuellement.
              </div>
            )}
          <Champ label="Note facultative">
            <input
              type="text"
              value={consommationNote}
              onChange={(event) => setConsommationNote(event.target.value)}
              className="w-full rounded border p-2"
            />
          </Champ>
          <button
            onClick={enregistrerConsommation}
            disabled={saving}
            className="w-full !bg-blue-600 !text-white rounded p-2 disabled:opacity-60"
          >
            {saving
              ? "Enregistrement..."
              : consommationEnModification
                ? "Enregistrer les modifications"
                : "Enregistrer la consommation"}
          </button>
        </Formulaire>

        <Formulaire
          title={
            livraisonEnModification
              ? "Modifier la livraison"
              : "Ajouter une livraison au stock"
          }
        >
          {livraisonEnModification && (
            <div className="flex items-center justify-between gap-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <span>La livraison sélectionnée est en cours de modification.</span>
              <button
                type="button"
                onClick={annulerModificationLivraison}
                disabled={saving}
                className="shrink-0 rounded !bg-gray-200 px-3 py-2 !text-gray-900 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          )}
          <p className="text-sm text-gray-600">
            Pour initialiser le suivi, saisissez ici le stock actuellement présent.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Champ label="Date">
              <input
                type="date"
                value={livraisonDate}
                onChange={(event) => setLivraisonDate(event.target.value)}
                className="w-full rounded border p-2"
              />
            </Champ>
            <Champ label="Type d’aliment">
              <select
                value={livraisonType}
                onChange={(event) => setLivraisonType(event.target.value)}
                className="w-full rounded border p-2"
              >
                <option value="">Choisir un aliment</option>
                {typesAliment.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Nombre de sacs livrés (25 kg)">
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={livraisonSacs}
                onChange={(event) => setLivraisonSacs(event.target.value)}
                className="w-full rounded border p-2"
              />
            </Champ>
            <Champ label="Fournisseur">
              <input
                type="text"
                value={livraisonFournisseur}
                onChange={(event) => setLivraisonFournisseur(event.target.value)}
                className="w-full rounded border p-2"
              />
            </Champ>
          </div>
          <Champ label="Prix total HT facultatif (€)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={livraisonPrix}
              onChange={(event) => setLivraisonPrix(event.target.value)}
              className="w-full rounded border p-2"
            />
          </Champ>
          <button
            onClick={enregistrerLivraison}
            disabled={saving}
            className="w-full !bg-emerald-600 !text-white rounded p-2 disabled:opacity-60"
          >
            {saving
              ? "Enregistrement..."
              : livraisonEnModification
                ? "Enregistrer les modifications"
                : "Ajouter au stock"}
          </button>
        </Formulaire>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Stock par aliment</h2>
        {stock.length === 0 ? (
          <EtatVide texte="Aucun mouvement de stock enregistré." />
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stock.map((item) => (
              <article
                key={item.feedType}
                className={`rounded border p-4 ${
                  item.stock < 0 ? "border-red-300 bg-red-50" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{item.feedType}</h3>
                  <span className="text-xl font-bold">
                    {enSacs(item.stock).toFixed(2)} sacs
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Valeur
                    label="Livré"
                    value={`${enSacs(item.entrees).toFixed(2)} sacs`}
                  />
                  <Valeur
                    label="Consommé"
                    value={`${enSacs(item.consommations).toFixed(2)} sacs`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Prévision de commande à 15 jours</h2>
        <p className="text-sm text-gray-600">
          Calculée avec les lots actifs, leur âge, les sujets restants et le stock.
        </p>
        {joursSansReference > 0 && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {joursSansReference} journée(s) de lot ne disposent pas d’une référence
            de consommation. La prévision peut être sous-estimée.
          </div>
        )}
        {prevision.length === 0 ? (
          <EtatVide texte="Aucun besoin prévisionnel disponible." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Aliment</th>
                  <th className="border px-3 py-2 text-right">Sacs à consommer</th>
                  <th className="border px-3 py-2 text-right">Stock en sacs</th>
                  <th className="border px-3 py-2 text-right">Sacs à commander</th>
                </tr>
              </thead>
              <tbody>
                {prevision.map((item) => (
                  <tr key={item.feedType} className="odd:bg-white even:bg-gray-50">
                    <td className="border px-3 py-2">{item.feedType}</td>
                    <td className="border px-3 py-2 text-right">
                      {item.besoinSacs.toFixed(2)}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {item.stockSacs.toFixed(2)}
                    </td>
                    <td className="border px-3 py-2 text-right font-semibold">
                      {item.aCommanderSacs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Références alimentaires</h2>
            <p className="text-sm text-gray-600">
              Ces valeurs servent à calculer la consommation prévisionnelle selon
              l’âge des lots.
            </p>
          </div>
          <button
            type="button"
            onClick={ouvrirNouvelleReference}
            className="rounded !bg-blue-600 px-4 py-2 !text-white"
          >
            Ajouter une référence
          </button>
        </div>

        {references.length === 0 ? (
          <EtatVide texte="Aucune référence alimentaire enregistrée." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Aliment</th>
                  <th className="border px-3 py-2 text-right">Âge minimum</th>
                  <th className="border px-3 py-2 text-right">Âge maximum</th>
                  <th className="border px-3 py-2 text-right">
                    Consommation / sujet / jour
                  </th>
                  <th className="border px-3 py-2 text-right">
                    Prix du sac HT
                  </th>
                  <th className="border px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {references.map((reference) => (
                  <tr
                    key={reference.id}
                    className="odd:bg-white even:bg-gray-50"
                  >
                    <td className="border px-3 py-2 font-medium">
                      {reference.feed_type}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {reference.age_min_days} jours
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {reference.age_max_days} jours
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {reference.daily_consumption_g} g
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {(reference.feed_price_ht || 0).toFixed(2)} €
                    </td>
                    <td className="border px-3 py-2">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => ouvrirModificationReference(reference)}
                          disabled={saving}
                          className="rounded !bg-slate-700 px-3 py-2 !text-white disabled:opacity-60"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => supprimerReference(reference)}
                          disabled={saving}
                          className="rounded !bg-red-600 px-3 py-2 !text-white disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Historique
          title="Dernières consommations"
          vide="Aucune consommation enregistrée."
        >
          {consommations.slice(0, 15).map((item) => (
            <Mouvement
              key={item.id}
              titre={`${lots.find((lot) => lot.id === item.lot_id)?.nom || "Lot"} · ${item.feed_type}`}
              sousTitre={formatDate(item.date)}
              valeur={`-${enSacs(item.quantite_kg).toFixed(2)} sacs`}
              onEdit={() => modifierConsommation(item)}
              onDelete={() => supprimerConsommation(item)}
              saving={saving}
            />
          ))}
        </Historique>

        <Historique
          title="Dernières livraisons de stock"
          vide="Aucune livraison enregistrée."
        >
          {livraisons.slice(0, 15).map((item) => (
            <Mouvement
              key={item.id}
              titre={`${item.feed_type}${item.fournisseur ? ` · ${item.fournisseur}` : ""}`}
              sousTitre={formatDate(item.date)}
              valeur={`+${enSacs(item.quantite_kg).toFixed(2)} sacs`}
              onEdit={() => modifierLivraison(item)}
              onDelete={() => supprimerLivraison(item)}
              saving={saving}
            />
          ))}
        </Historique>
      </div>

      {referenceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reference-alimentaire-titre"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="reference-alimentaire-titre"
                  className="text-xl font-semibold"
                >
                  {referenceEnModification
                    ? "Modifier la référence"
                    : "Ajouter une référence"}
                </h2>
                <p className="text-sm text-gray-600">
                  Les tranches d’âge ne doivent pas se chevaucher.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReferenceModalOpen(false)}
                className="rounded !bg-gray-200 px-3 py-2 !text-gray-900"
                aria-label="Fermer"
              >
                Fermer
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Champ label="Type d’aliment">
                <input
                  type="text"
                  value={referenceType}
                  onChange={(event) => setReferenceType(event.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="Ex. Démarrage"
                />
              </Champ>

              <div className="grid grid-cols-2 gap-3">
                <Champ label="Âge minimum (jours)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={referenceAgeMin}
                    onChange={(event) => setReferenceAgeMin(event.target.value)}
                    className="w-full rounded border p-2"
                  />
                </Champ>
                <Champ label="Âge maximum (jours)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={referenceAgeMax}
                    onChange={(event) => setReferenceAgeMax(event.target.value)}
                    className="w-full rounded border p-2"
                  />
                </Champ>
              </div>

              <Champ label="Consommation par sujet et par jour (g)">
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={referenceConso}
                  onChange={(event) => setReferenceConso(event.target.value)}
                  className="w-full rounded border p-2"
                />
              </Champ>

              <Champ label="Prix HT d’un sac de 25 kg (€)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={referencePrix}
                  onChange={(event) => setReferencePrix(event.target.value)}
                  className="w-full rounded border p-2"
                />
              </Champ>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReferenceModalOpen(false)}
                disabled={saving}
                className="rounded !bg-gray-200 px-4 py-2 !text-gray-900 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={enregistrerReference}
                disabled={saving}
                className="rounded !bg-blue-600 px-4 py-2 !text-white disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Indicateur({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Formulaire({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Champ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Valeur({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Historique({
  title,
  vide,
  children,
}: {
  title: string;
  vide: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {Children.count(children) > 0 ? children : <EtatVide texte={vide} />}
      </div>
    </section>
  );
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
      <div className="min-w-0">
        <div className="truncate font-medium">{titre}</div>
        <div className="text-sm text-gray-500">{sousTitre}</div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <span className="mr-auto font-semibold sm:mr-0">{valeur}</span>
        <button
          onClick={onEdit}
          disabled={saving}
          className="rounded !bg-slate-700 px-2 py-1 text-xs !text-white disabled:opacity-60"
        >
          Modifier
        </button>
        <button
          onClick={onDelete}
          disabled={saving}
          className="!bg-red-600 !text-white rounded px-2 py-1 text-xs disabled:opacity-60"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function EtatVide({ texte }: { texte: string }) {
  return <div className="p-6 text-center text-gray-500">{texte}</div>;
}
