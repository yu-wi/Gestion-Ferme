import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import {
  chargerLotsAvecMouvements,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from "./volaillesData";

type OngletAnalyse = "production" | "economie";

type LotAnalyse = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  mortalites: MortaliteVolaille[];
  livraisons: LivraisonVolaille[];
  nb_morts: number;
  sujets_restants: number;
  resultat_brut: number | null;
  resultat_net: number | null;
  autoconsommation: number;
  quantite_retenue: number;
  total_poids_livre: number;
};

type Charge = {
  lot_id: string;
  type_charge: string;
  montant: number;
};

type LigneAnalyse = LotAnalyse & {
  quantiteLivree: number;
  tauxMortalite: number;
  poidsMoyen: number;
  chargePoussins: number;
  chargeAliments: number;
  chargeRamassage: number;
  chargeLivraison: number;
  totalCharges: number;
  resultatCalcule: number;
  margeParKg: number;
  tauxCharges: number;
};

const couleursCharges = ["#2563eb", "#f59e0b", "#dc2626", "#059669"];

export default function Analyse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lots, setLots] = useState<LotAnalyse[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [onglet, setOnglet] = useState<OngletAnalyse>(
    searchParams.get("onglet") === "economie" ? "economie" : "production"
  );
  const [recherche, setRecherche] = useState("");
  const [lotSelectionneId, setLotSelectionneId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const chargerAnalyse = async () => {
      try {
        const [lotsData, chargesResult] = await Promise.all([
          chargerLotsAvecMouvements(false),
          supabase.from("charges").select("lot_id, type_charge, montant"),
        ]);

        if (chargesResult.error) throw chargesResult.error;

        setLots(lotsData as LotAnalyse[]);
        setCharges(
          (chargesResult.data || []).map((charge) => ({
            ...charge,
            montant: Number(charge.montant) || 0,
          })) as Charge[]
        );
      } catch (error) {
        console.error("Erreur chargement analyse :", error);
        toast.error("La page Analyse n'a pas pu être chargée.");
      }
      setLoading(false);
    };

    chargerAnalyse();
  }, []);

  const lignes = useMemo<LigneAnalyse[]>(
    () =>
      lots.map((lot) => {
        const quantiteLivree = lot.livraisons.reduce(
          (total, livraison) => total + (Number(livraison.quantite) || 0),
          0
        );
        const poidsLivre = Number(lot.total_poids_livre) || 0;
        const chiffreAffaires = Number(lot.resultat_brut) || 0;
        const chargesLot = charges.filter((charge) => charge.lot_id === lot.id);
        const totalType = (type: string) =>
          chargesLot
            .filter((charge) => charge.type_charge === type)
            .reduce((total, charge) => total + charge.montant, 0);
        const chargePoussins = totalType("achat_poussins");
        const chargeAliments = totalType("aliment");
        const chargeRamassage = totalType("ramassage");
        const chargeLivraison = totalType("livraison");
        const totalCharges =
          chargePoussins + chargeAliments + chargeRamassage + chargeLivraison;
        const resultatCalcule = chiffreAffaires - totalCharges;

        return {
          ...lot,
          quantiteLivree,
          tauxMortalite:
            lot.quantite > 0
              ? ((Number(lot.nb_morts) || 0) / lot.quantite) * 100
              : 0,
          poidsMoyen: quantiteLivree > 0 ? poidsLivre / quantiteLivree : 0,
          chargePoussins,
          chargeAliments,
          chargeRamassage,
          chargeLivraison,
          totalCharges,
          resultatCalcule,
          margeParKg: poidsLivre > 0 ? resultatCalcule / poidsLivre : 0,
          tauxCharges:
            chiffreAffaires > 0 ? (totalCharges / chiffreAffaires) * 100 : 0,
        };
      }),
    [lots, charges]
  );

  const terme = recherche.trim().toLowerCase();
  const lignesAffichees = lignes.filter(
    (lot) =>
      !terme ||
      lot.nom.toLowerCase().includes(terme) ||
      lot.batiment.toLowerCase().includes(terme)
  );

  useEffect(() => {
    if (
      lignesAffichees.length > 0 &&
      !lignesAffichees.some((lot) => lot.id === lotSelectionneId)
    ) {
      setLotSelectionneId(lignesAffichees[0].id);
    }
  }, [lignesAffichees, lotSelectionneId]);

  const lotSelectionne =
    lignesAffichees.find((lot) => lot.id === lotSelectionneId) ||
    lignesAffichees[0];

  if (loading) return <div className="p-6">Chargement de l’analyse...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Analyse des lots</h1>
        <p className="text-sm text-gray-600">
          Comparez les performances de production et les résultats économiques
          des lots archivés.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-full rounded-md bg-gray-100 p-1 md:w-auto">
          <Onglet
            actif={onglet === "production"}
            onClick={() => {
              setOnglet("production");
              setSearchParams({});
            }}
          >
            Production
          </Onglet>
          <Onglet
            actif={onglet === "economie"}
            onClick={() => {
              setOnglet("economie");
              setSearchParams({ onglet: "economie" });
            }}
          >
            Économie
          </Onglet>
        </div>
        <input
          type="search"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher un lot ou un bâtiment"
          className="w-full rounded border p-3 md:max-w-md"
        />
      </div>

      {lignesAffichees.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          Aucun lot ne correspond à cette recherche.
        </div>
      ) : onglet === "production" ? (
        <AnalyseProduction lignes={lignesAffichees} />
      ) : (
        <AnalyseEconomie
          lignes={lignesAffichees}
          lotSelectionne={lotSelectionne}
          onSelection={setLotSelectionneId}
        />
      )}
    </div>
  );
}

