import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import ModalCloseButton from "../components/ModalCloseButton";
import {
  dateDepuisArrivee,
  genererEvenementsVolailles,
  REGLES_SUIVI_VOLAILLES,
} from "../outils/evenementsVolailles";

type AccueilProps = {
  userName: string;
};

type DashboardEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
};

type LotDashboard = {
  id: string;
  nom: string;
  batiment: string;
  date_arrivee: string;
  quantite: number;
  sujets_restants: number | null;
  nb_morts: number | null;
  resultat_brut: number | null;
  is_active: boolean;
};

type FeedMovement = {
  feed_type: string;
  quantite_kg: number;
  date?: string;
};

type FeedStockSummary = {
  feed_type: string;
  entrees_kg: number;
  consommations_kg: number;
  stock_kg: number;
};

type MeteoJour = {
  date: string;
  code: number;
  temperatureMax: number;
  temperatureMin: number;
  pluie: number;
  vent: number;
};

type MeteoSainteLuce = {
  temperature: number;
  ressenti: number;
  code: number;
  vent: number;
  pluie: number;
  jours: MeteoJour[];
};

type DashboardAlert = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  tone: "danger" | "warning" | "info";
  priority: number;
  to: string;
};

type DashboardTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "todo" | "done";
  priority: "normal" | "urgent";
  created_at: string;
};

type DashboardNote = {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  is_pinned: boolean;
  created_at: string;
};

const POIDS_SAC_KG = 25;
const METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=14.4685&longitude=-60.9214&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FMartinique&forecast_days=4";
const formatNombre = (value: number, decimals = 0) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR");

const todayIso = () => new Date().toISOString().split("T")[0];

const formatDateOptionnelle = (value: string | null) =>
  value ? formatDate(value) : "Sans échéance";

const dateDuJour = () =>
  new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const meteoCode = (code: number) => {
  if (code === 0) return { icon: "☀", label: "Ensoleillé" };
  if ([1, 2].includes(code)) return { icon: "🌤", label: "Éclaircies" };
  if (code === 3) return { icon: "☁", label: "Couvert" };
  if ([45, 48].includes(code)) return { icon: "≋", label: "Brume" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦", label: "Bruine" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "🌧", label: "Pluie" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈", label: "Orage" };
  return { icon: "☁", label: "Variable" };
};

