import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { formatDateCourte, formatNombre } from "../outils/formatNombre";

type ExportFormat = "csv" | "json";

type ExportGroup = {
  key: string;
  title: string;
  description: string;
  tables: ExportTable[];
};

type ExportTable = {
  table: string;
  label: string;
  orderBy?: string;
};

type ExportResult = {
  table: ExportTable;
  rows: Record<string, unknown>[];
};

const EXPORT_GROUPS: ExportGroup[] = [
  {
    key: "sica",
    title: "Lots SICA Madras",
    description: "Lots, mortalités, livraisons et charges rattachées aux lots coopérative.",
    tables: [
      { table: "lots_volailles", label: "Lots SICA Madras", orderBy: "date_arrivee" },
      { table: "mortalites_volailles", label: "Mortalités SICA", orderBy: "date" },
      { table: "livraisons_volailles", label: "Livraisons SICA", orderBy: "date" },
      { table: "charges", label: "Charges par lot" },
    ],
  },
  {
    key: "direct",
    title: "Vente directe",
    description: "Lots, clients, commandes, livraisons, règlements et mortalités vente directe.",
    tables: [
      { table: "direct_sale_lots", label: "Lots vente directe", orderBy: "arrival_date" },
      { table: "direct_sale_mortalities", label: "Mortalités vente directe", orderBy: "date" },
      { table: "direct_sale_customers", label: "Clients" },
      { table: "direct_sale_orders", label: "Commandes", orderBy: "delivery_date" },
      { table: "direct_sale_deliveries", label: "Livraisons et règlements", orderBy: "delivery_date" },
    ],
  },
  {
    key: "feed",
    title: "Alimentation",
    description: "Consommations, livraisons de stock et références alimentaires.",
    tables: [
      { table: "consommations_aliment", label: "Consommations aliment", orderBy: "date" },
      { table: "livraisons_aliment", label: "Livraisons aliment", orderBy: "date" },
      { table: "feed_reference", label: "Références alimentaires", orderBy: "age_min_days" },
    ],
  },
  {
    key: "inventory",
    title: "Inventaires",
    description: "Photos mensuelles des stocks d’aliment et des sujets restants.",
    tables: [
      { table: "monthly_inventory_snapshots", label: "Inventaires mensuels", orderBy: "snapshot_date" },
    ],
  },
];

const allTables = EXPORT_GROUPS.flatMap((group) => group.tables);

const formatDateForFile = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("-");
};

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const csvValue = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const toCsv = (rows: Record<string, unknown>[]) => {
  const columns = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  if (!columns.length) return "";

  const lines = rows.map((row) =>
    columns
      .map((column) => `"${csvValue(row[column]).replace(/"/g, '""')}"`)
      .join(";")
  );
  return [columns.join(";"), ...lines].join("\n");
};

const downloadTextFile = (content: string, fileName: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

async function loadTable(table: ExportTable): Promise<ExportResult> {
  const request = table.orderBy
    ? supabase.from(table.table).select("*").order(table.orderBy, { ascending: false })
    : supabase.from(table.table).select("*");
  const { data, error } = await request;
  if (error) throw new Error(`${table.label} : ${error.message}`);

  return {
    table,
    rows: ((data || []) as unknown as Record<string, unknown>[]),
  };
}

function countRows(results: ExportResult[]) {
  return results.reduce((total, result) => total + result.rows.length, 0);
}

export default function Sauvegardes() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const todayLabel = useMemo(() => formatDateCourte(new Date()), []);

  const exporterTables = async (
    tables: ExportTable[],
    fileBaseName: string,
    format: ExportFormat
  ) => {
    const loadingId = `${format}-${fileBaseName}`;
    setLoadingKey(loadingId);
    try {
      const results = await Promise.all(tables.map(loadTable));
      const fileDate = formatDateForFile();

      if (format === "json") {
        const backup = {
          exported_at: new Date().toISOString(),
          app: "gestion-ferme",
          tables: Object.fromEntries(results.map((result) => [result.table.table, result.rows])),
        };
        downloadTextFile(
          JSON.stringify(backup, null, 2),
          `sauvegarde-gestion-ferme-${fileDate}.json`,
          "application/json;charset=utf-8"
        );
      } else {
        results.forEach((result) => {
          downloadTextFile(
            toCsv(result.rows),
            `${sanitizeFileName(result.table.label)}-${fileDate}.csv`,
            "text/csv;charset=utf-8;"
          );
        });
      }

      toast.success(`${format === "json" ? "Sauvegarde" : "Export"} terminé : ${formatNombre(countRows(results))} ligne(s).`);
    } catch (error) {
      console.error("Erreur export :", error);
      toast.error(error instanceof Error ? error.message : "L’export n’a pas pu être généré.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="backup-page">
      <header className="backup-heading">
        <div>
          <span className="backup-heading-icon">⇩</span>
          <div>
            <h1>Sauvegardes et exports</h1>
            <p>Exportez les données importantes avant de faire évoluer l’interface.</p>
            <span>Dernière vérification locale : {todayLabel}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => exporterTables(allTables, "complete", "json")}
          disabled={loadingKey !== null}
        >
          {loadingKey === "json-complete" ? "Préparation..." : "Sauvegarde complète"}
        </button>
      </header>

      <section className="backup-notice">
        <strong>Conseil simple</strong>
        <p>
          Téléchargez une sauvegarde complète avant une grosse modification, puis gardez le fichier
          dans un dossier daté. Les exports CSV servent surtout à consulter ou contrôler les données.
        </p>
      </section>

      <section className="backup-grid">
        {EXPORT_GROUPS.map((group) => (
          <article key={group.key} className="backup-card">
            <div>
              <span>{group.tables.length}</span>
              <div>
                <h2>{group.title}</h2>
                <p>{group.description}</p>
              </div>
            </div>
            <ul>
              {group.tables.map((table) => (
                <li key={table.table}>{table.label}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => exporterTables(group.tables, group.key, "csv")}
              disabled={loadingKey !== null}
            >
              {loadingKey === `csv-${group.key}` ? "Export..." : "Exporter en CSV"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
