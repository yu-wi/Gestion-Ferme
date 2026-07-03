import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { formatDateCourte, formatNombre } from "../outils/formatNombre";

type InventoryCategory = "feed" | "sica" | "direct";
type InventoryUnit = "sacs" | "sujets";
type InventoryTab = "annuel" | "graphique";

type InventorySnapshot = {
  id: string;
  snapshot_date: string;
  category: InventoryCategory;
  source_id: string;
  group_label: string;
  item_label: string;
  quantity: number;
  unit: InventoryUnit;
  created_at: string;
};

type InventoryRow = {
  key: string;
  category: InventoryCategory;
  groupLabel: string;
  itemLabel: string;
  unit: InventoryUnit;
  values: Record<string, number>;
};

type FeedReference = {
  feed_type: string;
  feed_price_ht: number | null;
};

type SicaLotReference = {
  id: string;
  date_arrivee: string;
};

type DirectLotReference = {
  id: string;
  species: "poulet" | "pintade";
  arrival_date: string;
};

type InventoryValueRow = {
  monthKey: string;
  feedValue: number;
  poultryValue: number;
  totalValue: number;
};

type InventoryValueDetailRow = {
  id: string;
  category: InventoryCategory;
  product: string;
  quantityLabel: string;
  referenceLabel: string;
  value: number;
};

const MONTH_LABELS = [
  "31 janv.",
  "28 fev.",
  "31 mars",
  "30 avr.",
  "31 mai",
  "30 juin",
  "31 juil.",
  "31 aout",
  "30 sept.",
  "31 oct.",
  "30 nov.",
  "31 dec.",
];

const FEED_ORDER = ["starter", "croissance", "finition"];
type PoultryValueProfile = "sicaPoulet" | "directPoulet" | "pintade";

const POULTRY_VALUE_PROFILES: Record<
  PoultryValueProfile,
  { priceKg: number; weights: Array<{ day: number; weightG: number }> }
> = {
  sicaPoulet: {
    priceKg: 3.5,
    weights: [
      { day: 0, weightG: 40 },
      { day: 7, weightG: 160 },
      { day: 14, weightG: 380 },
      { day: 21, weightG: 700 },
      { day: 28, weightG: 1000 },
      { day: 35, weightG: 1300 },
      { day: 42, weightG: 1550 },
      { day: 49, weightG: 1750 },
      { day: 56, weightG: 1900 },
      { day: 63, weightG: 2000 },
      { day: 70, weightG: 2100 },
    ],
  },
  directPoulet: {
    priceKg: 8.5,
    weights: [
      { day: 0, weightG: 40 },
      { day: 7, weightG: 160 },
      { day: 14, weightG: 380 },
      { day: 21, weightG: 700 },
      { day: 28, weightG: 1000 },
      { day: 35, weightG: 1300 },
      { day: 42, weightG: 1550 },
      { day: 49, weightG: 1750 },
      { day: 56, weightG: 1900 },
      { day: 63, weightG: 2000 },
      { day: 70, weightG: 2000 },
    ],
  },
  pintade: {
    priceKg: 11,
    weights: [
      { day: 0, weightG: 30 },
      { day: 7, weightG: 80 },
      { day: 14, weightG: 170 },
      { day: 21, weightG: 300 },
      { day: 28, weightG: 450 },
      { day: 35, weightG: 620 },
      { day: 42, weightG: 780 },
      { day: 49, weightG: 920 },
      { day: 56, weightG: 1040 },
      { day: 63, weightG: 1150 },
      { day: 70, weightG: 1240 },
      { day: 77, weightG: 1300 },
      { day: 84, weightG: 1360 },
      { day: 90, weightG: 1400 },
    ],
  },
};

const monthEndIso = (year: number, monthIndex: number) => {
  const date = new Date(year, monthIndex + 1, 0);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const currentMonthEndIso = () => {
  const date = new Date();
  return monthEndIso(date.getFullYear(), date.getMonth());
};

const snapshotMonthEndIso = (snapshotDate: string) => {
  const [year, month] = snapshotDate.split("-").map(Number);
  return monthEndIso(year, month - 1);
};

const daysBetween = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return 0;
  return Math.max(
    0,
    Math.floor(
      (new Date(`${endDate}T00:00:00`).getTime() -
        new Date(`${startDate}T00:00:00`).getTime()) /
        86400000
    )
  );
};

