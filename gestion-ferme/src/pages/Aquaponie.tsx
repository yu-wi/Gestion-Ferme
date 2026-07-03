import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import ModalCloseButton from "../components/ModalCloseButton";
import { supabase } from "../supabaseClient";
import { formatDateCourte, formatNombre } from "../outils/formatNombre";

type AquaTab = "resume" | "bassins" | "parametres" | "cultures" | "recoltes";
type BasinStatus = "stable" | "surveillance" | "probleme";
type CultureStatus = "semis" | "croissance" | "pret" | "recolte";
type HarvestDestination = "vente" | "autoconsommation" | "perte";

type Basin = {
  id: string;
  name: string;
  species: string;
  fish_count: number;
  status: BasinStatus;
  notes: string | null;
  created_at: string;
};

type WaterMeasure = {
  id: string;
  basin_id: string | null;
  measure_date: string;
  temperature_c: number | null;
  ph: number | null;
  no2: number | null;
  no3: number | null;
  conductivity: number | null;
  oxygen_mg_l: number | null;
  notes: string | null;
};

type AquaCulture = {
  id: string;
  name: string;
  variety: string | null;
  location: string | null;
  planted_at: string;
  expected_harvest_at: string | null;
  quantity: number | null;
  growth_percent: number;
  status: CultureStatus;
  notes: string | null;
};

type Harvest = {
  id: string;
  culture_id: string | null;
  harvest_date: string;
  weight_kg: number;
  destination: HarvestDestination;
  value_eur: number | null;
  notes: string | null;
};

const todayIso = () => new Date().toISOString().split("T")[0];
const statusLabel: Record<BasinStatus, string> = {
  stable: "Stable",
  surveillance: "À surveiller",
  probleme: "Problème",
};
const cultureStatusLabel: Record<CultureStatus, string> = {
  semis: "Semis",
  croissance: "Croissance",
  pret: "Prêt à récolter",
  recolte: "Récolté",
};
const destinationLabel: Record<HarvestDestination, string> = {
  vente: "Vente",
  autoconsommation: "Autoconsommation",
  perte: "Perte",
};

const emptyBasinForm = {
  name: "",
  species: "",
  fish_count: "",
  status: "stable" as BasinStatus,
  notes: "",
};

const emptyMeasureForm = {
  basin_id: "",
  measure_date: todayIso(),
  temperature_c: "",
  ph: "",
  no2: "",
  no3: "",
  conductivity: "",
  oxygen_mg_l: "",
  notes: "",
};

const emptyCultureForm = {
  name: "",
  variety: "",
  location: "",
  planted_at: todayIso(),
  expected_harvest_at: "",
  quantity: "",
  growth_percent: "",
  status: "croissance" as CultureStatus,
  notes: "",
};

const emptyHarvestForm = {
  culture_id: "",
  harvest_date: todayIso(),
  weight_kg: "",
  destination: "vente" as HarvestDestination,
  value_eur: "",
  notes: "",
};

const toNumberOrNull = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const measureAlertCount = (measure?: WaterMeasure) => {
  if (!measure) return 0;
  let alerts = 0;
  if (measure.ph != null && (measure.ph < 6.5 || measure.ph > 7.5)) alerts += 1;
  if (measure.temperature_c != null && (measure.temperature_c < 24 || measure.temperature_c > 30)) alerts += 1;
  if (measure.no2 != null && measure.no2 > 0.5) alerts += 1;
  if (measure.no3 != null && measure.no3 > 80) alerts += 1;
  if (measure.oxygen_mg_l != null && measure.oxygen_mg_l < 5) alerts += 1;
  return alerts;
};