export default function Accueil({ userName }: AccueilProps) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [lots, setLots] = useState<LotDashboard[]>([]);
  const [consommations, setConsommations] = useState<FeedMovement[]>([]);
  const [livraisonsAliment, setLivraisonsAliment] = useState<FeedMovement[]>([]);
  const [stockAlimentServeurKg, setStockAlimentServeurKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meteo, setMeteo] = useState<MeteoSainteLuce | null>(null);
  const [meteoOpen, setMeteoOpen] = useState(false);
  const [meteoErreur, setMeteoErreur] = useState(false);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [taskTableReady, setTaskTableReady] = useState(true);
  const [noteTableReady, setNoteTableReady] = useState(true);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: todayIso(),
    priority: "normal" as DashboardTask["priority"],
  });
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
    category: "",
    is_pinned: false,
  });
  useEffect(() => {
    const chargerTableauDeBord = async () => {
      const [eventRes, lotsRes, consommationsRes, livraisonsRes, tasksRes, notesRes] =
        await Promise.all([
          supabase.from("evenements").select("*"),
          supabase
            .from("lots_volailles")
            .select(
              "id, nom, batiment, date_arrivee, quantite, sujets_restants, nb_morts, resultat_brut, is_active"
            )
            .order("date_arrivee", { ascending: false }),
          supabase
            .from("consommations_aliment")
            .select("feed_type, quantite_kg, date"),
          supabase
            .from("livraisons_aliment")
            .select("feed_type, quantite_kg, date"),
          supabase
            .from("dashboard_tasks")
            .select("id, title, description, due_date, status, priority, created_at")
            .order("status", { ascending: false })
            .order("due_date", { ascending: true }),
          supabase
            .from("dashboard_notes")
            .select("id, title, content, category, is_pinned, created_at")
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (eventRes.error) console.error("Erreur événements :", eventRes.error);
      if (lotsRes.error) console.error("Erreur lots :", lotsRes.error);
      if (consommationsRes.error)
        console.error("Erreur consommations :", consommationsRes.error);
      if (livraisonsRes.error)
        console.error("Erreur livraisons d'aliment :", livraisonsRes.error);
      const stockRes = await supabase.rpc("calculer_stock_aliment");
      if (stockRes.error) {
        setStockAlimentServeurKg(null);
      } else {
        setStockAlimentServeurKg(
          ((stockRes.data || []) as FeedStockSummary[]).reduce(
            (total, item) => total + (Number(item.stock_kg) || 0),
            0
          )
        );
      }
      if (tasksRes.error) {
        console.error("Erreur tâches :", tasksRes.error);
        setTaskTableReady(false);
      } else {
        setTaskTableReady(true);
        setTasks((tasksRes.data || []) as DashboardTask[]);
      }
      if (notesRes.error) {
        console.error("Erreur notes :", notesRes.error);
        setNoteTableReady(false);
      } else {
        setNoteTableReady(true);
        setNotes((notesRes.data || []) as DashboardNote[]);
      }

      const lotsData = (lotsRes.data || []) as LotDashboard[];
      const evenementsLots: DashboardEvent[] = lotsData
        .filter((lot) => lot.is_active)
        .flatMap((lot) => {
          if (!lot.date_arrivee) return [];
          return genererEvenementsVolailles(lot.date_arrivee).map((event) => {
            const date = event.date.toISOString().split("T")[0];
            return {
              id: `${event.key}-${lot.id}`,
              title: `${event.title} - ${lot.nom}`,
              start: date,
              end: date,
              category: "volailles",
            };
          });
        });

      const evenementsManuels = (eventRes.data || []).map((event) => ({
        id: String(event.id),
        title: String(event.title || ""),
        start: String(event.start || ""),
        end: String(event.end || event.start || ""),
        category: String(event.category || "administratif"),
      }));

      setEvents([...evenementsManuels, ...evenementsLots]);
      setLots(lotsData);
      setConsommations(
        (consommationsRes.data || []).map((item) => ({
          ...item,
          quantite_kg: Number(item.quantite_kg) || 0,
        })) as FeedMovement[]
      );
      setLivraisonsAliment(
        (livraisonsRes.data || []).map((item) => ({
          ...item,
          quantite_kg: Number(item.quantite_kg) || 0,
        })) as FeedMovement[]
      );
      setLoading(false);
    };

    chargerTableauDeBord();
  }, []);

  useEffect(() => {
    const chargerMeteo = async () => {
      try {
        const response = await fetch(METEO_URL);
        if (!response.ok) throw new Error(`Météo HTTP ${response.status}`);
        const data = await response.json();
        const jours: MeteoJour[] = (data.daily?.time || []).map(
          (date: string, index: number) => ({
            date,
            code: Number(data.daily.weather_code?.[index]) || 0,
            temperatureMax: Number(data.daily.temperature_2m_max?.[index]) || 0,
            temperatureMin: Number(data.daily.temperature_2m_min?.[index]) || 0,
            pluie: Number(data.daily.precipitation_probability_max?.[index]) || 0,
            vent: Number(data.daily.wind_speed_10m_max?.[index]) || 0,
          })
        );
        setMeteo({
          temperature: Number(data.current?.temperature_2m) || 0,
          ressenti: Number(data.current?.apparent_temperature) || 0,
          code: Number(data.current?.weather_code) || 0,
          vent: Number(data.current?.wind_speed_10m) || 0,
          pluie: jours[0]?.pluie || 0,
          jours,
        });
        setMeteoErreur(false);
      } catch (error) {
        console.error("Erreur chargement météo :", error);
        setMeteoErreur(true);
      }
    };
    chargerMeteo();
  }, []);

  const lotsActifs = useMemo(
    () => lots.filter((lot) => lot.is_active),
    [lots]
  );
  const lotsArchives = useMemo(
    () => lots.filter((lot) => !lot.is_active),
    [lots]
  );
  const sujetsInitiaux = lotsActifs.reduce(
    (total, lot) => total + (Number(lot.quantite) || 0),
    0
  );
  const sujetsRestants = lotsActifs.reduce(
    (total, lot) =>
      total +
      (lot.sujets_restants == null
        ? Number(lot.quantite) || 0
        : Number(lot.sujets_restants) || 0),
    0
  );
  const mortalites = lotsActifs.reduce(
    (total, lot) => total + (Number(lot.nb_morts) || 0),
    0
  );
  const resultatBrut = lotsArchives.reduce(
    (total, lot) => total + (Number(lot.resultat_brut) || 0),
    0
  );
  const stockKgLocal =
    livraisonsAliment.reduce((total, item) => total + item.quantite_kg, 0) -
    consommations.reduce((total, item) => total + item.quantite_kg, 0);
  const stockKg = stockAlimentServeurKg ?? stockKgLocal;
  const consommationDuJourKg = consommations
    .filter((item) => item.date === new Date().toISOString().split("T")[0])
    .reduce((total, item) => total + item.quantite_kg, 0);

  const alertesPrioritaires = useMemo(() => {
    const alertes: DashboardAlert[] = [];
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);

    lotsActifs.forEach((lot) => {
      const tauxMortalite =
        lot.quantite > 0
          ? ((Number(lot.nb_morts) || 0) / lot.quantite) * 100
          : 0;
      if (tauxMortalite > 15) {
        alertes.push({
          id: `mortalite-${lot.id}`,
          title: `Mortalité à surveiller · ${lot.nom}`,
          detail: `${formatNombre(tauxMortalite, 1)} % du lot`,
          icon: "†",
          tone: "danger",
          priority: 0,
          to: "/volailles",
        });
      }

      REGLES_SUIVI_VOLAILLES.forEach((regle) => {
        const date = dateDepuisArrivee(lot.date_arrivee, regle.jour);
        const joursRestants = Math.round(
          (date.getTime() - aujourdHui.getTime()) / 86400000
        );
        if (joursRestants < 0 || joursRestants > 3) return;
        alertes.push({
          id: `${regle.key}-${lot.id}`,
          title: `${regle.title} ${joursRestants === 0 ? "aujourd’hui" : `dans ${joursRestants} j`}`,
          detail: `Lot ${lot.nom} · ${date.toLocaleDateString("fr-FR")}`,
          icon: regle.icon,
          tone: regle.tone,
          priority: joursRestants === 0 ? 1 : 2,
          to: "/volailles",
        });
      });
    });

    const debutSuivi = new Date(aujourdHui);
    debutSuivi.setDate(debutSuivi.getDate() - 6);
    const debutIso = [
      debutSuivi.getFullYear(),
      String(debutSuivi.getMonth() + 1).padStart(2, "0"),
      String(debutSuivi.getDate()).padStart(2, "0"),
    ].join("-");
    const consommationSeptJours = consommations
      .filter((item) => item.date && item.date >= debutIso)
      .reduce((total, item) => total + item.quantite_kg, 0);
    const consommationMoyenne = consommationSeptJours / 7;
    const autonomieJours =
      consommationMoyenne > 0
        ? Math.max(0, stockKg) / consommationMoyenne
        : Number.POSITIVE_INFINITY;

    if (autonomieJours <= 7) {
      alertes.push({
        id: "stock-aliment",
        title: "Commande d’aliment à anticiper",
        detail: `Stock estimé pour ${Math.max(0, Math.floor(autonomieJours))} jour(s)`,
        icon: "▣",
        tone: autonomieJours <= 3 ? "danger" : "warning",
        priority: autonomieJours <= 3 ? 0 : 2,
        to: "/volailles/alimentation",
      });
    }

    const meteoDuJour = meteo?.jours[0];
    if (meteoDuJour && (meteoDuJour.pluie >= 70 || meteoDuJour.vent >= 50)) {
      alertes.push({
        id: "meteo-vigilance",
        title: "Météo à surveiller aujourd’hui",
        detail:
          meteoDuJour.pluie >= 70
            ? `${Math.round(meteoDuJour.pluie)} % de risque de pluie`
            : `Rafales jusqu’à ${Math.round(meteoDuJour.vent)} km/h`,
        icon: meteoCode(meteoDuJour.code).icon,
        tone: "info",
        priority: 3,
        to: "/",
      });
    }

    return alertes
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4);
  }, [consommations, lotsActifs, meteo, stockKg]);

  const repartition = useMemo(() => {
    const total = Math.max(1, sujetsInitiaux);
    const restants = Math.max(0, sujetsRestants);
    const livresOuSortis = Math.max(0, sujetsInitiaux - restants - mortalites);
    return {
      restants,
      mortalites,
      livresOuSortis,
      angleRestants: (restants / total) * 360,
      angleMortalites: ((restants + mortalites) / total) * 360,
    };
  }, [sujetsInitiaux, sujetsRestants, mortalites]);

  const tachesPlanningDuJour = useMemo(() => {
    const today = todayIso();
    return events
      .filter((event) => event.start?.slice(0, 10) === today)
      .sort((a, b) => a.title.localeCompare(b.title, "fr"));
  }, [events]);

  const openTaskModal = (task?: DashboardTask) => {
    if (task) {
      setEditingTaskId(task.id);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        due_date: task.due_date || todayIso(),
        priority: task.priority || "normal",
      });
    } else {
      setEditingTaskId(null);
      setTaskForm({ title: "", description: "", due_date: todayIso(), priority: "normal" });
    }
    setTaskModalOpen(true);
  };

  const openNoteModal = (note?: DashboardNote) => {
    if (note) {
      setEditingNoteId(note.id);
      setNoteForm({
        title: note.title,
        content: note.content || "",
        category: note.category || "",
        is_pinned: Boolean(note.is_pinned),
      });
    } else {
      setEditingNoteId(null);
      setNoteForm({ title: "", content: "", category: "", is_pinned: false });
    }
    setNoteModalOpen(true);
  };

  const saveTask = async () => {
    if (saving || !taskForm.title.trim()) {
      toast.error("Ajoute un titre pour la tâche.");
      return;
    }
    setSaving(true);
    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      due_date: taskForm.due_date || null,
      priority: taskForm.priority,
    };
    const request = editingTaskId
      ? supabase.from("dashboard_tasks").update(payload).eq("id", editingTaskId).select().single()
      : supabase.from("dashboard_tasks").insert({ id: uuidv4(), ...payload }).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      console.error("Erreur sauvegarde tâche :", error);
      toast.error("La tâche n'a pas pu être enregistrée.");
      return;
    }
    setTasks((current) =>
      editingTaskId
        ? current.map((item) => (item.id === editingTaskId ? (data as DashboardTask) : item))
        : [data as DashboardTask, ...current]
    );
    setTaskModalOpen(false);
    toast.success(editingTaskId ? "Tâche modifiée." : "Tâche ajoutée.");
  };

  const toggleTaskStatus = async (task: DashboardTask) => {
    const nextStatus: DashboardTask["status"] = task.status === "done" ? "todo" : "done";
    const { error } = await supabase
      .from("dashboard_tasks")
      .update({ status: nextStatus })
      .eq("id", task.id);
    if (error) {
      toast.error("La tâche n'a pas pu être mise à jour.");
      return;
    }
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
    );
    toast.success(nextStatus === "done" ? "Tâche terminée." : "Tâche remise à faire.");
  };

  const deleteTask = async (task: DashboardTask) => {
    if (!window.confirm("Supprimer cette tâche ?")) return;
    const { error } = await supabase.from("dashboard_tasks").delete().eq("id", task.id);
    if (error) {
      toast.error("La tâche n'a pas pu être supprimée.");
      return;
    }
    setTasks((current) => current.filter((item) => item.id !== task.id));
    toast.success("Tâche supprimée.");
  };

  const saveNote = async () => {
    if (saving || !noteForm.title.trim()) {
      toast.error("Ajoute un titre pour la note.");
      return;
    }
    setSaving(true);
    const payload = {
      title: noteForm.title.trim(),
      content: noteForm.content.trim() || null,
      category: noteForm.category.trim() || null,
      is_pinned: noteForm.is_pinned,
    };
    const request = editingNoteId
      ? supabase.from("dashboard_notes").update(payload).eq("id", editingNoteId).select().single()
      : supabase.from("dashboard_notes").insert({ id: uuidv4(), ...payload }).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      console.error("Erreur sauvegarde note :", error);
      toast.error("La note n'a pas pu être enregistrée.");
      return;
    }
    setNotes((current) =>
      editingNoteId
        ? current.map((item) => (item.id === editingNoteId ? (data as DashboardNote) : item))
        : [data as DashboardNote, ...current]
    );
    setNoteModalOpen(false);
    toast.success(editingNoteId ? "Note modifiée." : "Note ajoutée.");
  };

  const toggleNotePinned = async (note: DashboardNote) => {
    const { error } = await supabase
      .from("dashboard_notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id);
    if (error) {
      toast.error("La note n'a pas pu être mise à jour.");
      return;
    }
    setNotes((current) =>
      current.map((item) => (item.id === note.id ? { ...item, is_pinned: !item.is_pinned } : item))
    );
  };

  const deleteNote = async (note: DashboardNote) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    const { error } = await supabase.from("dashboard_notes").delete().eq("id", note.id);
    if (error) {
      toast.error("La note n'a pas pu être supprimée.");
      return;
    }
    setNotes((current) => current.filter((item) => item.id !== note.id));
    toast.success("Note supprimée.");
  };

  if (loading) {
    return <div className="dashboard-loading">Chargement du tableau de bord...</div>;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <h1>Bonjour {userName || "à vous"}</h1>
          <p>Voici un aperçu de votre exploitation.</p>
        </div>
        <div className="dashboard-heading-tools">
          <button
            type="button"
            className="dashboard-weather-widget"
            onClick={() => setMeteoOpen(true)}
            aria-label="Afficher les prévisions météo de Sainte-Luce"
          >
            <span className="dashboard-weather-icon">
              {meteo ? meteoCode(meteo.code).icon : meteoErreur ? "!" : "◌"}
            </span>
            <span>
              <strong>{meteo ? `${Math.round(meteo.temperature)} °C` : meteoErreur ? "Indisponible" : "Chargement"}</strong>
              <small>{meteo ? `Pluie ${Math.round(meteo.pluie)} % · Vent ${Math.round(meteo.vent)} km/h` : "Sainte-Luce"}</small>
            </span>
          </button>
          <div className="dashboard-date">
            <span>{dateDuJour()}</span>
          </div>
        </div>
      </header>

      <section className="dashboard-kpis">
        <KpiCard icon="▣" tone="green" label="Stock total" value={`${formatNombre(stockKg / POIDS_SAC_KG)} sacs`} note="Disponible" />
        <KpiCard icon="↗" tone="blue" label="Consommé aujourd’hui" value={`${formatNombre(consommationDuJourKg / POIDS_SAC_KG)} sacs`} note="Suivi quotidien" />
        <KpiCard icon="◉" tone="orange" label="Lots actifs" value={`${lotsActifs.length}`} note={`${formatNombre(sujetsRestants)} sujets restants`} />
      </section>

      <section className="dashboard-workspace-grid">
        <article className="dashboard-panel dashboard-tasks-panel">
          <div className="dashboard-section-heading">
            <PanelTitle icon="✓" title="Tâches à faire" />
            <button type="button" className="dashboard-outline-button" onClick={() => openTaskModal()}>
              ＋ Ajouter une tâche
            </button>
          </div>
          <p className="dashboard-section-subtitle">Vos actions prioritaires et échéances à ne pas manquer.</p>
          {!taskTableReady ? (
            <div className="dashboard-setup-hint">
              Exécutez <strong>supabase/dashboard-taches-notes.sql</strong> pour activer les tâches.
            </div>
          ) : tasks.length === 0 ? (
            <div className="dashboard-empty-state">Aucune tâche enregistrée.</div>
          ) : (
            <div className="dashboard-task-list">
              {tasks.slice(0, 6).map((task) => (
                <article key={task.id} className={`dashboard-task-row dashboard-task-${task.status}`}>
                  <button type="button" className="dashboard-task-check" onClick={() => toggleTaskStatus(task)}>
                    {task.status === "done" ? "✓" : ""}
                  </button>
                  <div>
                    <strong>{task.title}</strong>
                    {task.description && <small>{task.description}</small>}
                  </div>
                  <span>{formatDateOptionnelle(task.due_date)}</span>
                  <em className={task.status === "done" ? "dashboard-status-done" : task.priority === "urgent" ? "dashboard-status-urgent" : "dashboard-status-todo"}>
                    {task.status === "done" ? "Terminée" : task.priority === "urgent" ? "Urgent" : "À faire"}
                  </em>
                  <div className="dashboard-row-actions">
                    <button type="button" onClick={() => openTaskModal(task)} title="Modifier">✎</button>
                    <button type="button" onClick={() => deleteTask(task)} title="Supprimer">🗑</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-panel dashboard-notes-panel">
          <div className="dashboard-section-heading">
            <PanelTitle icon="▤" title="Notes" />
            <button type="button" className="dashboard-outline-button" onClick={() => openNoteModal()}>
              ＋ Nouvelle note
            </button>
          </div>
          <p className="dashboard-section-subtitle">Vos notes et informations importantes.</p>
          {!noteTableReady ? (
            <div className="dashboard-setup-hint">
              Exécutez <strong>supabase/dashboard-taches-notes.sql</strong> pour activer les notes.
            </div>
          ) : notes.length === 0 ? (
            <div className="dashboard-empty-state">Aucune note enregistrée.</div>
          ) : (
            <div className="dashboard-note-list">
              {notes.slice(0, 5).map((note) => (
                <article key={note.id} className={`dashboard-note-card ${note.is_pinned ? "dashboard-note-pinned" : ""}`}>
                  <div>
                    <strong>{note.title}</strong>
                    {note.content && <p>{note.content}</p>}
                    {note.category && <span>{note.category}</span>}
                  </div>
                  <small>{new Date(note.created_at).toLocaleDateString("fr-FR")}</small>
                  <div className="dashboard-row-actions">
                    <button type="button" onClick={() => toggleNotePinned(note)} title="Épingler">{note.is_pinned ? "★" : "☆"}</button>
                    <button type="button" onClick={() => openNoteModal(note)} title="Modifier">✎</button>
                    <button type="button" onClick={() => deleteNote(note)} title="Supprimer">🗑</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-production">
          <PanelTitle icon="◔" title="Aperçu de la production" />
          <div className="production-content">
            <div
              className="production-ring"
              style={{
                background: `conic-gradient(#37b45a 0deg ${repartition.angleRestants}deg, #ef4444 ${repartition.angleRestants}deg ${repartition.angleMortalites}deg, #f59e0b ${repartition.angleMortalites}deg 360deg)`,
              }}
            >
              <div className="production-ring-center">
                <span>Lots actifs</span>
                <strong>{lotsActifs.length}</strong>
              </div>
            </div>
            <div className="production-legend">
              <Legend color="#37b45a" label="Sujets restants" value={repartition.restants} />
              <Legend color="#f59e0b" label="Sujets sortis" value={repartition.livresOuSortis} />
              <Legend color="#ef4444" label="Mortalités" value={repartition.mortalites} />
              <Legend color="#4f83cc" label="Sujets initiaux" value={sujetsInitiaux} />
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-finance">
          <PanelTitle icon="€" title="Résultats financiers" />
          <div className="finance-grid">
            <div className="finance-value">
              <span>Résultat brut enregistré</span>
              <strong>{resultatBrut.toFixed(2)} €</strong>
            </div>
            <div className="finance-value">
              <span>Lots clôturés</span>
              <strong>{lotsArchives.length}</strong>
            </div>
          </div>
          <div className="dashboard-information">
            Consultez l’analyse économique pour le détail par lot.
          </div>
          <Link className="dashboard-text-link" to="/volailles/analyse">
            Ouvrir l’analyse →
          </Link>
        </article>

        <article className="dashboard-panel dashboard-today-planning">
          <div className="panel-title-row">
            <PanelTitle icon="✓" title="Tâches du jour" />
            <Link className="dashboard-text-link dashboard-today-link" to="/planning">Planning →</Link>
          </div>
          <p className="dashboard-section-subtitle">Événements prévus aujourd’hui dans le planning.</p>
          <div className="dashboard-today-list">
            {tachesPlanningDuJour.map((event) => (
              <Link key={event.id} to="/planning" className={`dashboard-today-row dashboard-today-${event.category}`}>
                <span>{event.category === "volailles" ? "♧" : event.category === "aquaponie" ? "≋" : event.category === "cultures" ? "⌁" : event.category === "ovins" ? "♘" : "□"}</span>
                <div>
                  <strong>{event.title}</strong>
                  <small>{event.category}</small>
                </div>
                <b>›</b>
              </Link>
            ))}
            {tachesPlanningDuJour.length === 0 && (
              <div className="dashboard-alert-empty dashboard-today-empty">
                <span>✓</span>
                <div>
                  <strong>Aucune tâche planning aujourd’hui</strong>
                  <small>Rien de prévu pour le {dateDuJour()}.</small>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-lots">
          <div className="panel-title-row">
            <PanelTitle icon="▤" title="Lots SICA Madras" />
            <Link className="dashboard-primary-link" to="/volailles">
              Gérer les lots →
            </Link>
          </div>
          <div className="dashboard-lot-list">
            {lotsActifs.slice(0, 5).map((lot) => (
              <div className="dashboard-lot-row" key={lot.id}>
                <div>
                  <strong>{lot.nom}</strong>
                  <span>{lot.batiment || "Bâtiment non renseigné"}</span>
                </div>
                <div>
                  <span>Arrivée</span>
                  <strong>{formatDate(lot.date_arrivee)}</strong>
                </div>
                <div>
                  <span>Sujets restants</span>
                  <strong>{formatNombre(lot.sujets_restants == null ? lot.quantite : lot.sujets_restants)}</strong>
                </div>
                <span className={`lot-status ${lot.is_active ? "lot-status-active" : "lot-status-archived"}`}>
                  En cours
                </span>
              </div>
            ))}
            {lotsActifs.length === 0 && (
              <div className="dashboard-empty">Aucun lot en cours.</div>
            )}
          </div>
        </article>

        <aside className="dashboard-side-column">
          <article className="dashboard-panel dashboard-feed-card">
            <PanelTitle icon="▣" title="Alimentation" />
            <span>Stock disponible</span>
            <strong>{formatNombre(stockKg / POIDS_SAC_KG)} sacs</strong>
            <Link to="/volailles/alimentation">Gérer l’alimentation →</Link>
          </article>
          <article className="dashboard-panel dashboard-reminders">
            <div className="panel-title-row">
              <PanelTitle icon="!" title="Alertes et rappels" />
              <span className="dashboard-alert-count">{alertesPrioritaires.length}</span>
            </div>
            <div className="dashboard-alert-list">
              {alertesPrioritaires.map((alerte) => (
                <Link
                  key={alerte.id}
                  className={`dashboard-alert dashboard-alert-${alerte.tone}`}
                  to={alerte.to}
                  onClick={
                    alerte.id === "meteo-vigilance"
                      ? (event) => {
                          event.preventDefault();
                          setMeteoOpen(true);
                        }
                      : undefined
                  }
                >
                  <span aria-hidden="true">{alerte.icon}</span>
                  <div>
                    <strong>{alerte.title}</strong>
                    <small>{alerte.detail}</small>
                  </div>
                  <b aria-hidden="true">›</b>
                </Link>
              ))}
              {alertesPrioritaires.length === 0 && (
                <div className="dashboard-alert-empty">
                  <span>✓</span>
                  <div>
                    <strong>Rien à signaler</strong>
                    <small>Aucune échéance prioritaire actuellement.</small>
                  </div>
                </div>
              )}
            </div>
          </article>
        </aside>
      </section>

      {taskModalOpen && (
        <div className="poultry-modal-backdrop">
          <section className="poultry-modal poultry-modal-small">
            <ModalCloseButton onClick={() => setTaskModalOpen(false)} disabled={saving} />
            <div className="poultry-modal-header">
              <span className="poultry-modal-icon">✓</span>
              <div>
                <h2>{editingTaskId ? "Modifier la tâche" : "Ajouter une tâche"}</h2>
                <p>Notez une action à suivre sur l’exploitation.</p>
              </div>
            </div>
            <div className="poultry-form-stack">
              <label>Titre<input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Description<input value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <label>Échéance<input type="date" value={taskForm.due_date} onChange={(event) => setTaskForm((current) => ({ ...current, due_date: event.target.value }))} /></label>
              <label>Priorité<select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as DashboardTask["priority"] }))}><option value="normal">Normale</option><option value="urgent">Urgente</option></select></label>
            </div>
            <div className="poultry-modal-actions">
              <button type="button" className="poultry-modal-primary" onClick={saveTask} disabled={saving}>Enregistrer</button>
              <button type="button" className="poultry-modal-secondary" onClick={() => setTaskModalOpen(false)} disabled={saving}>Annuler</button>
            </div>
          </section>
        </div>
      )}

      {noteModalOpen && (
        <div className="poultry-modal-backdrop">
          <section className="poultry-modal poultry-modal-small">
            <ModalCloseButton onClick={() => setNoteModalOpen(false)} disabled={saving} />
            <div className="poultry-modal-header">
              <span className="poultry-modal-icon">▤</span>
              <div>
                <h2>{editingNoteId ? "Modifier la note" : "Nouvelle note"}</h2>
                <p>Conservez une information importante.</p>
              </div>
            </div>
            <div className="poultry-form-stack">
              <label>Titre<input value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Note<input value={noteForm.content} onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))} /></label>
              <label>Catégorie<input value={noteForm.category} onChange={(event) => setNoteForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex. Organisation" /></label>
              <label className="dashboard-checkbox-field"><input type="checkbox" checked={noteForm.is_pinned} onChange={(event) => setNoteForm((current) => ({ ...current, is_pinned: event.target.checked }))} /> Épingler la note</label>
            </div>
            <div className="poultry-modal-actions">
              <button type="button" className="poultry-modal-primary" onClick={saveNote} disabled={saving}>Enregistrer</button>
              <button type="button" className="poultry-modal-secondary" onClick={() => setNoteModalOpen(false)} disabled={saving}>Annuler</button>
            </div>
          </section>
        </div>
      )}

      {meteoOpen && (
        <div className="poultry-modal-backdrop" onClick={() => setMeteoOpen(false)}>
          <div className="weather-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="weather-modal-close" onClick={() => setMeteoOpen(false)} aria-label="Fermer">×</button>
            <div className="weather-modal-heading">
              <span>{meteo ? meteoCode(meteo.code).icon : "☁"}</span>
              <div>
                <h2>Météo à Sainte-Luce</h2>
                <p>{meteo ? `${meteoCode(meteo.code).label} · Ressenti ${Math.round(meteo.ressenti)} °C` : "Prévisions temporairement indisponibles."}</p>
              </div>
            </div>
            {meteo && (
              <>
                <div className="weather-current">
                  <strong>{Math.round(meteo.temperature)} °C</strong>
                  <span>Pluie {Math.round(meteo.pluie)} %</span>
                  <span>Vent {Math.round(meteo.vent)} km/h</span>
                </div>
                <div className="weather-forecast">
                  {meteo.jours.slice(0, 3).map((jour) => (
                    <article key={jour.date}>
                      <strong>{new Date(`${jour.date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short" })}</strong>
                      <span className="weather-forecast-icon">{meteoCode(jour.code).icon}</span>
                      <b>{Math.round(jour.temperatureMax)}° / {Math.round(jour.temperatureMin)}°</b>
                      <small>Pluie {Math.round(jour.pluie)} % · Vent {Math.round(jour.vent)} km/h</small>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: string;
  tone: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="dashboard-kpi">
      <div className={`dashboard-kpi-icon dashboard-kpi-${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function PanelTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="panel-title">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="production-legend-row">
      <i style={{ backgroundColor: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
