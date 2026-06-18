import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { chargerLotsAvecMouvements, type LivraisonVolaille } from './volaillesData';


  type LotVolailles = {
    id: string;
    nom: string;
    quantite: number;
    date_arrivee: string;
    batiment: string;
    mortalites: any;
    evenements: any;
    couleur: string;
    age: number;
    is_active: boolean;
    nb_morts: number;
    sujets_restants: number;
    facture_date: string;
    resultat_brut: number;
    resultat_net: number;
    autoconsommation: number;
    prix_vente_kg: number;
    prix_poussins: number;
    quantite_retenue: number;
    total_poids_livre: number;
    livraisons: LivraisonVolaille[];
  };

export default function Statistiques() {
  const [lots, setLots] = useState<LotVolailles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await chargerLotsAvecMouvements(false);
        setLots(data as LotVolailles[]);
      } catch (error) {
        console.error('Erreur chargement statistiques:', error);
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  const totalLots = lots.length;
  const totalLivres = lots.reduce(
    (acc, lot) => acc + lot.livraisons.reduce((total, livraison) => total + livraison.quantite, 0),
    0
  );
  const totalRetenu = lots.reduce((acc, lot) => acc + (lot.quantite_retenue || 0), 0);
  const totalBrut = lots.reduce((acc, lot) => acc + (lot.resultat_brut || 0), 0);
  const totalNet = lots.reduce((acc, lot) => acc + (lot.resultat_net || 0), 0);
  const totalPoidsLivre = lots.reduce((acc, lot) => acc + (lot.total_poids_livre || 0), 0);


  const moyenneBrut = totalLots ? (totalBrut / totalLots) : 0;
  const moyenneNet = totalLots ? (totalNet / totalLots) : 0;

  if (loading) return <div className="p-4">Chargement des statistiques...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Statistiques Générales</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Nombre de lots" value={totalLots} />
        <StatCard label="Total sujets livrés" value={totalLivres} />
        <StatCard label="Quantité retenue" value={totalRetenu} />
        <StatCard label="Résultat brut (€)" value={totalBrut.toFixed(2)} />
        <StatCard label="Résultat net (€)" value={totalNet.toFixed(2)} />
        <StatCard label="Poids total livré (kg)" value={totalPoidsLivre.toFixed(2)} /> 
        <StatCard label="Résultat brut moyen" value={moyenneBrut.toFixed(2)} />
        <StatCard label="Résultat net moyen" value={moyenneNet.toFixed(2)} />
      </div>

      <h2 className="text-xl font-semibold mb-2">Détail par lot</h2>
      <div className="overflow-auto">
        <table className="min-w-full text-sm border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Nom du lot</th>
              <th className="border px-3 py-2 text-right">Sujets livrés</th>
              <th className="border px-3 py-2 text-right">Quantité retenue</th>
              <th className="border px-3 py-2 text-right">Poids total livré (kg)</th>
              <th className="border px-3 py-2 text-right">Résultat brut (€)</th>
              <th className="border px-3 py-2 text-right">Résultat net (€)</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="odd:bg-white even:bg-gray-50">
                <td className="border px-3 py-2">{lot.nom}</td>
                <td className="border px-3 py-2 text-right">
                  {lot.livraisons.reduce((total, livraison) => total + livraison.quantite, 0)}
                </td>
                <td className="border px-3 py-2 text-right">{lot.quantite_retenue || 0}</td>
                <td className="border px-3 py-2 text-right">{(lot.total_poids_livre || 0).toFixed(2)}</td> 
                <td className="border px-3 py-2 text-right">{lot.resultat_brut?.toFixed(2) || '-'}</td>
                <td className="border px-3 py-2 text-right">{lot.resultat_net?.toFixed(2) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-semibold mt-10 mb-2">Graphique des Résultats par Lot</h2>
<div className="w-full h-96 bg-white border rounded shadow p-4">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={lots.map(lot => ({
      nom: lot.nom,
      resultat_brut: lot.resultat_brut || 0,
      resultat_net: lot.resultat_net || 0,
    }))}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="nom" angle={-45} textAnchor="end" height={80} />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="resultat_brut" fill="#8884d8" name="Résultat brut (€)" />
      <Bar dataKey="resultat_net" fill="#82ca9d" name="Résultat net (€)" />
    </BarChart>
  </ResponsiveContainer>
</div>

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white shadow rounded p-4 text-center border border-gray-200">
      <div className="text-gray-500 text-sm">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