export default function Aquaponie() {
  const [activeTab, setActiveTab] = useState<AquaTab>("resume");
  const [bassins, setBassins] = useState<Basin[]>([]);
  const [mesures, setMesures] = useState<WaterMeasure[]>([]);
  const [cultures, setCultures] = useState<AquaCulture[]>([]);
  const [recoltes, setRecoltes] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(true);
  const [modal, setModal] = useState<null | "bassin" | "mesure" | "culture" | "recolte">(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [basinForm, setBasinForm] = useState(emptyBasinForm);
  const [measureForm, setMeasureForm] = useState(emptyMeasureForm);
  const [cultureForm, setCultureForm] = useState(emptyCultureForm);
  const [harvestForm, setHarvestForm] = useState(emptyHarvestForm);

  const chargerAquaponie = async () => {
    setLoading(true);
    const [basinResult, measureResult, cultureResult, harvestResult] = await Promise.all([
      supabase.from("aquaponie_basins").select("*").order("created_at", { ascending: false }),
      supabase.from("aquaponie_water_measures").select("*").order("measure_date", { ascending: false }).limit(200),
      supabase.from("aquaponie_cultures").select("*").order("planted_at", { ascending: false }),
      supabase.from("aquaponie_harvests").select("*").order("harvest_date", { ascending: false }).limit(200),
    ]);

    const errors = [basinResult.error, measureResult.error, cultureResult.error, harvestResult.error].filter(Boolean);
    if (errors.length) {
      console.error("Erreur chargement aquaponie :", errors);
      setDatabaseReady(false);
      setBassins([]);
      setMesures([]);
      setCultures([]);
      setRecoltes([]);
    } else {
      setDatabaseReady(true);
      setBassins((basinResult.data || []) as Basin[]);
      setMesures((measureResult.data || []) as WaterMeasure[]);
      setCultures((cultureResult.data || []) as AquaCulture[]);
      setRecoltes((harvestResult.data || []) as Harvest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    chargerAquaponie();
  }, []);

  const basinById = useMemo(() => new Map(bassins.map((bassin) => [bassin.id, bassin])), [bassins]);
  const cultureById = useMemo(() => new Map(cultures.map((culture) => [culture.id, culture])), [cultures]);
  const latestMeasure = mesures[0];
  const alertCount = measureAlertCount(latestMeasure) + bassins.filter((bassin) => bassin.status !== "stable").length;
  const activeCultures = cultures.filter((culture) => culture.status !== "recolte");
  const harvestWeight = recoltes.reduce((total, recolte) => total + Number(recolte.weight_kg || 0), 0);

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
  };

  const openBasin = (bassin?: Basin) => {
    if (bassin) {
      setEditingId(bassin.id);
      setBasinForm({
        name: bassin.name,
        species: bassin.species,
        fish_count: String(bassin.fish_count || ""),
        status: bassin.status,
        notes: bassin.notes || "",
      });
    } else {
      setEditingId(null);
      setBasinForm(emptyBasinForm);
    }
    setModal("bassin");
  };

  const openMeasure = (measure?: WaterMeasure) => {
    if (measure) {
      setEditingId(measure.id);
      setMeasureForm({
        basin_id: measure.basin_id || "",
        measure_date: measure.measure_date,
        temperature_c: measure.temperature_c == null ? "" : String(measure.temperature_c),
        ph: measure.ph == null ? "" : String(measure.ph),
        no2: measure.no2 == null ? "" : String(measure.no2),
        no3: measure.no3 == null ? "" : String(measure.no3),
        conductivity: measure.conductivity == null ? "" : String(measure.conductivity),
        oxygen_mg_l: measure.oxygen_mg_l == null ? "" : String(measure.oxygen_mg_l),
        notes: measure.notes || "",
      });
    } else {
      setEditingId(null);
      setMeasureForm({ ...emptyMeasureForm, basin_id: bassins[0]?.id || "" });
    }
    setModal("mesure");
  };

  const openCulture = (culture?: AquaCulture) => {
    if (culture) {
      setEditingId(culture.id);
      setCultureForm({
        name: culture.name,
        variety: culture.variety || "",
        location: culture.location || "",
        planted_at: culture.planted_at,
        expected_harvest_at: culture.expected_harvest_at || "",
        quantity: culture.quantity == null ? "" : String(culture.quantity),
        growth_percent: String(culture.growth_percent || ""),
        status: culture.status,
        notes: culture.notes || "",
      });
    } else {
      setEditingId(null);
      setCultureForm(emptyCultureForm);
    }
    setModal("culture");
  };

  const openHarvest = (harvest?: Harvest, cultureId?: string) => {
    if (harvest) {
      setEditingId(harvest.id);
      setHarvestForm({
        culture_id: harvest.culture_id || "",
        harvest_date: harvest.harvest_date,
        weight_kg: String(harvest.weight_kg || ""),
        destination: harvest.destination,
        value_eur: harvest.value_eur == null ? "" : String(harvest.value_eur),
        notes: harvest.notes || "",
      });
    } else {
      setEditingId(null);
      setHarvestForm({ ...emptyHarvestForm, culture_id: cultureId || activeCultures[0]?.id || "" });
    }
    setModal("recolte");
  };

  const saveBasin = async () => {
    if (!basinForm.name.trim()) {
      toast.error("Ajoutez le nom du bassin.");
      return;
    }
    setSaving(true);
    const payload = {
      name: basinForm.name.trim(),
      species: basinForm.species.trim() || "Non renseigné",
      fish_count: Number(basinForm.fish_count) || 0,
      status: basinForm.status,
      notes: basinForm.notes.trim() || null,
    };
    const request = editingId
      ? supabase.from("aquaponie_basins").update(payload).eq("id", editingId).select().single()
      : supabase.from("aquaponie_basins").insert(payload).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      toast.error("Le bassin n'a pas pu être enregistré.");
      return;
    }
    setBassins((current) => editingId ? current.map((item) => item.id === editingId ? data as Basin : item) : [data as Basin, ...current]);
    toast.success(editingId ? "Bassin modifié." : "Bassin ajouté.");
    closeModal();
  };

  const saveMeasure = async () => {
    if (!measureForm.measure_date) {
      toast.error("Ajoutez une date de mesure.");
      return;
    }
    setSaving(true);
    const payload = {
      basin_id: measureForm.basin_id || null,
      measure_date: measureForm.measure_date,
      temperature_c: toNumberOrNull(measureForm.temperature_c),
      ph: toNumberOrNull(measureForm.ph),
      no2: toNumberOrNull(measureForm.no2),
      no3: toNumberOrNull(measureForm.no3),
      conductivity: toNumberOrNull(measureForm.conductivity),
      oxygen_mg_l: toNumberOrNull(measureForm.oxygen_mg_l),
      notes: measureForm.notes.trim() || null,
    };
    const request = editingId
      ? supabase.from("aquaponie_water_measures").update(payload).eq("id", editingId).select().single()
      : supabase.from("aquaponie_water_measures").insert(payload).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      toast.error("La mesure n'a pas pu être enregistrée.");
      return;
    }
    setMesures((current) => editingId ? current.map((item) => item.id === editingId ? data as WaterMeasure : item) : [data as WaterMeasure, ...current]);
    toast.success(editingId ? "Mesure modifiée." : "Mesure enregistrée.");
    closeModal();
  };

  const saveCulture = async () => {
    if (!cultureForm.name.trim() || !cultureForm.planted_at) {
      toast.error("Ajoutez la culture et la date de plantation.");
      return;
    }
    setSaving(true);
    const payload = {
      name: cultureForm.name.trim(),
      variety: cultureForm.variety.trim() || null,
      location: cultureForm.location.trim() || null,
      planted_at: cultureForm.planted_at,
      expected_harvest_at: cultureForm.expected_harvest_at || null,
      quantity: toNumberOrNull(cultureForm.quantity),
      growth_percent: Math.min(100, Math.max(0, Number(cultureForm.growth_percent) || 0)),
      status: cultureForm.status,
      notes: cultureForm.notes.trim() || null,
    };
    const request = editingId
      ? supabase.from("aquaponie_cultures").update(payload).eq("id", editingId).select().single()
      : supabase.from("aquaponie_cultures").insert(payload).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      toast.error("La culture n'a pas pu être enregistrée.");
      return;
    }
    setCultures((current) => editingId ? current.map((item) => item.id === editingId ? data as AquaCulture : item) : [data as AquaCulture, ...current]);
    toast.success(editingId ? "Culture modifiée." : "Culture ajoutée.");
    closeModal();
  };

  const saveHarvest = async () => {
    if (!harvestForm.harvest_date || !harvestForm.weight_kg.trim()) {
      toast.error("Ajoutez la date et le poids récolté.");
      return;
    }
    setSaving(true);
    const payload = {
      culture_id: harvestForm.culture_id || null,
      harvest_date: harvestForm.harvest_date,
      weight_kg: Number(harvestForm.weight_kg) || 0,
      destination: harvestForm.destination,
      value_eur: toNumberOrNull(harvestForm.value_eur),
      notes: harvestForm.notes.trim() || null,
    };
    const request = editingId
      ? supabase.from("aquaponie_harvests").update(payload).eq("id", editingId).select().single()
      : supabase.from("aquaponie_harvests").insert(payload).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      toast.error("La récolte n'a pas pu être enregistrée.");
      return;
    }
    setRecoltes((current) => editingId ? current.map((item) => item.id === editingId ? data as Harvest : item) : [data as Harvest, ...current]);
    toast.success(editingId ? "Récolte modifiée." : "Récolte enregistrée.");
    closeModal();
  };

  const deleteRow = async (table: string, id: string, label: string, setter: (id: string) => void) => {
    if (!window.confirm(`Supprimer ${label} ?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error("La suppression n'a pas pu être effectuée.");
      return;
    }
    setter(id);
    toast.success("Suppression effectuée.");
  };

  if (loading) return <div className="dashboard-loading">Chargement de l'aquaponie...</div>;

  return (
    <div className="aquaponie-page">
      <header className="aquaponie-heading">
        <div>
          <h1><span>◇</span> Aquaponie</h1>
          <p>Suivi des bassins, paramètres de l'eau et cultures.</p>
        </div>
        <div>
          <button type="button" onClick={() => openMeasure()}>＋ Mesure eau</button>
          <button type="button" onClick={() => openCulture()}>＋ Culture</button>
        </div>
      </header>

      <nav className="poultry-tabs aquaponie-tabs" aria-label="Sections aquaponie">
        <button type="button" className={activeTab === "resume" ? "poultry-tab-active" : ""} onClick={() => setActiveTab("resume")}>Résumé</button>
        <button type="button" className={activeTab === "bassins" ? "poultry-tab-active" : ""} onClick={() => setActiveTab("bassins")}>Bassins</button>
        <button type="button" className={activeTab === "parametres" ? "poultry-tab-active" : ""} onClick={() => setActiveTab("parametres")}>Paramètres eau</button>
        <button type="button" className={activeTab === "cultures" ? "poultry-tab-active" : ""} onClick={() => setActiveTab("cultures")}>Cultures</button>
        <button type="button" className={activeTab === "recoltes" ? "poultry-tab-active" : ""} onClick={() => setActiveTab("recoltes")}>Récoltes</button>
      </nav>

      {!databaseReady && (
        <section className="aquaponie-setup">
          Exécutez <strong>supabase/aquaponie-suivi.sql</strong> dans Supabase pour activer cette page.
        </section>
      )}

      <section className="aquaponie-kpis">
        <AquaKpi tone="green" icon="▣" label="Bassins actifs" value={formatNombre(bassins.length)} note={`${formatNombre(bassins.reduce((total, bassin) => total + Number(bassin.fish_count || 0), 0))} poissons`} />
        <AquaKpi tone="blue" icon="≋" label="Qualité de l'eau" value={latestMeasure ? "Mesurée" : "À renseigner"} note={latestMeasure ? formatDateCourte(new Date(`${latestMeasure.measure_date}T00:00:00`)) : "Aucune mesure"} />
        <AquaKpi tone="green" icon="🌱" label="Cultures" value={formatNombre(activeCultures.length)} note="En cours" />
        <AquaKpi tone="orange" icon="!" label="Alertes" value={formatNombre(alertCount)} note="À surveiller" />
      </section>

      {activeTab === "resume" && (
        <section className="aquaponie-overview">
          <article className="aquaponie-panel">
            <PanelHeading title="État des bassins" action="Ajouter" onClick={() => openBasin()} />
            <div className="aquaponie-basin-list">
              {bassins.slice(0, 4).map((bassin) => {
                const mesure = mesures.find((item) => item.basin_id === bassin.id);
                return (
                  <div key={bassin.id} className="aquaponie-basin-row">
                    <div><strong>{bassin.name}</strong><small>{bassin.species} · {formatNombre(bassin.fish_count)} poissons</small></div>
                    <span>Temp. <b>{mesure?.temperature_c ?? "–"} °C</b></span>
                    <span>pH <b>{mesure?.ph ?? "–"}</b></span>
                    <span>O2 <b>{mesure?.oxygen_mg_l ?? "–"} mg/L</b></span>
                    <em className={`aquaponie-status aquaponie-status-${bassin.status}`}>{statusLabel[bassin.status]}</em>
                  </div>
                );
              })}
              {!bassins.length && <EmptyState label="Aucun bassin enregistré." />}
            </div>
          </article>
          <article className="aquaponie-panel">
            <PanelHeading title="Cultures" action="Ajouter" onClick={() => openCulture()} />
            <div className="aquaponie-culture-summary">
              {activeCultures.slice(0, 5).map((culture) => <CultureCard key={culture.id} culture={culture} onEdit={() => openCulture(culture)} />)}
              {!activeCultures.length && <EmptyState label="Aucune culture en cours." />}
            </div>
          </article>
        </section>
      )}

      {activeTab === "bassins" && (
        <section className="aquaponie-panel">
          <PanelHeading title="Bassins" action="Ajouter un bassin" onClick={() => openBasin()} />
          <div className="aquaponie-table-wrap">
            <table className="aquaponie-table">
              <thead><tr><th>Bassin</th><th>Espèce</th><th>Poissons</th><th>État</th><th>Actions</th></tr></thead>
              <tbody>
                {bassins.map((bassin) => (
                  <tr key={bassin.id}>
                    <td>{bassin.name}</td>
                    <td>{bassin.species}</td>
                    <td>{formatNombre(bassin.fish_count)}</td>
                    <td><span className={`aquaponie-status aquaponie-status-${bassin.status}`}>{statusLabel[bassin.status]}</span></td>
                    <td><RowActions onEdit={() => openBasin(bassin)} onDelete={() => deleteRow("aquaponie_basins", bassin.id, "ce bassin", (id) => setBassins((current) => current.filter((item) => item.id !== id)))} /></td>
                  </tr>
                ))}
                {!bassins.length && <tr><td colSpan={5}><EmptyState label="Aucun bassin enregistré." /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "parametres" && (
        <section className="aquaponie-panel">
          <PanelHeading title="Paramètres de l'eau" action="Enregistrer une mesure" onClick={() => openMeasure()} />
          <div className="aquaponie-last-measure">
            <MeasureValue label="Température" value={latestMeasure?.temperature_c} suffix="°C" />
            <MeasureValue label="pH" value={latestMeasure?.ph} />
            <MeasureValue label="NO2" value={latestMeasure?.no2} />
            <MeasureValue label="NO3" value={latestMeasure?.no3} />
            <MeasureValue label="EC" value={latestMeasure?.conductivity} />
            <MeasureValue label="Oxygène" value={latestMeasure?.oxygen_mg_l} suffix="mg/L" />
          </div>
          <div className="aquaponie-table-wrap">
            <table className="aquaponie-table">
              <thead><tr><th>Date</th><th>Bassin</th><th>Temp.</th><th>pH</th><th>NO2</th><th>NO3</th><th>EC</th><th>O2</th><th>Actions</th></tr></thead>
              <tbody>
                {mesures.slice(0, 30).map((mesure) => (
                  <tr key={mesure.id}>
                    <td>{formatDateCourte(new Date(`${mesure.measure_date}T00:00:00`))}</td>
                    <td>{mesure.basin_id ? basinById.get(mesure.basin_id)?.name || "Bassin" : "Tous"}</td>
                    <td>{mesure.temperature_c ?? "–"}</td>
                    <td>{mesure.ph ?? "–"}</td>
                    <td>{mesure.no2 ?? "–"}</td>
                    <td>{mesure.no3 ?? "–"}</td>
                    <td>{mesure.conductivity ?? "–"}</td>
                    <td>{mesure.oxygen_mg_l ?? "–"}</td>
                    <td><RowActions onEdit={() => openMeasure(mesure)} onDelete={() => deleteRow("aquaponie_water_measures", mesure.id, "cette mesure", (id) => setMesures((current) => current.filter((item) => item.id !== id)))} /></td>
                  </tr>
                ))}
                {!mesures.length && <tr><td colSpan={9}><EmptyState label="Aucune mesure enregistrée." /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "cultures" && (
        <section className="aquaponie-panel">
          <PanelHeading title="Cultures en cours" action="Ajouter une culture" onClick={() => openCulture()} />
          <div className="aquaponie-culture-grid">
            {cultures.map((culture) => (
              <article key={culture.id} className="aquaponie-culture-card">
                <CultureCard culture={culture} onEdit={() => openCulture(culture)} />
                <div className="aquaponie-card-actions">
                  <button type="button" onClick={() => openHarvest(undefined, culture.id)}>Récolter</button>
                  <button type="button" onClick={() => openCulture(culture)}>Modifier</button>
                  <button type="button" onClick={() => deleteRow("aquaponie_cultures", culture.id, "cette culture", (id) => setCultures((current) => current.filter((item) => item.id !== id)))}>Supprimer</button>
                </div>
              </article>
            ))}
            {!cultures.length && <EmptyState label="Aucune culture enregistrée." />}
          </div>
        </section>
      )}

      {activeTab === "recoltes" && (
        <section className="aquaponie-panel">
          <PanelHeading title="Récoltes" action="Saisir une récolte" onClick={() => openHarvest()} />
          <div className="aquaponie-harvest-kpis">
            <AquaKpi tone="green" icon="🌱" label="Kg récoltés" value={`${formatNombre(harvestWeight, 2)} kg`} note="Total enregistré" />
            <AquaKpi tone="orange" icon="€" label="Valeur" value={`${formatNombre(recoltes.reduce((total, item) => total + Number(item.value_eur || 0), 0), 2)} €`} note="Montants renseignés" />
          </div>
          <div className="aquaponie-table-wrap">
            <table className="aquaponie-table">
              <thead><tr><th>Date</th><th>Culture</th><th>Poids</th><th>Destination</th><th>Valeur</th><th>Actions</th></tr></thead>
              <tbody>
                {recoltes.map((recolte) => (
                  <tr key={recolte.id}>
                    <td>{formatDateCourte(new Date(`${recolte.harvest_date}T00:00:00`))}</td>
                    <td>{recolte.culture_id ? cultureById.get(recolte.culture_id)?.name || "Culture" : "Non liée"}</td>
                    <td>{formatNombre(recolte.weight_kg, 2)} kg</td>
                    <td>{destinationLabel[recolte.destination]}</td>
                    <td>{recolte.value_eur == null ? "–" : `${formatNombre(recolte.value_eur, 2)} €`}</td>
                    <td><RowActions onEdit={() => openHarvest(recolte)} onDelete={() => deleteRow("aquaponie_harvests", recolte.id, "cette récolte", (id) => setRecoltes((current) => current.filter((item) => item.id !== id)))} /></td>
                  </tr>
                ))}
                {!recoltes.length && <tr><td colSpan={6}><EmptyState label="Aucune récolte enregistrée." /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal === "bassin" && (
        <AquaModal title={editingId ? "Modifier le bassin" : "Ajouter un bassin"} icon="▣" onClose={closeModal}>
          <div className="aquaponie-form-grid">
            <label>Nom<input value={basinForm.name} onChange={(event) => setBasinForm({ ...basinForm, name: event.target.value })} placeholder="Ex. Bassin 1" /></label>
            <label>Espèce<input value={basinForm.species} onChange={(event) => setBasinForm({ ...basinForm, species: event.target.value })} placeholder="Ex. Tilapia" /></label>
            <label>Nombre de poissons<input type="number" value={basinForm.fish_count} onChange={(event) => setBasinForm({ ...basinForm, fish_count: event.target.value })} /></label>
            <label>État<select value={basinForm.status} onChange={(event) => setBasinForm({ ...basinForm, status: event.target.value as BasinStatus })}><option value="stable">Stable</option><option value="surveillance">À surveiller</option><option value="probleme">Problème</option></select></label>
            <label className="aquaponie-field-wide">Note<textarea value={basinForm.notes} onChange={(event) => setBasinForm({ ...basinForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions onSave={saveBasin} onCancel={closeModal} saving={saving} />
        </AquaModal>
      )}

      {modal === "mesure" && (
        <AquaModal title={editingId ? "Modifier la mesure" : "Enregistrer une mesure"} icon="≋" onClose={closeModal}>
          <div className="aquaponie-form-grid">
            <label>Bassin<select value={measureForm.basin_id} onChange={(event) => setMeasureForm({ ...measureForm, basin_id: event.target.value })}><option value="">Tous les bassins</option>{bassins.map((bassin) => <option key={bassin.id} value={bassin.id}>{bassin.name}</option>)}</select></label>
            <label>Date<input type="date" value={measureForm.measure_date} onChange={(event) => setMeasureForm({ ...measureForm, measure_date: event.target.value })} /></label>
            <label>Température (°C)<input type="number" step="0.1" value={measureForm.temperature_c} onChange={(event) => setMeasureForm({ ...measureForm, temperature_c: event.target.value })} /></label>
            <label>pH<input type="number" step="0.1" value={measureForm.ph} onChange={(event) => setMeasureForm({ ...measureForm, ph: event.target.value })} /></label>
            <label>NO2<input type="number" step="0.01" value={measureForm.no2} onChange={(event) => setMeasureForm({ ...measureForm, no2: event.target.value })} /></label>
            <label>NO3<input type="number" step="0.1" value={measureForm.no3} onChange={(event) => setMeasureForm({ ...measureForm, no3: event.target.value })} /></label>
            <label>Conductivité<input type="number" step="0.01" value={measureForm.conductivity} onChange={(event) => setMeasureForm({ ...measureForm, conductivity: event.target.value })} /></label>
            <label>Oxygène (mg/L)<input type="number" step="0.1" value={measureForm.oxygen_mg_l} onChange={(event) => setMeasureForm({ ...measureForm, oxygen_mg_l: event.target.value })} /></label>
            <label className="aquaponie-field-wide">Observation<textarea value={measureForm.notes} onChange={(event) => setMeasureForm({ ...measureForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions onSave={saveMeasure} onCancel={closeModal} saving={saving} />
        </AquaModal>
      )}

      {modal === "culture" && (
        <AquaModal title={editingId ? "Modifier la culture" : "Ajouter une culture"} icon="🌱" onClose={closeModal}>
          <div className="aquaponie-form-grid">
            <label>Culture<input value={cultureForm.name} onChange={(event) => setCultureForm({ ...cultureForm, name: event.target.value })} placeholder="Ex. Salade" /></label>
            <label>Variété<input value={cultureForm.variety} onChange={(event) => setCultureForm({ ...cultureForm, variety: event.target.value })} placeholder="Ex. Batavia" /></label>
            <label>Emplacement<input value={cultureForm.location} onChange={(event) => setCultureForm({ ...cultureForm, location: event.target.value })} placeholder="Ex. Bac 1" /></label>
            <label>Date plantation<input type="date" value={cultureForm.planted_at} onChange={(event) => setCultureForm({ ...cultureForm, planted_at: event.target.value })} /></label>
            <label>Récolte prévue<input type="date" value={cultureForm.expected_harvest_at} onChange={(event) => setCultureForm({ ...cultureForm, expected_harvest_at: event.target.value })} /></label>
            <label>Quantité<input type="number" value={cultureForm.quantity} onChange={(event) => setCultureForm({ ...cultureForm, quantity: event.target.value })} /></label>
            <label>Progression (%)<input type="number" min="0" max="100" value={cultureForm.growth_percent} onChange={(event) => setCultureForm({ ...cultureForm, growth_percent: event.target.value })} /></label>
            <label>Statut<select value={cultureForm.status} onChange={(event) => setCultureForm({ ...cultureForm, status: event.target.value as CultureStatus })}><option value="semis">Semis</option><option value="croissance">Croissance</option><option value="pret">Prêt à récolter</option><option value="recolte">Récolté</option></select></label>
            <label className="aquaponie-field-wide">Note<textarea value={cultureForm.notes} onChange={(event) => setCultureForm({ ...cultureForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions onSave={saveCulture} onCancel={closeModal} saving={saving} />
        </AquaModal>
      )}

      {modal === "recolte" && (
        <AquaModal title={editingId ? "Modifier la récolte" : "Saisir une récolte"} icon="✓" onClose={closeModal}>
          <div className="aquaponie-form-grid">
            <label>Culture<select value={harvestForm.culture_id} onChange={(event) => setHarvestForm({ ...harvestForm, culture_id: event.target.value })}><option value="">Non liée</option>{cultures.map((culture) => <option key={culture.id} value={culture.id}>{culture.name}</option>)}</select></label>
            <label>Date<input type="date" value={harvestForm.harvest_date} onChange={(event) => setHarvestForm({ ...harvestForm, harvest_date: event.target.value })} /></label>
            <label>Poids (kg)<input type="number" step="0.01" value={harvestForm.weight_kg} onChange={(event) => setHarvestForm({ ...harvestForm, weight_kg: event.target.value })} /></label>
            <label>Destination<select value={harvestForm.destination} onChange={(event) => setHarvestForm({ ...harvestForm, destination: event.target.value as HarvestDestination })}><option value="vente">Vente</option><option value="autoconsommation">Autoconsommation</option><option value="perte">Perte</option></select></label>
            <label>Valeur (€)<input type="number" step="0.01" value={harvestForm.value_eur} onChange={(event) => setHarvestForm({ ...harvestForm, value_eur: event.target.value })} /></label>
            <label className="aquaponie-field-wide">Note<textarea value={harvestForm.notes} onChange={(event) => setHarvestForm({ ...harvestForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions onSave={saveHarvest} onCancel={closeModal} saving={saving} />
        </AquaModal>
      )}
    </div>
  );
}

function AquaKpi({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return (
    <article className="aquaponie-kpi">
      <span className={`aquaponie-kpi-icon aquaponie-kpi-${tone}`}>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong><em>{note}</em></div>
    </article>
  );
}

function PanelHeading({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return (
    <div className="aquaponie-panel-heading">
      <h2>{title}</h2>
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  );
}

function CultureCard({ culture, onEdit }: { culture: AquaCulture; onEdit: () => void }) {
  return (
    <div className="aquaponie-culture-mini">
      <div>
        <strong>{culture.name}</strong>
        <small>{culture.variety || "Variété non renseignée"} · {culture.location || "Emplacement libre"}</small>
      </div>
      <span>{culture.growth_percent}%</span>
      <div className="aquaponie-progress"><i style={{ width: `${culture.growth_percent}%` }} /></div>
      <em>{culture.expected_harvest_at ? `Récolte ${formatDateCourte(new Date(`${culture.expected_harvest_at}T00:00:00`))}` : cultureStatusLabel[culture.status]}</em>
      <button type="button" onClick={onEdit}>Modifier</button>
    </div>
  );
}

function MeasureValue({ label, value, suffix = "" }: { label: string; value?: number | null; suffix?: string }) {
  return <div><small>{label}</small><strong>{value == null ? "–" : `${formatNombre(value, 2)} ${suffix}`}</strong></div>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="aquaponie-row-actions"><button type="button" onClick={onEdit}>✎</button><button type="button" onClick={onDelete}>⌫</button></div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="aquaponie-empty">{label}</div>;
}

function AquaModal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="poultry-modal-backdrop">
      <section className="poultry-modal poultry-modal-medium aquaponie-modal">
        <ModalCloseButton onClick={onClose} />
        <div className="poultry-modal-header">
          <span className="poultry-modal-icon">{icon}</span>
          <div><h2>{title}</h2><p>Complétez les informations de suivi aquaponique.</p></div>
        </div>
        {children}
      </section>
    </div>
  );
}

function ModalActions({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="poultry-modal-actions">
      <button type="button" className="poultry-modal-primary" onClick={onSave} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      <button type="button" className="poultry-modal-secondary" onClick={onCancel} disabled={saving}>Annuler</button>
    </div>
  );
}
