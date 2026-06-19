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

const ageAuJour = (dateArrivee: string, decalageJours = 0) => {
  const arrivee = new Date(`${dateArrivee}T00:00:00`);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + decalageJours);
  return Math.max(0, Math.floor((date.getTime() - arrivee.getTime()) / 86400000));
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

  const [consommationLotId, setConsommationLotId] = useState("");
  const [consommationDate, setConsommationDate] = useState(aujourdHui());
  const [consommationType, setConsommationType] = useState("");
  const [consommationSacs, setConsommationSacs] = useState("");
  const [consommationNote, setConsommationNote] = useState("");

  const [livraisonDate, setLivraisonDate] = useState(aujourdHui());
  const [livraisonType, setLivraisonType] = useState("");
  const [livraisonSacs, setLivraisonSacs] = useState("");
  const [livraisonFournisseur, setLivraisonFournisseur] = useState("");
  const [livraisonPrix, setLivraisonPrix] = useState("");

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
            "feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht"
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
    const { data, error } = await supabase
      .from("consommations_aliment")
      .insert({
        lot_id: consommationLotId,
        date: consommationDate,
        feed_type: consommationType,
        quantite_kg: nombreSacs * POIDS_SAC_KG,
        note: consommationNote.trim() || null,
      })
      .select("id, lot_id, date, feed_type, quantite_kg, note")
      .single();

    if (error) {
      console.error("Erreur consommation aliment:", error);
      toast.error("La consommation n'a pas pu être enregistrée.");
    } else if (data) {
      setConsommations((items) => [
        { ...data, quantite_kg: Number(data.quantite_kg) || 0 } as Consommation,
        ...items,
      ]);
      setConsommationSacs("");
      setConsommationNote("");
      toast.success("Consommation enregistrée.");
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
    const { data, error } = await supabase
      .from("livraisons_aliment")
      .insert({
        date: livraisonDate,
        feed_type: livraisonType,
        quantite_kg: nombreSacs * POIDS_SAC_KG,
        fournisseur: livraisonFournisseur.trim() || null,
        prix_total_ht: prix,
      })
      .select(
        "id, date, feed_type, quantite_kg, fournisseur, prix_total_ht, note"
      )
      .single();

    if (error) {
      console.error("Erreur livraison aliment:", error);
      toast.error("La livraison n'a pas pu être enregistrée.");
    } else if (data) {
      setLivraisons((items) => [
        {
          ...data,
          quantite_kg: Number(data.quantite_kg) || 0,
          prix_total_ht:
            data.prix_total_ht == null ? null : Number(data.prix_total_ht) || 0,
        } as LivraisonStock,
        ...items,
      ]);
      setLivraisonSacs("");
      setLivraisonFournisseur("");
      setLivraisonPrix("");
      toast.success("Livraison ajoutée au stock.");
    }
    setSaving(false);
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
      toast.success("Livraison supprimée.");
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
        <Formulaire title="Saisir une consommation">
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
            {saving ? "Enregistrement..." : "Enregistrer la consommation"}
          </button>
        </Formulaire>

        <Formulaire title="Ajouter une livraison au stock">
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
            {saving ? "Enregistrement..." : "Ajouter au stock"}
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
              onDelete={() => supprimerLivraison(item)}
              saving={saving}
            />
          ))}
        </Historique>
      </div>
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
  onDelete,
  saving,
}: {
  titre: string;
  sousTitre: string;
  valeur: string;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border p-3">
      <div className="min-w-0">
        <div className="truncate font-medium">{titre}</div>
        <div className="text-sm text-gray-500">{sousTitre}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-semibold">{valeur}</span>
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
