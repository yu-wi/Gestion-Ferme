import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'


interface Lot {
  id: string
  nom?: string
  quantite: number
  age: number
}

interface FeedReference {
  feed_type: string
  daily_consumption_g: number
  age_min_days: number
  age_max_days: number
  feed_price_ht?: number
}

type WeekRow = {
  weekLabel: string
  feedType: string
  kg: number
  sacs: number
  cost: number
}

export default function DashboardFeedForecast10Weeks(): JSX.Element {
  const [lots, setLots] = useState<Lot[]>([])
  const [references, setReferences] = useState<FeedReference[]>([])
  const [selectedLotId, setSelectedLotId] = useState<string | "">("")
  const [forecastRows, setForecastRows] = useState<WeekRow[]>([])
  const [loading, setLoading] = useState(true)

  const SAC_KG = 20
  const WEEKS = 10
  const DAYS_PER_WEEK = 7

  // États pour simulation lot type
  const [customLotQty, setCustomLotQty] = useState<number>(1800)
  const [customLotAge, setCustomLotAge] = useState<number>(1)
  const [useCustomLot, setUseCustomLot] = useState(false)

  // Chargement des données Supabase
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: lotsData } = await supabase
        .from("lots_volailles")
        .select("id, nom, quantite, age")
        .eq("is_active", true)

      const { data: refsData } = await supabase.from("feed_reference").select("*")

      setLots(lotsData || [])
      setReferences(refsData || [])
      setLoading(false)
    }
    load()
  }, [])

  // Calcul prévisionnel pour un lot réel
  useEffect(() => {
    if (!selectedLotId || selectedLotId === "custom") {
      setForecastRows([])
      return
    }

    const lot = lots.find(l => l.id === selectedLotId)
    if (!lot) return

    const rows: WeekRow[] = []

    for (let i = 0; i < WEEKS; i++) {
      const startAge = lot.age + i * DAYS_PER_WEEK
      const endAge = startAge + DAYS_PER_WEEK - 1
      const avgAge = (startAge + endAge) / 2

      const ref = references.find(
        r => avgAge >= r.age_min_days && avgAge <= r.age_max_days
      )

      if (ref) {
        const kg = (ref.daily_consumption_g * DAYS_PER_WEEK * lot.quantite) / 1000
        const sacs = Math.ceil(kg / SAC_KG)
        const cost = sacs * (ref.feed_price_ht ?? 0)

        rows.push({
          weekLabel: `${i * 7 + 1} - ${i * 7 + 7}`,
          feedType: ref.feed_type,
          kg,
          sacs,
          cost,
        })
      } else {
        rows.push({
          weekLabel: `${i * 7 + 1} - ${i * 7 + 7}`,
          feedType: "-",
          kg: 0,
          sacs: 0,
          cost: 0,
        })
      }
    }

    setForecastRows(rows)
  }, [selectedLotId, lots, references])

  // Calcul prévisionnel pour le lot type simulé
  useEffect(() => {
    if (!useCustomLot) return

    const rows: WeekRow[] = []

    for (let i = 0; i < WEEKS; i++) {
      const startAge = customLotAge + i * DAYS_PER_WEEK
      const endAge = startAge + DAYS_PER_WEEK - 1
      const avgAge = (startAge + endAge) / 2

      const ref = references.find(
        r => avgAge >= r.age_min_days && avgAge <= r.age_max_days
      )

      if (ref) {
        const kg = (ref.daily_consumption_g * DAYS_PER_WEEK * customLotQty) / 1000
        const sacs = Math.ceil(kg / SAC_KG)
        const cost = sacs * (ref.feed_price_ht ?? 0)

        rows.push({
          weekLabel: `${i * 7 + 1} - ${i * 7 + 7}`,
          feedType: ref.feed_type,
          kg,
          sacs,
          cost,
        })
      } else {
        rows.push({
          weekLabel: `${i * 7 + 1} - ${i * 7 + 7}`,
          feedType: "-",
          kg: 0,
          sacs: 0,
          cost: 0,
        })
      }
    }

    setForecastRows(rows)
  }, [useCustomLot, customLotQty, customLotAge, references])

  const totalKg = forecastRows.reduce((sum, r) => sum + r.kg, 0)
  const totalSacs = forecastRows.reduce((sum, r) => sum + r.sacs, 0)
  const totalCost = forecastRows.reduce((sum, r) => sum + r.cost, 0)

  if (loading) return <p>Chargement...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prévision de charge - 10 semaines</h1>

      {/* Sélecteur de lot */}
      <div className="bg-white p-4 border rounded shadow max-w-3xl">
        <label className="block font-medium mb-2">Sélectionnez un lot</label>
        <select
          value={selectedLotId}
          onChange={(e) => {
            setSelectedLotId(e.target.value)
            setUseCustomLot(false)
          }}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="">-- Choisir un lot --</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>
              {l.nom ?? `Lot ${l.id}`} — {l.quantite} sujets — âge {l.age}j
            </option>
          ))}
          <option value="custom">Simulation lot type</option>
        </select>
      </div>

      {/* Formulaire simulation lot type */}
      {selectedLotId === "custom" && (
        <div className="bg-white p-4 border rounded shadow max-w-3xl">
          <h2 className="font-medium mb-2">Simulation pour un lot type</h2>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block mb-1">Nombre de poussins</label>
              <input
                type="number"
                value={customLotQty}
                min={1}
                onChange={(e) => setCustomLotQty(Number(e.target.value))}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block mb-1">Âge initial (jours)</label>
              <input
                type="number"
                value={customLotAge}
                min={1}
                onChange={(e) => setCustomLotAge(Number(e.target.value))}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div>
              <button
                onClick={() => setUseCustomLot(true)}
                className="bg-blue-600 text-black px-4 py-2 rounded"
              >
                Calculer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau de prévision */}
      {(selectedLotId && (selectedLotId !== "custom" || useCustomLot)) && (
        <div className="bg-white p-4 border rounded shadow max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold mb-3">
            Prévision sur 10 semaines {selectedLotId === "custom" ? "pour le lot type" : "pour le lot sélectionné"}
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2 text-left">Semaine</th>
                  <th className="border px-4 py-2 text-left">Type d'aliment</th>
                  <th className="border px-4 py-2 text-right">Quantité (kg)</th>
                  <th className="border px-4 py-2 text-right">Quantité (sacs)</th>
                  <th className="border px-4 py-2 text-right">Coût (€)</th>
                </tr>
              </thead>
              <tbody>
                {forecastRows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="border px-4 py-2">{r.weekLabel}</td>
                    <td className="border px-4 py-2">{r.feedType}</td>
                    <td className="border px-4 py-2 text-right">{r.kg.toFixed(2)}</td>
                    <td className="border px-4 py-2 text-right">{r.sacs}</td>
                    <td className="border px-4 py-2 text-right">{r.cost.toFixed(2)}</td>
                  </tr>
                ))}

                <tr className="border-t font-semibold bg-gray-50">
                  <td className="border px-4 py-2">TOTAL</td>
                  <td className="border px-4 py-2">—</td>
                  <td className="border px-4 py-2 text-right">{totalKg.toFixed(2)}</td>
                  <td className="border px-4 py-2 text-right">{totalSacs}</td>
                  <td className="border px-4 py-2 text-right">{totalCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedLotId && <p className="text-black text-gray-600">Sélectionnez un lot pour voir la prévision.</p>}
    </div>
  )
}
