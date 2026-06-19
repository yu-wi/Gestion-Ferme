import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";

type LotEconomie = {
  id: string;
  nom: string;
  quantite: number;
  nb_morts: number;
  total_poids_livre: number;
  resultat_brut: number;
  resultat_net: number | null;
};

type ChargeEconomie = {
  lot_id: string;
  type_charge: string;
  montant: number;
};

type AnalyseLot = {
  id: string;
  nom: string;
  totalVendu: number;
  chiffreAffaires: number;
  resultatNetSaisi: number | null;
  chargePoussins: number;
  chargeAliments: number;
  chargeRamassage: number;
  chargeLivraison: number;
  totalCharges: number;
  resultatCalcule: number;
  margeParKg: number;
  tauxMortalite: number;
  tauxCharges: number;
  score: number;
};

const couleursCharges = ["#2563eb", "#eab308", "#dc2626", "#059669"];

export default function TableauDeBordEconomie() {
  const [data, setData] = useState<AnalyseLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const fetchEconomyData = async () => {
      const [lotsResult, chargesResult] = await Promise.all([
        supabase
          .from("lots_volailles")
          .select(
            "id, nom, quantite, nb_morts, total_poids_livre, resultat_brut, resultat_net"
          )
          .eq("is_active", false),
        supabase.from("charges").select("lot_id, type_charge, montant"),
      ]);

      if (lotsResult.error || chargesResult.error) {
        console.error(
          "Erreur chargement analyse économique:",
          lotsResult.error || chargesResult.error
        );
        toast.error("L'analyse économique n'a pas pu être chargée.");
        setLoading(false);
        return;
      }

      const lots = (lotsResult.data || []) as LotEconomie[];
      const charges = (chargesResult.data || []).map((charge) => ({
        ...charge,
        montant: Number(charge.montant) || 0,
      })) as ChargeEconomie[];

      const tableau = lots.map((lot): AnalyseLot => {
        const totalVendu = Number(lot.total_poids_livre) || 0;
        const chiffreAffaires = Number(lot.resultat_brut) || 0;
        const resultatNetSaisi =
          lot.resultat_net == null ? null : Number(lot.resultat_net) || 0;
        const quantiteInitiale = Number(lot.quantite) || 0;
        const nbMorts = Number(lot.nb_morts) || 0;
        const lotCharges = charges.filter((charge) => charge.lot_id === lot.id);

        const totalType = (type: string) =>
          lotCharges
            .filter((charge) => charge.type_charge === type)
            .reduce((total, charge) => total + charge.montant, 0);

        const chargePoussins = totalType("achat_poussins");
        const chargeAliments = totalType("aliment");
        const chargeRamassage = totalType("ramassage");
        const chargeLivraison = totalType("livraison");
        const totalCharges =
          chargePoussins + chargeAliments + chargeRamassage + chargeLivraison;
        const resultatCalcule = chiffreAffaires - totalCharges;
        const margeParKg = totalVendu > 0 ? resultatCalcule / totalVendu : 0;
        const tauxMortalite =
          quantiteInitiale > 0 ? nbMorts / quantiteInitiale : 0;
        const tauxCharges =
          chiffreAffaires > 0 ? totalCharges / chiffreAffaires : 0;

        const scoreRentabilite = Math.max(
          0,
          Math.min(40, (Math.max(margeParKg, 0) / 3) * 40)
        );
        const scoreMortalite = Math.max(
          0,
          30 * (1 - Math.min(tauxMortalite / 0.3, 1))
        );
        const scoreCharges = Math.max(
          0,
          30 * (1 - Math.min(tauxCharges, 1))
        );

        return {
          id: lot.id,
          nom: lot.nom,
          totalVendu,
          chiffreAffaires,
          resultatNetSaisi,
          chargePoussins,
          chargeAliments,
          chargeRamassage,
          chargeLivraison,
          totalCharges,
          resultatCalcule,
          margeParKg,
          tauxMortalite: tauxMortalite * 100,
          tauxCharges: tauxCharges * 100,
          score: Math.round(scoreRentabilite + scoreMortalite + scoreCharges),
        };
      });

      tableau.sort((a, b) => b.resultatCalcule - a.resultatCalcule);
      setData(tableau);
      setSelectedLot((selection) =>
        selection && tableau.some((lot) => lot.id === selection)
          ? selection
          : tableau[0]?.id || null
      );
      setLoading(false);
    };

    fetchEconomyData();
  }, []);

  const terme = recherche.trim().toLowerCase();
  const lotsAffiches = data.filter(
    (lot) => !terme || lot.nom.toLowerCase().includes(terme)
  );
  const lotSelectionne =
    lotsAffiches.find((lot) => lot.id === selectedLot) || lotsAffiches[0];

  const totalChiffreAffaires = lotsAffiches.reduce(
    (total, lot) => total + lot.chiffreAffaires,
    0
  );
  const totalCharges = lotsAffiches.reduce(
    (total, lot) => total + lot.totalCharges,
    0
  );
  const resultatCalcule = totalChiffreAffaires - totalCharges;
  const poidsLivre = lotsAffiches.reduce(
    (total, lot) => total + lot.totalVendu,
    0
  );

  const pieData = lotSelectionne
    ? [
        { name: "Poussins", value: lotSelectionne.chargePoussins },
        { name: "Aliment", value: lotSelectionne.chargeAliments },
        { name: "Ramassage", value: lotSelectionne.chargeRamassage },
        { name: "Livraison", value: lotSelectionne.chargeLivraison },
      ].filter((charge) => charge.value > 0)
    : [];

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Analyse économique</h1>
        <p className="text-sm text-gray-600">
          Chiffre d’affaires, charges et rentabilité des lots archivés.
        </p>
      </div>

      <input
        type="search"
        value={recherche}
        onChange={(event) => setRecherche(event.target.value)}
        placeholder="Rechercher un lot"
        className="w-full rounded border bg-white p-3 md:max-w-md"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur label="Chiffre d’affaires" valeur={`${totalChiffreAffaires.toFixed(2)} €`} />
        <Indicateur label="Charges" valeur={`${totalCharges.toFixed(2)} €`} />
        <Indicateur label="Résultat calculé" valeur={`${resultatCalcule.toFixed(2)} €`} />
        <Indicateur label="Poids livré" valeur={`${poidsLivre.toFixed(2)} kg`} />
      </div>

      {lotsAffiches.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          Aucun lot ne correspond à cette recherche.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lotsAffiches.map((lot) => (
            <article key={lot.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{lot.nom}</h2>
                <span
                  className={`rounded px-2 py-1 text-xs font-semibold ${
                    lot.resultatCalcule >= 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {lot.resultatCalcule >= 0 ? "Positif" : "Déficitaire"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Valeur label="Chiffre d’affaires" valeur={`${lot.chiffreAffaires.toFixed(2)} €`} />
                <Valeur label="Charges" valeur={`${lot.totalCharges.toFixed(2)} €`} />
                <Valeur label="Résultat calculé" valeur={`${lot.resultatCalcule.toFixed(2)} €`} />
                <Valeur label="Marge / kg" valeur={`${lot.margeParKg.toFixed(2)} €`} />
                <Valeur label="Mortalité" valeur={`${lot.tauxMortalite.toFixed(1)} %`} />
                <Valeur label="Taux de charges" valeur={`${lot.tauxCharges.toFixed(1)} %`} />
              </div>

              <div className="mt-4 border-t pt-3 text-sm">
                Résultat net saisi :{" "}
                <strong>
                  {lot.resultatNetSaisi == null
                    ? "Non renseigné"
                    : `${lot.resultatNetSaisi.toFixed(2)} €`}
                </strong>
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-700">
                Score de performance : {lot.score} / 100
              </div>
            </article>
          ))}
        </div>
      )}

      {lotsAffiches.length > 0 && (
        <>
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700">
              Répartition des charges du lot
              <select
                value={lotSelectionne?.id || ""}
                onChange={(event) => setSelectedLot(event.target.value)}
                className="mt-1 w-full rounded border p-2 md:max-w-md"
              >
                {lotsAffiches.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.nom}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 h-80">
              {pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500">
                  Aucune charge enregistrée pour ce lot.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={90}
                    >
                      {pieData.map((charge, index) => (
                        <Cell
                          key={charge.name}
                          fill={couleursCharges[index % couleursCharges.length]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      formatter={(value: number) => `${Number(value).toFixed(2)} €`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Résultat calculé par lot</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lotsAffiches}
                  margin={{ top: 10, right: 10, left: 0, bottom: 35 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom" angle={-35} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `${Number(value).toFixed(2)} €`}
                  />
                  <Bar dataKey="resultatCalcule" name="Résultat calculé (€)" fill="#059669" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Indicateur({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{valeur}</div>
    </div>
  );
}

function Valeur({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold">{valeur}</div>
    </div>
  );
}
