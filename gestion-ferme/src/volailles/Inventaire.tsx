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

  const chargerInventaires = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("monthly_inventory_snapshots")
      .select("id, snapshot_date, category, group_label, item_label, quantity, unit, created_at")
      .order("snapshot_date", { ascending: false })
      .order("group_label", { ascending: true });

    if (error) {
      console.error("Erreur chargement inventaire :", error);
      setDatabaseReady(false);
      setSnapshots([]);
    } else {
      setDatabaseReady(true);
      setSnapshots(
        (data || []).map((row) => ({
          ...row,
          category: row.category as InventoryCategory,
          quantity: Number(row.quantity) || 0,
          unit: row.unit as InventoryUnit,
        }))
      );
    }
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
  const dernierInventaire = snapshots[0];

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
            emptyLabel="Aucun lot enregistré pour cette année."
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
  emptyLabel,
}: {
  title: string;
  icon: string;
  rows: InventoryRow[];
  months: Array<{ key: string; label: string }>;
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
