import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardContent, Typography, MenuItem, Select, InputLabel, FormControl } from "@mui/material";


export default function TableauDeBordEconomie() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);

  useEffect(() => {
    const fetchEconomyData = async () => {
      const { data: lots, error: lotsError } = await supabase
        .from("lots_volailles")
        .select("id, nom, quantite, sujets_restants, total_poids_livre, resultat_brut, resultat_net")
        .eq("is_active", false);

      if (lotsError) {
        console.error("Erreur chargement lots:", lotsError.message);
        setLoading(false);
        return;
      }

      const { data: charges, error: chargesError } = await supabase
        .from("charges")
        .select("lot_id, type_charge, montant");

      if (chargesError) {
        console.error("Erreur chargement charges:", chargesError.message);
        setLoading(false);
        return;
      }

      const tableau = lots.map((lot: any) => {
        const totalVendu = lot.total_poids_livre || 0;
        const chiffreAffaires = lot.resultat_brut || 0;
        const resultatNet = lot.resultat_net || 0;


        const lotCharges = charges.filter(c => c.lot_id === lot.id);

        const chargePoussins = lotCharges.filter(c => c.type_charge === "achat_poussins").reduce((sum, c) => sum + Number(c.montant), 0);
        const chargeAliments = lotCharges.filter(c => c.type_charge === "aliment").reduce((sum, c) => sum + Number(c.montant), 0);
        const chargeRamassage = lotCharges.filter(c => c.type_charge === "ramassage").reduce((sum, c) => sum + Number(c.montant), 0);
        const chargeLivraison = lotCharges.filter(c => c.type_charge === "livraison").reduce((sum, c) => sum + Number(c.montant), 0);

        const totalCharges = chargePoussins + chargeAliments + chargeRamassage + chargeLivraison;
        const margeBrute = chiffreAffaires - totalCharges;
        const margeParKg = totalVendu ? margeBrute / totalVendu : 0;

        const chargesLot = charges
          .filter((c) => c.lot_id === lot.id)
          .reduce((sum, c) => sum + (c.montant || 0), 0);

          // 🔢 Calcul des indicateurs
        const rentabiliteKg = totalVendu > 0 ? resultatNet / totalVendu : 0;

        const quantiteInitiale = lot.quantite ?? 0;
        const sujetsRestants = lot.sujets_restants ?? 0;
        
        const tauxMortalite = quantiteInitiale > 0
          ? ((quantiteInitiale - sujetsRestants) / quantiteInitiale)
          : 0;

        const tauxCharges = chiffreAffaires > 0 ? chargesLot / chiffreAffaires : 0;

        // 🧠 Score sur 100 points
        const score = Math.max(0,
          (
            (Math.min(rentabiliteKg, 3) / 3) * 40 + // 40% : max 3€/kg
            ((1 - Math.min(tauxMortalite, 0.3)) / 1) * 30 + // 30% : si <30%
            ((1 - Math.min(tauxCharges, 1)) / 1) * 30        // 30% : si charges < 100%
          )
        );

        return {
          id: lot.id,
          nom: lot.nom,
          totalVendu,
          chiffreAffaires,
          chargePoussins,
          chargeAliments,
          chargeRamassage,
          chargeLivraison,
          totalCharges,
          margeBrute,
          margeParKg: margeParKg.toFixed(2),
          rentabiliteKg: rentabiliteKg.toFixed(2),
          tauxMortalite: (tauxMortalite * 100).toFixed(1),
          tauxCharges: (tauxCharges * 100).toFixed(1),
          score: score.toFixed(0)
        };
      });

      // tri des lots par marge brute décroissante
      const sortedData = tableau.sort((a, b) => b.margeBrute - a.margeBrute);
      setData(sortedData);
      if (sortedData.length > 0) setSelectedLot(sortedData[0].id); 
      setLoading(false);
    };

    fetchEconomyData();
  }, []);

  if (loading) return <div className="p-4">Chargement...</div>;

  const lotSelectionne = data.find(lot => lot.id === selectedLot);
  const COLORS = ["#60a5fa", "#facc15", "#f87171", "#34d399"]; 
  const pieData = lotSelectionne
  ? [
      {
        name: "Poussins",
        value: lotSelectionne.chargePoussins,
        percent: lotSelectionne.chiffreAffaires
          ? (lotSelectionne.chargePoussins / lotSelectionne.chiffreAffaires) * 100
          : 0,
      },
      {
        name: "Aliments",
        value: lotSelectionne.chargeAliments,
        percent: lotSelectionne.chiffreAffaires
          ? (lotSelectionne.chargeAliments / lotSelectionne.chiffreAffaires) * 100
          : 0,
      },
      {
        name: "Ramassage",
        value: lotSelectionne.chargeRamassage,
        percent: lotSelectionne.chiffreAffaires
          ? (lotSelectionne.chargeRamassage / lotSelectionne.chiffreAffaires) * 100
          : 0,
      },
      {
        name: "Livraison",
        value: lotSelectionne.chargeLivraison,
        percent: lotSelectionne.chiffreAffaires
          ? (lotSelectionne.chargeLivraison / lotSelectionne.chiffreAffaires) * 100
          : 0,
      },
    ]
  : [];


  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold">Tableau de bord économique</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((lot) => (
          <Card key={lot.id} variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>{lot.nom}</Typography>
              <Typography variant="body2" fontWeight="bold">Total vendu : {lot.totalVendu} kg</Typography>
              <Typography variant="body2">Chiffre d'affaires : {lot.chiffreAffaires.toFixed(2)} €</Typography>
              <Typography variant="body2">Charges poussins : {lot.chargePoussins.toFixed(2)} €</Typography>
              <Typography variant="body2">Charges aliments : {lot.chargeAliments.toFixed(2)} €</Typography>
              <Typography variant="body2">Ramassage : {lot.chargeRamassage.toFixed(2)} €</Typography>
              <Typography variant="body2">Livraison : {lot.chargeLivraison.toFixed(2)} €</Typography>
              <Typography variant="body2" fontWeight="bold">
                Total charges : {lot.totalCharges.toFixed(2)} €
              </Typography>
              <Typography variant="body2" fontWeight="bold" >Marge brute : {lot.margeBrute.toFixed(2)} €</Typography>
              <Typography variant="body2">Marge / kg : {lot.margeParKg} €</Typography>
              <Typography variant="body2">Rentabilité / kg : {lot.rentabiliteKg} €</Typography>
              <Typography variant="body2">Taux de mortalité : {lot.tauxMortalite} %</Typography>
              <Typography variant="body2">Taux de charges : {lot.tauxCharges} %</Typography>
              <Typography variant="h6" className="mt-2 text-green-600">Score performance : {lot.score} / 100</Typography>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <FormControl fullWidth>
          <InputLabel id="select-lot-label">Voir charges du lot</InputLabel>
          <Select
            labelId="select-lot-label"
            value={selectedLot ?? ""}
            onChange={(e) => setSelectedLot(e.target.value)}
          >
            {data.map((lot) => (
              <MenuItem key={lot.id} value={lot.id}>
                {lot.nom}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
        <Pie
      data={pieData}
      dataKey="value"
      cx="50%"
      cy="50%"
      outerRadius={110}
      label={({ name, value }) => {
        const percent =
          lotSelectionne?.chiffreAffaires && value !== undefined
            ? (value / lotSelectionne.chiffreAffaires) * 100
            : 0;
        return `${name} - ${(value ?? 0).toFixed(2)}€ (${percent.toFixed(1)}%)`;
      }}
    >
      {pieData.map((_, index) => (
  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
))}

    </Pie>
          <Legend />
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              const percent = props.payload.percent;
              return [`${value.toFixed(2)} € (${percent.toFixed(1)}%)`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>

        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
          >
            <XAxis dataKey="nom" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="margeBrute" fill="#10b981" name="Marge brute (€)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
