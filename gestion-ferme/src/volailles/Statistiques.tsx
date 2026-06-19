import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import {
  chargerLotsAvecMouvements,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from "./volaillesData";

type LotStatistique = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  mortalites: MortaliteVolaille[];
  nb_morts: number;
  sujets_restants: number;
  resultat_brut: number | null;
  resultat_net: number | null;
  autoconsommation: number;
  quantite_retenue: number;
  total_poids_livre: number;
  livraisons: LivraisonVolaille[];
};

const quantiteLivree = (lot: LotStatistique) =>
  lot.livraisons.reduce(
    (total, livraison) => total + (Number(livraison.quantite) || 0),
    0
  );

export default function Statistiques() {
  const [lots, setLots] = useState<LotStatistique[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await chargerLotsAvecMouvements(false);
        setLots(data as LotStatistique[]);
      } catch (error) {
        console.error("Erreur chargement statistiques:", error);
        toast.error("Les statistiques n'ont pas pu être chargées.");
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  const terme = recherche.trim().toLowerCase();
  const lotsAffiches = lots.filter(
    (lot) =>
      !terme ||
      lot.nom.toLowerCase().includes(terme) ||
      lot.batiment.toLowerCase().includes(terme)
  );

  const totalInitial = lotsAffiches.reduce(
    (total, lot) => total + (Number(lot.quantite) || 0),
    0
  );
  const totalMorts = lotsAffiches.reduce(
    (total, lot) => total + (Number(lot.nb_morts) || 0),
    0
  );
  const totalLivres = lotsAffiches.reduce(
    (total, lot) => total + quantiteLivree(lot),
    0
  );
  const totalRetenu = lotsAffiches.reduce(
    (total, lot) => total + (Number(lot.quantite_retenue) || 0),
    0
  );
  const totalPoidsLivre = lotsAffiches.reduce(
    (total, lot) => total + (Number(lot.total_poids_livre) || 0),
    0
  );
  const totalBrut = lotsAffiches.reduce(
    (total, lot) => total + (Number(lot.resultat_brut) || 0),
    0
  );
  const lotsAvecResultatNet = lotsAffiches.filter(
    (lot) => lot.resultat_net != null
  );
  const totalNet = lotsAvecResultatNet.reduce(
    (total, lot) => total + (Number(lot.resultat_net) || 0),
    0
  );
  const tauxMortalite =
    totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
  const poidsMoyen =
    totalLivres > 0 ? totalPoidsLivre / totalLivres : 0;
  const resultatBrutMoyen =
    lotsAffiches.length > 0 ? totalBrut / lotsAffiches.length : 0;
  const resultatNetMoyen =
    lotsAvecResultatNet.length > 0
      ? totalNet / lotsAvecResultatNet.length
      : null;

  const graphique = lotsAffiches.map((lot) => ({
    nom: lot.nom,
    resultatBrut: Number(lot.resultat_brut) || 0,
    resultatNet:
      lot.resultat_net == null ? 0 : Number(lot.resultat_net) || 0,
  }));

  if (loading) {
    return <div className="p-4">Chargement des statistiques...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Statistiques générales</h1>
        <p className="text-sm text-gray-600">
          Production, mortalité, livraisons et résultats des lots archivés.
        </p>
      </div>

      <input
        type="search"
        value={recherche}
        onChange={(event) => setRecherche(event.target.value)}
        placeholder="Rechercher un lot ou un bâtiment"
        className="w-full rounded border bg-white p-3 md:max-w-md"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Lots archivés" value={lotsAffiches.length} />
        <StatCard label="Sujets initiaux" value={totalInitial} />
        <StatCard label="Sujets livrés" value={totalLivres} />
        <StatCard label="Quantité retenue" value={totalRetenu} />
        <StatCard label="Mortalités" value={totalMorts} />
        <StatCard label="Taux de mortalité" value={`${tauxMortalite.toFixed(1)} %`} />
        <StatCard label="Poids livré" value={`${totalPoidsLivre.toFixed(2)} kg`} />
        <StatCard label="Poids moyen" value={`${poidsMoyen.toFixed(2)} kg`} />
        <StatCard label="Résultat brut" value={`${totalBrut.toFixed(2)} €`} />
        <StatCard
          label="Résultat net"
          value={
            lotsAvecResultatNet.length
              ? `${totalNet.toFixed(2)} €`
              : "Non renseigné"
          }
        />
        <StatCard label="Brut moyen / lot" value={`${resultatBrutMoyen.toFixed(2)} €`} />
        <StatCard
          label="Net moyen / lot"
          value={
            resultatNetMoyen == null
              ? "Non renseigné"
              : `${resultatNetMoyen.toFixed(2)} €`
          }
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Détail par lot</h2>

        <div className="space-y-3 md:hidden">
          {lotsAffiches.length === 0 && <EtatVide />}
          {lotsAffiches.map((lot) => {
            const livres = quantiteLivree(lot);
            const poidsLot = Number(lot.total_poids_livre) || 0;
            const tauxLot =
              lot.quantite > 0 ? (lot.nb_morts / lot.quantite) * 100 : 0;

            return (
              <article key={lot.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div>
                  <h3 className="text-lg font-semibold">{lot.nom}</h3>
                  <p className="text-sm text-gray-600">
                    {lot.batiment} ·{" "}
                    {new Date(`${lot.date_arrivee}T00:00:00`).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Valeur label="Livrés" value={livres} />
                  <Valeur label="Poids" value={`${poidsLot.toFixed(2)} kg`} />
                  <Valeur label="Mortalité" value={`${lot.nb_morts} · ${tauxLot.toFixed(1)} %`} />
                  <Valeur
                    label="Poids moyen"
                    value={`${(livres > 0 ? poidsLot / livres : 0).toFixed(2)} kg`}
                  />
                  <Valeur
                    label="Résultat brut"
                    value={`${(Number(lot.resultat_brut) || 0).toFixed(2)} €`}
                  />
                  <Valeur
                    label="Résultat net"
                    value={
                      lot.resultat_net == null
                        ? "Non renseigné"
                        : `${Number(lot.resultat_net).toFixed(2)} €`
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto rounded border md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Lot</th>
                <th className="border px-3 py-2 text-left">Bâtiment</th>
                <th className="border px-3 py-2 text-right">Livrés</th>
                <th className="border px-3 py-2 text-right">Mortalités</th>
                <th className="border px-3 py-2 text-right">Taux</th>
                <th className="border px-3 py-2 text-right">Poids livré</th>
                <th className="border px-3 py-2 text-right">Poids moyen</th>
                <th className="border px-3 py-2 text-right">Résultat brut</th>
                <th className="border px-3 py-2 text-right">Résultat net</th>
              </tr>
            </thead>
            <tbody>
              {lotsAffiches.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EtatVide />
                  </td>
                </tr>
              )}
              {lotsAffiches.map((lot) => {
                const livres = quantiteLivree(lot);
                const poidsLot = Number(lot.total_poids_livre) || 0;
                return (
                  <tr key={lot.id} className="odd:bg-white even:bg-gray-50">
                    <td className="border px-3 py-2">{lot.nom}</td>
                    <td className="border px-3 py-2">{lot.batiment}</td>
                    <td className="border px-3 py-2 text-right">{livres}</td>
                    <td className="border px-3 py-2 text-right">{lot.nb_morts}</td>
                    <td className="border px-3 py-2 text-right">
                      {lot.quantite > 0
                        ? `${((lot.nb_morts / lot.quantite) * 100).toFixed(1)} %`
                        : "0.0 %"}
                    </td>
                    <td className="border px-3 py-2 text-right">{poidsLot.toFixed(2)} kg</td>
                    <td className="border px-3 py-2 text-right">
                      {(livres > 0 ? poidsLot / livres : 0).toFixed(2)} kg
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {(Number(lot.resultat_brut) || 0).toFixed(2)} €
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {lot.resultat_net == null
                        ? "-"
                        : `${Number(lot.resultat_net).toFixed(2)} €`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {lotsAffiches.length > 0 && (
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Résultats par lot</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={graphique}
                margin={{ top: 10, right: 10, left: 0, bottom: 45 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nom" angle={-35} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `${Number(value).toFixed(2)} €`}
                />
                <Legend />
                <Bar dataKey="resultatBrut" fill="#2563eb" name="Résultat brut" />
                <Bar dataKey="resultatNet" fill="#059669" name="Résultat net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Valeur({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function EtatVide() {
  return (
    <div className="p-8 text-center text-gray-500">
      Aucun lot ne correspond à cette recherche.
    </div>
  );
}