function AnalyseProduction({ lignes }: { lignes: LigneAnalyse[] }) {
  const totalInitial = somme(lignes, "quantite");
  const totalMorts = somme(lignes, "nb_morts");
  const totalLivres = somme(lignes, "quantiteLivree");
  const totalPoids = somme(lignes, "total_poids_livre");
  const tauxMortalite =
    totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
  const poidsMoyen = totalLivres > 0 ? totalPoids / totalLivres : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur label="Lots analysés" valeur={lignes.length} />
        <Indicateur label="Sujets initiaux" valeur={totalInitial} />
        <Indicateur label="Sujets livrés" valeur={totalLivres} />
        <Indicateur label="Mortalités" valeur={totalMorts} />
        <Indicateur
          label="Taux de mortalité"
          valeur={`${tauxMortalite.toFixed(1)} %`}
        />
        <Indicateur
          label="Poids livré"
          valeur={`${totalPoids.toFixed(2)} kg`}
        />
        <Indicateur
          label="Poids moyen"
          valeur={`${poidsMoyen.toFixed(2)} kg`}
        />
        <Indicateur
          label="Quantité retenue"
          valeur={somme(lignes, "quantite_retenue")}
        />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">
          Comparaison technique par lot
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={lignes}
              margin={{ top: 10, right: 10, left: 0, bottom: 45 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nom" angle={-35} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantiteLivree" fill="#2563eb" name="Sujets livrés" />
              <Bar dataKey="nb_morts" fill="#dc2626" name="Mortalités" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <TableauLots lignes={lignes} mode="production" />
    </>
  );
}

function AnalyseEconomie({
  lignes,
  lotSelectionne,
  onSelection,
}: {
  lignes: LigneAnalyse[];
  lotSelectionne?: LigneAnalyse;
  onSelection: (id: string) => void;
}) {
  const chiffreAffaires = somme(lignes, "resultat_brut");
  const totalCharges = somme(lignes, "totalCharges");
  const resultat = chiffreAffaires - totalCharges;
  const lignesAvecNet = lignes.filter((lot) => lot.resultat_net != null);
  const resultatNetSaisi = somme(lignesAvecNet, "resultat_net");
  const pieData = lotSelectionne
    ? [
        { name: "Poussins", value: lotSelectionne.chargePoussins },
        { name: "Aliment", value: lotSelectionne.chargeAliments },
        { name: "Ramassage", value: lotSelectionne.chargeRamassage },
        { name: "Livraison", value: lotSelectionne.chargeLivraison },
      ].filter((charge) => charge.value > 0)
    : [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur
          label="Chiffre d’affaires"
          valeur={`${chiffreAffaires.toFixed(2)} €`}
        />
        <Indicateur label="Charges" valeur={`${totalCharges.toFixed(2)} €`} />
        <Indicateur label="Résultat calculé" valeur={`${resultat.toFixed(2)} €`} />
        <Indicateur
          label="Résultat net saisi"
          valeur={
            lignesAvecNet.length
              ? `${resultatNetSaisi.toFixed(2)} €`
              : "Non renseigné"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">
            Répartition des charges du lot
            <select
              value={lotSelectionne?.id || ""}
              onChange={(event) => onSelection(event.target.value)}
              className="mt-1 w-full rounded border p-2 md:max-w-md"
            >
              {lignes.map((lot) => (
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
                    formatter={(value: number) =>
                      `${Number(value).toFixed(2)} €`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">
            Rentabilité par lot
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lignes}
                margin={{ top: 10, right: 10, left: 0, bottom: 45 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nom" angle={-35} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    `${Number(value).toFixed(2)} €`
                  }
                />
                <Legend />
                <Bar
                  dataKey="resultat_brut"
                  fill="#2563eb"
                  name="Chiffre d’affaires"
                />
                <Bar
                  dataKey="totalCharges"
                  fill="#f59e0b"
                  name="Charges"
                />
                <Bar
                  dataKey="resultatCalcule"
                  fill="#059669"
                  name="Résultat"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <TableauLots lignes={lignes} mode="economie" />
    </>
  );
}

function TableauLots({
  lignes,
  mode,
}: {
  lignes: LigneAnalyse[];
  mode: OngletAnalyse;
}) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Détail par lot</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Lot</th>
              <th className="border px-3 py-2 text-left">Bâtiment</th>
              {mode === "production" ? (
                <>
                  <th className="border px-3 py-2 text-right">Livrés</th>
                  <th className="border px-3 py-2 text-right">Mortalités</th>
                  <th className="border px-3 py-2 text-right">Taux</th>
                  <th className="border px-3 py-2 text-right">Poids livré</th>
                  <th className="border px-3 py-2 text-right">Poids moyen</th>
                </>
              ) : (
                <>
                  <th className="border px-3 py-2 text-right">CA</th>
                  <th className="border px-3 py-2 text-right">Charges</th>
                  <th className="border px-3 py-2 text-right">Résultat</th>
                  <th className="border px-3 py-2 text-right">Marge / kg</th>
                  <th className="border px-3 py-2 text-right">Taux charges</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lignes.map((lot) => (
              <tr key={lot.id} className="odd:bg-white even:bg-gray-50">
                <td className="border px-3 py-2 font-medium">{lot.nom}</td>
                <td className="border px-3 py-2">{lot.batiment}</td>
                {mode === "production" ? (
                  <>
                    <td className="border px-3 py-2 text-right">
                      {lot.quantiteLivree}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.nb_morts}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.tauxMortalite.toFixed(1)} %
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {Number(lot.total_poids_livre).toFixed(2)} kg
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.poidsMoyen.toFixed(2)} kg
                    </td>
                  </>
                ) : (
                  <>
                    <td className="border px-3 py-2 text-right">
                      {(Number(lot.resultat_brut) || 0).toFixed(2)} €
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.totalCharges.toFixed(2)} €
                    </td>
                    <td
                      className={`border px-3 py-2 text-right font-semibold ${
                        lot.resultatCalcule < 0 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {lot.resultatCalcule.toFixed(2)} €
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.margeParKg.toFixed(2)} €
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.tauxCharges.toFixed(1)} %
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Onglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-5 py-2 text-sm font-semibold md:flex-none ${
        actif
          ? "!bg-emerald-700 !text-white shadow-sm"
          : "!bg-transparent !text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function Indicateur({
  label,
  valeur,
}: {
  label: string;
  valeur: number | string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{valeur}</div>
    </div>
  );
}

function somme<T extends keyof LigneAnalyse>(
  lignes: LigneAnalyse[],
  cle: T
) {
  return lignes.reduce((total, ligne) => {
    const valeur = ligne[cle];
    return total + (typeof valeur === "number" ? valeur : 0);
  }, 0);
}