const getPoultryValueProfile = (
  category: InventoryCategory,
  species?: "poulet" | "pintade"
): PoultryValueProfile => {
  if (category === "direct" && species === "pintade") return "pintade";
  if (category === "direct") return "directPoulet";
  return "sicaPoulet";
};

const estimateWeightKg = (profile: PoultryValueProfile, ageDays: number) => {
  const references = POULTRY_VALUE_PROFILES[profile].weights;
  const first = references[0];
  const last = references[references.length - 1];
  if (ageDays <= first.day) return first.weightG / 1000;
  if (ageDays >= last.day) return last.weightG / 1000;

  for (let index = 1; index < references.length; index += 1) {
    const previous = references[index - 1];
    const next = references[index];
    if (ageDays <= next.day) {
      const ratio = (ageDays - previous.day) / (next.day - previous.day);
      return (previous.weightG + (next.weightG - previous.weightG) * ratio) / 1000;
    }
  }

  return last.weightG / 1000;
};

const profileLabel = (profile: PoultryValueProfile) => {
  if (profile === "directPoulet") return "Poulet vente directe";
  if (profile === "pintade") return "Pintade";
  return "Poulet SICA";
};

function PoultrySubnav() {
  return (
    <nav className="poultry-tabs" aria-label="Sections volailles">
      <Link to="/volailles">Résumé</Link>
      <Link to="/volailles/sica">Lots SICA Madras</Link>
      <Link to="/volailles/sica/historique">Historique SICA</Link>
      <Link to="/volailles/vente-directe">Vente directe</Link>
      <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
      <Link to="/volailles/alimentation">Alimentation</Link>
      <Link to="/volailles/analyse/sica">Analyse SICA</Link>
      <Link to="/volailles/analyse/vente-directe">Analyse vente directe</Link>
      <Link to="/volailles/inventaire" className="poultry-tab-active">Inventaire</Link>
    </nav>
  );
}

export default function Inventaire() {
  const currentYear = new Date().getFullYear();
  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [tab, setTab] = useState<InventoryTab>("annuel");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(true);
  const [feedReferences, setFeedReferences] = useState<FeedReference[]>([]);
  const [sicaLotReferences, setSicaLotReferences] = useState<SicaLotReference[]>([]);
  const [directLotReferences, setDirectLotReferences] = useState<DirectLotReference[]>([]);

  const chargerInventaires = async () => {
    setLoading(true);
    const [inventoryResult, feedResult, sicaResult, directResult] = await Promise.all([
      supabase
      .from("monthly_inventory_snapshots")
      .select("id, snapshot_date, category, source_id, group_label, item_label, quantity, unit, created_at")
      .order("snapshot_date", { ascending: false })
        .order("group_label", { ascending: true }),
      supabase
        .from("feed_reference")
        .select("feed_type, feed_price_ht")
        .order("age_min_days", { ascending: false }),
      supabase
        .from("lots_volailles")
        .select("id, date_arrivee"),
      supabase
        .from("direct_sale_lots")
        .select("id, species, arrival_date"),
    ]);

    if (inventoryResult.error) {
      console.error("Erreur chargement inventaire :", inventoryResult.error);
      setDatabaseReady(false);
      setSnapshots([]);
    } else {
      setDatabaseReady(true);
      setSnapshots(
        (inventoryResult.data || []).map((row) => ({
          ...row,
          category: row.category as InventoryCategory,
          quantity: Number(row.quantity) || 0,
          unit: row.unit as InventoryUnit,
        }))
      );
    }

    if (!feedResult.error) {
      setFeedReferences(
        (feedResult.data || []).map((reference) => ({
          feed_type: reference.feed_type,
          feed_price_ht: reference.feed_price_ht == null ? null : Number(reference.feed_price_ht),
        }))
      );
    }
    if (!sicaResult.error) setSicaLotReferences((sicaResult.data || []) as SicaLotReference[]);
    if (!directResult.error) setDirectLotReferences((directResult.data || []) as DirectLotReference[]);
    setLoading(false);
  };

  useEffect(() => {
    chargerInventaires();
  }, []);

  const years = useMemo(() => {
    const snapshotYears = snapshots.map((snapshot) =>
      Number(snapshot.snapshot_date.slice(0, 4))
    );
    return Array.from(new Set([currentYear, ...snapshotYears]))
      .filter(Boolean)
      .sort((a, b) => b - a);
  }, [currentYear, snapshots]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        key: monthEndIso(selectedYear, index),
        label: MONTH_LABELS[index],
      })),
    [selectedYear]
  );

  const rows = useMemo(() => {
    const grouped = new Map<string, InventoryRow>();
    snapshots
      .filter((snapshot) => snapshot.snapshot_date.startsWith(String(selectedYear)))
      .forEach((snapshot) => {
        const key = `${snapshot.category}-${snapshot.group_label}-${snapshot.item_label}`;
        const existing =
          grouped.get(key) ||
          ({
            key,
            category: snapshot.category,
            groupLabel: snapshot.group_label,
            itemLabel: snapshot.item_label,
            unit: snapshot.unit,
            values: {},
          } satisfies InventoryRow);
        const monthKey = snapshotMonthEndIso(snapshot.snapshot_date);
        if (existing.values[monthKey] == null) {
          existing.values[monthKey] = snapshot.quantity;
        }
        grouped.set(key, existing);
      });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.category === "feed" && b.category === "feed") {
        const aIndex = FEED_ORDER.indexOf(a.itemLabel.toLowerCase());
        const bIndex = FEED_ORDER.indexOf(b.itemLabel.toLowerCase());
        if (aIndex !== bIndex) return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
      }
      return `${a.groupLabel} ${a.itemLabel}`.localeCompare(`${b.groupLabel} ${b.itemLabel}`);
    });
  }, [selectedYear, snapshots]);

  const feedRows = rows.filter((row) => row.category === "feed");
  const poultryRows = rows.filter((row) => row.category !== "feed");
  const totalPoultryRow = useMemo<InventoryRow>(() => {
    const values = months.reduce<Record<string, number>>((total, month) => {
      total[month.key] = poultryRows.reduce((sum, row) => sum + (row.values[month.key] || 0), 0);
      return total;
    }, {});
    return {
      key: "total-poultry",
      category: "sica",
      groupLabel: "Total",
      itemLabel: "Total tous lots",
      unit: "sujets",
      values,
    };
  }, [months, poultryRows]);
  const feedPriceByType = useMemo(() => {
    const prices = new Map<string, number>();
    feedReferences.forEach((reference) => {
      const key = reference.feed_type.toLowerCase();
      if (!prices.has(key) && reference.feed_price_ht != null) {
        prices.set(key, reference.feed_price_ht);
      }
    });
    return prices;
  }, [feedReferences]);
  const sicaLotById = useMemo(
    () => new Map(sicaLotReferences.map((lot) => [lot.id, lot])),
    [sicaLotReferences]
  );
  const directLotById = useMemo(
    () => new Map(directLotReferences.map((lot) => [lot.id, lot])),
    [directLotReferences]
  );
  const valueRows = useMemo<InventoryValueRow[]>(
    () =>
      months.map((month) => {
        const monthSnapshots = snapshots.filter(
          (snapshot) =>
            snapshot.snapshot_date.startsWith(String(selectedYear)) &&
            snapshotMonthEndIso(snapshot.snapshot_date) === month.key
        );
        const feedValue = monthSnapshots
          .filter((snapshot) => snapshot.category === "feed")
          .reduce((total, snapshot) => {
            const price = feedPriceByType.get(snapshot.item_label.toLowerCase()) || 0;
            return total + snapshot.quantity * price;
          }, 0);
        const poultryValue = monthSnapshots
          .filter((snapshot) => snapshot.category === "sica" || snapshot.category === "direct")
          .reduce((total, snapshot) => {
            const isDirect = snapshot.category === "direct";
            const directLot = isDirect ? directLotById.get(snapshot.source_id) : null;
            const sicaLot = !isDirect ? sicaLotById.get(snapshot.source_id) : null;
            const arrivalDate = directLot?.arrival_date || sicaLot?.date_arrivee;
            if (!arrivalDate) return total;
            const age = daysBetween(arrivalDate, snapshot.snapshot_date);
            const profile = getPoultryValueProfile(snapshot.category, directLot?.species);
            const estimatedWeight = estimateWeightKg(profile, age);
            const priceKg = POULTRY_VALUE_PROFILES[profile].priceKg;
            return total + snapshot.quantity * estimatedWeight * priceKg;
          }, 0);

        return {
          monthKey: month.key,
          feedValue,
          poultryValue,
          totalValue: feedValue + poultryValue,
        };
      }),
    [directLotById, feedPriceByType, months, selectedYear, sicaLotById, snapshots]
  );
  const latestValueRow = [...valueRows].reverse().find((row) => row.totalValue > 0);
  const dernierInventaire = snapshots[0];
  const latestSnapshotDate = dernierInventaire?.snapshot_date;
  const latestValueDetails = useMemo<InventoryValueDetailRow[]>(() => {
    if (!latestSnapshotDate) return [];
    return snapshots
      .filter((snapshot) => snapshot.snapshot_date === latestSnapshotDate)
      .map((snapshot) => {
        if (snapshot.category === "feed") {
          const price = feedPriceByType.get(snapshot.item_label.toLowerCase()) || 0;
          return {
            id: snapshot.id,
            category: snapshot.category,
            product: snapshot.item_label,
            quantityLabel: `${formatNombre(snapshot.quantity)} sacs`,
            referenceLabel: `${formatNombre(price, 2)} €/sac`,
            value: snapshot.quantity * price,
          };
        }

        const isDirect = snapshot.category === "direct";
        const directLot = isDirect ? directLotById.get(snapshot.source_id) : null;
        const sicaLot = !isDirect ? sicaLotById.get(snapshot.source_id) : null;
        const arrivalDate = directLot?.arrival_date || sicaLot?.date_arrivee;
        const profile = getPoultryValueProfile(snapshot.category, directLot?.species);
        const age = arrivalDate ? daysBetween(arrivalDate, snapshot.snapshot_date) : 0;
        const estimatedWeight = estimateWeightKg(profile, age);
        const priceKg = POULTRY_VALUE_PROFILES[profile].priceKg;

        return {
          id: snapshot.id,
          category: snapshot.category,
          product: `${snapshot.group_label} · ${snapshot.item_label}`,
          quantityLabel: `${formatNombre(snapshot.quantity)} sujets`,
          referenceLabel: `${profileLabel(profile)} · ${formatNombre(estimatedWeight, 2)} kg · ${formatNombre(priceKg, 2)} €/kg`,
          value: snapshot.quantity * estimatedWeight * priceKg,
        };
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.product.localeCompare(b.product);
      });
  }, [directLotById, feedPriceByType, latestSnapshotDate, sicaLotById, snapshots]);

  const enregistrerMaintenant = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("capture_monthly_inventory", {
      p_snapshot_date: currentMonthEndIso(),
    });

    if (error) {
      console.error("Erreur enregistrement inventaire :", error);
      toast.error("L'inventaire n'a pas pu être enregistré. Vérifiez le script Supabase.");
    } else {
      toast.success("Inventaire enregistré.");
      await chargerInventaires();
    }
    setSaving(false);
  };

  const exporterCsv = () => {
    const rowsToExport = snapshots.filter((snapshot) =>
      snapshot.snapshot_date.startsWith(String(selectedYear))
    );
    if (!rowsToExport.length) {
      toast("Aucune donnée à exporter pour cette année.");
      return;
    }

    const header = ["date", "categorie", "groupe", "libelle", "quantite", "unite"];
    const lines = rowsToExport.map((snapshot) =>
      [
        snapshot.snapshot_date,
        snapshot.category,
        snapshot.group_label,
        snapshot.item_label,
        String(snapshot.quantity).replace(".", ","),
        snapshot.unit,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(";")
    );
    const blob = new Blob([[header.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventaire-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="inventory-page">
      <header className="inventory-heading">
        <div>
          <span className="inventory-heading-icon">□</span>
          <div>
            <h1>Inventaire annuel</h1>
            <p>Inventaire automatique des stocks d’aliment et des sujets restants en fin de mois.</p>
            {dernierInventaire && (
              <span className="inventory-last">
                Dernier inventaire : {formatDateCourte(new Date(`${dernierInventaire.snapshot_date}T00:00:00`))}
              </span>
            )}
          </div>
        </div>
        <div className="inventory-actions">
          <button type="button" onClick={enregistrerMaintenant} disabled={saving || !databaseReady}>
            {saving ? "Enregistrement..." : "Enregistrer maintenant"}
          </button>
          <button type="button" className="inventory-export" onClick={exporterCsv}>
            Exporter
          </button>
        </div>
      </header>

      <PoultrySubnav />

      <section className="inventory-tabs" aria-label="Vues inventaire">
        <button type="button" className={tab === "annuel" ? "inventory-tab-active" : ""} onClick={() => setTab("annuel")}>
          Vue annuelle
        </button>
        <button type="button" className={tab === "graphique" ? "inventory-tab-active" : ""} onClick={() => setTab("graphique")}>
          Vue graphique
        </button>
      </section>

      <section className="inventory-toolbar">
        <label>
          Année
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
        <div className="inventory-info">
          Les données sont enregistrées automatiquement à 23h59 le dernier jour de chaque mois.
          <span>Vous pouvez aussi lancer un inventaire manuel avant une clôture ou une vérification.</span>
        </div>
      </section>

      {!databaseReady ? (
        <section className="inventory-warning">
          La table d’inventaire n’est pas encore installée dans Supabase. Exécutez le fichier
          <strong> supabase/inventaire-mensuel.sql</strong>, puis rechargez cette page.
        </section>
      ) : loading ? (
        <section className="inventory-empty">Chargement de l’inventaire...</section>
      ) : tab === "annuel" ? (
        <>
          <InventoryTable
            title="Stock d’aliments"
            icon="▣"
            rows={feedRows}
            months={months}
            emptyLabel="Aucun stock d’aliment enregistré pour cette année."
          />
          <InventoryTable
            title="Sujets restants par lot"
            icon="♧"
            rows={poultryRows}
            months={months}
            totalRow={totalPoultryRow}
            emptyLabel="Aucun lot enregistré pour cette année."
          />
          <InventoryValueSection
            rows={valueRows}
            months={months}
            latestValueRow={latestValueRow}
            latestDetails={latestValueDetails}
            latestSnapshotDate={latestSnapshotDate}
          />
        </>
      ) : (
        <InventoryGraph rows={rows} months={months} />
      )}

      <section className="inventory-note">
        <strong>À savoir</strong>
        <ul>
          <li>L’inventaire conserve une photo des stocks au moment de l’enregistrement.</li>
          <li>Les sacs d’aliment sont calculés en sacs de 25 kg.</li>
          <li>Les lots SICA et Vente directe restent séparés pour garder une lecture claire.</li>
        </ul>
      </section>
    </div>
  );
}

function InventoryTable({
  title,
  icon,
  rows,
  months,
  totalRow,
  emptyLabel,
}: {
  title: string;
  icon: string;
  rows: InventoryRow[];
  months: Array<{ key: string; label: string }>;
  totalRow?: InventoryRow;
  emptyLabel: string;
}) {
  const groupLabels = Array.from(new Set(rows.map((row) => row.groupLabel)));

  return (
    <section className="inventory-panel">
      <div className="inventory-panel-heading">
        <div>
          <span>{icon}</span>
          <h2>{title}</h2>
        </div>
        <div className="inventory-legend">
          <span><i className="inventory-dot inventory-dot-green" /> Enregistré</span>
          <span><i className="inventory-dot inventory-dot-grey" /> À venir</span>
        </div>
      </div>

      {!rows.length ? (
        <div className="inventory-empty">{emptyLabel}</div>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{title.includes("aliment") ? "Aliment" : "Lot"}</th>
                {months.map((month) => (
                  <th key={month.key}>{month.label}</th>
                ))}
                <th>Unité</th>
              </tr>
            </thead>
            <tbody>
              {groupLabels.map((groupLabel) => (
                <InventoryGroup
                  key={groupLabel}
                  groupLabel={groupLabel}
                  rows={rows.filter((row) => row.groupLabel === groupLabel)}
                  months={months}
                />
              ))}
              {totalRow && <InventoryTotalRow row={totalRow} months={months} />}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InventoryGroup({
  groupLabel,
  rows,
  months,
}: {
  groupLabel: string;
  rows: InventoryRow[];
  months: Array<{ key: string; label: string }>;
}) {
  return (
    <>
      {rows[0]?.category !== "feed" && (
        <tr className="inventory-section-row">
          <td colSpan={months.length + 2}>{groupLabel}</td>
        </tr>
      )}
      {rows.map((row) => (
        <tr key={row.key}>
          <td>
            <span className="inventory-item">
              <i>{row.category === "feed" ? "▣" : row.category === "sica" ? "□" : "◎"}</i>
              {row.itemLabel}
            </span>
          </td>
          {months.map((month) => {
            const value = row.values[month.key];
            return (
              <td key={month.key} className={value == null ? "inventory-empty-cell" : "inventory-value"}>
                {value == null ? "–" : formatNombre(value, row.unit === "sacs" ? 0 : 0)}
              </td>
            );
          })}
          <td>{row.unit}</td>
        </tr>
      ))}
    </>
  );
}

function InventoryTotalRow({
  row,
  months,
}: {
  row: InventoryRow;
  months: Array<{ key: string; label: string }>;
}) {
  return (
    <tr className="inventory-total-row">
      <td>{row.itemLabel}</td>
      {months.map((month) => {
        const value = row.values[month.key];
        return (
          <td key={month.key} className={value > 0 ? "inventory-value" : "inventory-empty-cell"}>
            {value > 0 ? formatNombre(value) : "–"}
          </td>
        );
      })}
      <td>{row.unit}</td>
    </tr>
  );
}

function InventoryValueSection({
  rows,
  months,
  latestValueRow,
  latestDetails,
  latestSnapshotDate,
}: {
  rows: InventoryValueRow[];
  months: Array<{ key: string; label: string }>;
  latestValueRow?: InventoryValueRow;
  latestDetails: InventoryValueDetailRow[];
  latestSnapshotDate?: string;
}) {
  const detailTotal = latestDetails.reduce((total, row) => total + row.value, 0);

  return (
    <section className="inventory-panel inventory-value-panel">
      <div className="inventory-panel-heading">
        <div>
          <span>€</span>
          <h2>Estimation de la valeur du stock</h2>
        </div>
        <p>Aliments au prix d’achat des sacs. Volailles estimées selon l’âge, le poids de référence et le prix moyen au kg.</p>
      </div>
      <div className="inventory-value-kpis">
        <div>
          <small>Valeur aliments</small>
          <strong>{formatNombre(latestValueRow?.feedValue || 0, 2)} €</strong>
        </div>
        <div>
          <small>Valeur volailles</small>
          <strong>{formatNombre(latestValueRow?.poultryValue || 0, 2)} €</strong>
        </div>
        <div>
          <small>Total estimé</small>
          <strong>{formatNombre(latestValueRow?.totalValue || 0, 2)} €</strong>
        </div>
      </div>
      <div className="inventory-table-wrap">
        <table className="inventory-table inventory-value-table">
          <thead>
            <tr>
              <th>Valeur</th>
              {months.map((month) => <th key={month.key}>{month.label}</th>)}
              <th>Unité</th>
            </tr>
          </thead>
          <tbody>
            <InventoryMoneyRow label="Aliments" field="feedValue" rows={rows} months={months} />
            <InventoryMoneyRow label="Volailles" field="poultryValue" rows={rows} months={months} />
            <InventoryMoneyRow label="Total estimé" field="totalValue" rows={rows} months={months} />
          </tbody>
        </table>
      </div>
      <div className="inventory-value-detail">
        <div className="inventory-value-detail-heading">
          <div>
            <h3>Détail du dernier inventaire</h3>
            <p>
              {latestSnapshotDate
                ? `Calcul basé sur l’inventaire du ${formatDateCourte(new Date(`${latestSnapshotDate}T00:00:00`))}.`
                : "Aucun inventaire enregistré pour le moment."}
            </p>
          </div>
          <strong>{formatNombre(detailTotal, 2)} €</strong>
        </div>
        {!latestDetails.length ? (
          <div className="inventory-empty">Aucune ligne à détailler pour le dernier inventaire.</div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table inventory-detail-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Prix de référence</th>
                  <th>Valeur estimée</th>
                </tr>
              </thead>
              <tbody>
                {latestDetails.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="inventory-item">
                        <i>{row.category === "feed" ? "▣" : row.category === "sica" ? "□" : "◎"}</i>
                        {row.product}
                      </span>
                    </td>
                    <td>{row.quantityLabel}</td>
                    <td>{row.referenceLabel}</td>
                    <td className="inventory-value">{formatNombre(row.value, 2)} €</td>
                  </tr>
                ))}
                <tr className="inventory-total-row">
                  <td>Total</td>
                  <td>–</td>
                  <td>–</td>
                  <td>{formatNombre(detailTotal, 2)} €</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function InventoryMoneyRow({
  label,
  field,
  rows,
  months,
}: {
  label: string;
  field: keyof Pick<InventoryValueRow, "feedValue" | "poultryValue" | "totalValue">;
  rows: InventoryValueRow[];
  months: Array<{ key: string; label: string }>;
}) {
  return (
    <tr className={field === "totalValue" ? "inventory-total-row" : undefined}>
      <td>{label}</td>
      {months.map((month) => {
        const value = rows.find((row) => row.monthKey === month.key)?.[field] || 0;
        return (
          <td key={month.key} className={value > 0 ? "inventory-value" : "inventory-empty-cell"}>
            {value > 0 ? formatNombre(value, 2) : "–"}
          </td>
        );
      })}
      <td>€</td>
    </tr>
  );
}

function InventoryGraph({
  rows,
  months,
}: {
  rows: InventoryRow[];
  months: Array<{ key: string; label: string }>;
}) {
  const totals = months.map((month) => {
    const feed = rows
      .filter((row) => row.category === "feed")
      .reduce((total, row) => total + (row.values[month.key] || 0), 0);
    const subjects = rows
      .filter((row) => row.category !== "feed")
      .reduce((total, row) => total + (row.values[month.key] || 0), 0);
    return { ...month, feed, subjects };
  });
  const maxFeed = Math.max(1, ...totals.map((total) => total.feed));
  const maxSubjects = Math.max(1, ...totals.map((total) => total.subjects));

  return (
    <section className="inventory-panel">
      <div className="inventory-panel-heading">
        <div>
          <span>▥</span>
          <h2>Évolution annuelle</h2>
        </div>
      </div>
      <div className="inventory-graph-grid">
        {totals.map((total) => (
          <article key={total.key}>
            <strong>{total.label}</strong>
            <div>
              <span style={{ height: `${Math.max(6, (total.feed / maxFeed) * 120)}px` }} />
              <span style={{ height: `${Math.max(6, (total.subjects / maxSubjects) * 120)}px` }} />
            </div>
            <small>{formatNombre(total.feed)} sacs</small>
            <small>{formatNombre(total.subjects)} sujets</small>
          </article>
        ))}
      </div>
      <div className="inventory-graph-legend">
        <span><i className="inventory-dot inventory-dot-green" /> Sacs d’aliment</span>
        <span><i className="inventory-dot inventory-dot-blue" /> Sujets restants</span>
      </div>
    </section>
  );
}
