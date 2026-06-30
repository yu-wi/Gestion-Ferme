import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import ModalCloseButton from "../components/ModalCloseButton";
import { supabase } from "../supabaseClient";
import { dateDepuisArrivee, REGLES_SUIVI_VOLAILLES } from "../outils/evenementsVolailles";
import { formatNombre } from "../outils/formatNombre";

type SicaLot = {
  id: string;
  nom: string;
  batiment: string | null;
  date_arrivee: string;
  quantite: number;
  sujets_restants: number | null;
  nb_morts: number | null;
  is_active: boolean;
};

type DirectLot = {
  id: string;
  name: string;
  species: "poulet" | "pintade";
  arrival_date: string;
  initial_quantity: number;
  remaining_quantity: number;
  mortality_count: number;
  location: string | null;
  status: "elevage" | "pret" | "termine";
};

type UnifiedLot = {
  id: string;
  source: "sica" | "vente_directe";
  label: string;
  restants: number;
  dateArrivee: string;
};

type FeedReference = {
  feed_type: string;
  daily_consumption_g: number;
  age_min_days: number;
  age_max_days: number;
};

type AlertItem = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  tone: "info" | "warning" | "danger";
  to: string;
  date: Date;
};

const todayStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR");

const directSpeciesLabel = (species: DirectLot["species"]) =>
  species === "pintade" ? "Pintades" : "Poulets";

const POIDS_SAC_KG = 25;

const todayIso = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const ageEntreDates = (dateArrivee: string, dateCible: string) => {
  const arrivee = new Date(`${dateArrivee}T00:00:00`);
  const cible = new Date(`${dateCible}T00:00:00`);
  return Math.max(0, Math.floor((cible.getTime() - arrivee.getTime()) / 86400000));
};

function PoultrySubnav() {
  return (
    <nav className="poultry-tabs" aria-label="Sections volailles">
      <Link to="/volailles" className="poultry-tab-active">Résumé</Link>
      <Link to="/volailles/sica">Lots SICA Madras</Link>
      <Link to="/volailles/sica/historique">Historique SICA</Link>
      <Link to="/volailles/vente-directe">Vente directe</Link>
      <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
      <Link to="/volailles/alimentation">Alimentation</Link>
      <Link to="/volailles/analyse/sica">Analyse SICA</Link>
      <Link to="/volailles/analyse/vente-directe">Analyse vente directe</Link>
      <Link to="/volailles/inventaire">Inventaire</Link>
    </nav>
  );
}

export default function VolaillesResume() {
  const [sicaLots, setSicaLots] = useState<SicaLot[]>([]);
  const [directLots, setDirectLots] = useState<DirectLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [directAvailable, setDirectAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedTypes, setFeedTypes] = useState<string[]>(["starter", "croissance", "finition"]);
  const [feedReferences, setFeedReferences] = useState<FeedReference[]>([]);
  const [mortalityModalOpen, setMortalityModalOpen] = useState(false);
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [mortalityLotKey, setMortalityLotKey] = useState("");
  const [mortalityDate, setMortalityDate] = useState(todayIso());
  const [mortalityCount, setMortalityCount] = useState("");
  const [feedLotKey, setFeedLotKey] = useState("");
  const [feedDate, setFeedDate] = useState(todayIso());
  const [feedType, setFeedType] = useState("");
  const [feedBags, setFeedBags] = useState("");
  const [feedNote, setFeedNote] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [sicaResult, directResult, feedReferenceResult] = await Promise.all([
        supabase
          .from("lots_volailles")
          .select("id, nom, batiment, date_arrivee, quantite, sujets_restants, nb_morts, is_active")
          .eq("is_active", true)
          .order("date_arrivee", { ascending: false }),
        supabase
          .from("direct_sale_lots")
          .select("*")
          .neq("status", "termine")
          .order("arrival_date", { ascending: false }),
        supabase
          .from("feed_reference")
          .select("feed_type, daily_consumption_g, age_min_days, age_max_days")
          .order("age_min_days"),
      ]);

      if (sicaResult.error) {
        console.error("Erreur chargement résumé volailles :", sicaResult.error);
        toast.error("Le résumé volailles n'a pas pu être chargé.");
      } else {
        setSicaLots((sicaResult.data || []) as SicaLot[]);
      }

      if (directResult.error) {
        setDirectAvailable(false);
        setDirectLots([]);
      } else {
        setDirectAvailable(true);
        setDirectLots((directResult.data || []) as DirectLot[]);
      }

      if (!feedReferenceResult.error) {
        setFeedReferences(
          (feedReferenceResult.data || []).map((item) => ({
            feed_type: String(item.feed_type || ""),
            daily_consumption_g: Number(item.daily_consumption_g) || 0,
            age_min_days: Number(item.age_min_days) || 0,
            age_max_days: Number(item.age_max_days) || 0,
          }))
        );
        const types = Array.from(
          new Set((feedReferenceResult.data || []).map((item) => String(item.feed_type || "").trim()).filter(Boolean))
        );
        if (types.length) setFeedTypes(types);
      }

      setLoading(false);
    };
    load();
  }, []);

  const reloadLots = async () => {
    const [sicaResult, directResult] = await Promise.all([
      supabase
        .from("lots_volailles")
        .select("id, nom, batiment, date_arrivee, quantite, sujets_restants, nb_morts, is_active")
        .eq("is_active", true)
        .order("date_arrivee", { ascending: false }),
      supabase
        .from("direct_sale_lots")
        .select("*")
        .neq("status", "termine")
        .order("arrival_date", { ascending: false }),
    ]);
    if (!sicaResult.error) setSicaLots((sicaResult.data || []) as SicaLot[]);
    if (!directResult.error) setDirectLots((directResult.data || []) as DirectLot[]);
  };

  const allLots: UnifiedLot[] = [
    ...sicaLots.map((lot) => ({
      id: lot.id,
      source: "sica" as const,
      label: `SICA · ${lot.nom}`,
      restants: lot.sujets_restants ?? lot.quantite ?? 0,
      dateArrivee: lot.date_arrivee,
    })),
    ...directLots.map((lot) => ({
      id: lot.id,
      source: "vente_directe" as const,
      label: `Vente directe · ${lot.name}`,
      restants: Number(lot.remaining_quantity) || 0,
      dateArrivee: lot.arrival_date,
    })),
  ];

  const selectedFeedLot = allLots.find((lot) => `${lot.source}:${lot.id}` === feedLotKey) || null;
  const feedSuggestion = selectedFeedLot && feedDate
    ? (() => {
        const age = ageEntreDates(selectedFeedLot.dateArrivee, feedDate);
        const reference = feedReferences.find(
          (item) => age >= item.age_min_days && age <= item.age_max_days
        );
        if (!reference) return null;
        const sacs = (reference.daily_consumption_g * selectedFeedLot.restants) / 1000 / POIDS_SAC_KG;
        return { age, reference, sacs };
      })()
    : null;

  const openMortalityShortcut = () => {
    setMortalityLotKey("");
    setMortalityDate(todayIso());
    setMortalityCount("");
    setMortalityModalOpen(true);
  };

  const openFeedShortcut = () => {
    setFeedLotKey("");
    setFeedDate(todayIso());
    setFeedType(feedTypes[0] || "");
    setFeedBags("");
    setFeedNote("");
    setFeedModalOpen(true);
  };

  useEffect(() => {
    if (feedSuggestion) {
      setFeedType(feedSuggestion.reference.feed_type);
    }
  }, [feedSuggestion?.reference.feed_type]);

  const saveMortality = async () => {
    const selected = allLots.find((lot) => `${lot.source}:${lot.id}` === mortalityLotKey);
    const count = Number(mortalityCount);
    if (!selected || !mortalityDate || !Number.isFinite(count) || count <= 0) {
      toast.error("Choisissez un lot, une date et un nombre positif.");
      return;
    }
    if (count > selected.restants) {
      toast.error(`Il ne reste que ${formatNombre(selected.restants)} sujets dans ce lot.`);
      return;
    }

    setSaving(true);
    if (selected.source === "sica") {
      const { error } = await supabase.from("mortalites_volailles").insert({
        lot_id: selected.id,
        date: mortalityDate,
        nombre: count,
      });
      if (error) {
        console.error("Erreur mortalité SICA :", error);
        toast.error("La mortalité n'a pas pu être enregistrée.");
      } else {
        const lot = sicaLots.find((item) => item.id === selected.id);
        if (lot) {
          const nbMorts = (Number(lot.nb_morts) || 0) + count;
          const sujetsRestants = Math.max(0, (lot.sujets_restants ?? lot.quantite ?? 0) - count);
          await supabase
            .from("lots_volailles")
            .update({ nb_morts: nbMorts, sujets_restants: sujetsRestants })
            .eq("id", selected.id);
        }
        toast.success("Mortalité enregistrée.");
        setMortalityModalOpen(false);
        await reloadLots();
      }
    } else {
      const lot = directLots.find((item) => item.id === selected.id);
      if (!lot) {
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("direct_sale_lots")
        .update({
          mortality_count: lot.mortality_count + count,
          remaining_quantity: Math.max(0, lot.remaining_quantity - count),
        })
        .eq("id", selected.id);
      if (error) {
        console.error("Erreur mortalité vente directe :", error);
        toast.error("La mortalité n'a pas pu être enregistrée.");
      } else {
        toast.success("Mortalité enregistrée.");
        setMortalityModalOpen(false);
        await reloadLots();
      }
    }
    setSaving(false);
  };

  const saveFeedConsumption = async () => {
    const selected = allLots.find((lot) => `${lot.source}:${lot.id}` === feedLotKey);
    const bags = Number(feedBags);
    if (!selected || !feedDate || !feedType || !Number.isFinite(bags) || bags <= 0) {
      toast.error("Complétez le lot, la date, l'aliment et le nombre de sacs.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("consommations_aliment").insert({
      lot_id: selected.source === "sica" ? selected.id : null,
      direct_sale_lot_id: selected.source === "vente_directe" ? selected.id : null,
      source_type: selected.source,
      date: feedDate,
      feed_type: feedType,
      quantite_kg: bags * POIDS_SAC_KG,
      note: feedNote.trim() || null,
    });
    if (error) {
      console.error("Erreur consommation depuis résumé :", error);
      toast.error("La consommation n'a pas pu être enregistrée.");
    } else {
      toast.success("Consommation enregistrée.");
      setFeedModalOpen(false);
    }
    setSaving(false);
  };

  const sujetsSica = sicaLots.reduce(
    (total, lot) => total + (lot.sujets_restants ?? lot.quantite ?? 0),
    0
  );
  const sujetsDirect = directLots.reduce(
    (total, lot) => total + (Number(lot.remaining_quantity) || 0),
    0
  );
  const mortalites = sicaLots.reduce(
    (total, lot) => total + (Number(lot.nb_morts) || 0),
    0
  ) + directLots.reduce((total, lot) => total + (Number(lot.mortality_count) || 0), 0);

  const alertes = useMemo(() => {
    const items: AlertItem[] = [];
    const now = todayStart();

    sicaLots.forEach((lot) => {
      REGLES_SUIVI_VOLAILLES.forEach((regle) => {
        const date = dateDepuisArrivee(lot.date_arrivee, regle.jour);
        const jours = Math.round((date.getTime() - now.getTime()) / 86400000);
        if (jours < 0 || jours > 7) return;
        items.push({
          id: `sica-${lot.id}-${regle.key}`,
          title: regle.title,
          detail: `${lot.nom} · ${jours === 0 ? "aujourd’hui" : `dans ${jours} j`} · ${date.toLocaleDateString("fr-FR")}`,
          icon: regle.icon,
          tone: regle.tone,
          to: "/volailles/sica",
          date,
        });
      });

      const taux = lot.quantite > 0 ? ((lot.nb_morts || 0) / lot.quantite) * 100 : 0;
      if (taux > 15) {
        items.push({
          id: `mortalite-${lot.id}`,
          title: "Mortalité à surveiller",
          detail: `${lot.nom} · ${formatNombre(taux, 1)} %`,
          icon: "†",
          tone: "danger",
          to: "/volailles/sica",
          date: now,
        });
      }
    });

    directLots.forEach((lot) => {
      if (lot.status === "pret") {
        items.push({
          id: `direct-${lot.id}`,
          title: "Lot prêt à vendre",
          detail: `${lot.name} · ${formatNombre(lot.remaining_quantity)} sujets disponibles`,
          icon: "€",
          tone: "info",
          to: "/volailles/vente-directe",
          date: now,
        });
      }
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [directLots, sicaLots]);

  if (loading) {
    return <div className="dashboard-loading">Chargement du résumé volailles...</div>;
  }

  return (
    <div className="poultry-page poultry-summary-page">
      <header className="poultry-heading">
        <div>
          <h1>Résumé volailles <span>♧</span></h1>
          <p>Vue rapide des lots actifs SICA Madras, vente directe et alertes à venir.</p>
        </div>
      </header>

      <PoultrySubnav />

      {!directAvailable && (
        <div className="direct-sale-setup">
          <strong>Vente directe non initialisée</strong>
          <span>Les données de vente directe apparaîtront après installation de la table Supabase.</span>
        </div>
      )}

      <section className="poultry-kpis poultry-summary-kpis">
        <article className="poultry-kpi poultry-summary-kpi">
          <i className="poultry-kpi-icon poultry-kpi-green">▣</i><div><small>Lots SICA Madras</small><strong>{formatNombre(sicaLots.length)}</strong><em>{formatNombre(sujetsSica)} sujets</em></div>
        </article>
        <article className="poultry-kpi poultry-summary-kpi">
          <i className="poultry-kpi-icon poultry-kpi-blue">◎</i><div><small>Lots Vente directe</small><strong>{formatNombre(directLots.length)}</strong><em>{formatNombre(sujetsDirect)} sujets</em></div>
        </article>
        <article className="poultry-kpi poultry-summary-kpi">
          <i className="poultry-kpi-icon poultry-kpi-red">✚</i><div><small>Mortalités</small><strong>{formatNombre(mortalites)}</strong><em>Tous lots actifs</em></div>
        </article>
        <article className="poultry-kpi poultry-summary-kpi">
          <i className="poultry-kpi-icon poultry-kpi-orange">!</i><div><small>Alertes planning</small><strong>{formatNombre(alertes.length)}</strong><em>Sur 7 jours</em></div>
        </article>
      </section>

      <section className="poultry-summary-grid">
        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Lots actifs SICA Madras</h2>
            <Link className="summary-heading-link" to="/volailles/sica">Voir la gestion <span>→</span></Link>
          </div>
          <div className="poultry-summary-list">
            {sicaLots.slice(0, 6).map((lot) => (
              <Link key={lot.id} to="/volailles/sica" className="poultry-summary-row">
                <span>▣</span>
                <div><strong>{lot.nom}</strong><small>{lot.batiment || "Bâtiment non renseigné"} · Arrivé le {formatDate(lot.date_arrivee)}</small></div>
                <b>{formatNombre(lot.sujets_restants ?? lot.quantite)} sujets</b>
                <i>›</i>
              </Link>
            ))}
            {sicaLots.length === 0 && <div className="poultry-empty">Aucun lot SICA actif.</div>}
          </div>
          <Link className="summary-panel-footer" to="/volailles/sica">Voir tous les lots SICA Madras <span>→</span></Link>
        </article>

        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Lots actifs Vente directe</h2>
            <Link className="summary-heading-link" to="/volailles/vente-directe">Voir la gestion <span>→</span></Link>
          </div>
          <div className="poultry-summary-list">
            {directLots.slice(0, 6).map((lot) => (
              <Link key={lot.id} to="/volailles/vente-directe" className="poultry-summary-row">
                <span>◎</span>
                <div><strong>{lot.name}</strong><small>{directSpeciesLabel(lot.species)} · {lot.location || "Emplacement non renseigné"}</small></div>
                <b>{formatNombre(lot.remaining_quantity)} sujets</b>
                <i>›</i>
              </Link>
            ))}
            {directLots.length === 0 && <div className="poultry-empty">Aucun lot vente directe actif.</div>}
          </div>
          <Link className="summary-panel-footer" to="/volailles/vente-directe">Voir tous les lots Vente directe <span>→</span></Link>
        </article>

        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Alertes planning</h2>
            <Link className="summary-heading-link" to="/planning">Voir le planning <span>→</span></Link>
          </div>
          <div className="poultry-alert-list">
            {alertes.map((alerte) => (
              <Link key={alerte.id} to={alerte.to} className={`poultry-alert poultry-alert-${alerte.tone} summary-alert-row`}>
                <span>{alerte.icon}</span><div><strong>{alerte.title}</strong><small>{alerte.detail}</small></div>
              </Link>
            ))}
            {alertes.length === 0 && <div className="poultry-empty">Aucune alerte sur les 7 prochains jours.</div>}
          </div>
          <Link className="summary-panel-footer" to="/planning">Voir toutes les alertes ({formatNombre(alertes.length)}) <span>→</span></Link>
        </article>

        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Raccourcis de saisie</h2>
            <span>Lots SICA et vente directe</span>
          </div>
          <div className="poultry-shortcuts">
            <button type="button" onClick={openMortalityShortcut}><span>＋</span><div><strong>Saisir mortalité</strong><small>SICA ou vente directe</small></div></button>
            <button type="button" onClick={openFeedShortcut}><span>▣</span><div><strong>Saisir alimentation</strong><small>Consommation quotidienne</small></div></button>
            <Link to="/volailles/alimentation"><span>🚚</span><div><strong>Livraison aliment</strong><small>Ajouter au stock</small></div></Link>
            <Link to="/volailles/sica"><span>＋</span><div><strong>Nouveau lot SICA</strong><small>Créer un lot coopérative</small></div></Link>
          </div>
        </article>
      </section>

      {mortalityModalOpen && (
        <div className="poultry-modal-backdrop">
          <section className="poultry-modal poultry-modal-medium">
            <ModalCloseButton onClick={() => setMortalityModalOpen(false)} disabled={saving} />
            <div className="poultry-modal-header">
              <span className="poultry-modal-icon">†</span>
              <div><h2>Saisir une mortalité</h2><p>Choisissez un lot SICA Madras ou Vente directe.</p></div>
            </div>
            <div className="poultry-form-grid">
              <label>Lot<select value={mortalityLotKey} onChange={(event) => setMortalityLotKey(event.target.value)}>
                <option value="">Choisir un lot</option>
                {allLots.map((lot) => <option key={`${lot.source}-${lot.id}`} value={`${lot.source}:${lot.id}`}>{lot.label} · {formatNombre(lot.restants)} restants</option>)}
              </select></label>
              <label>Date<input type="date" value={mortalityDate} onChange={(event) => setMortalityDate(event.target.value)} /></label>
              <label>Nombre<input type="number" min="1" value={mortalityCount} onChange={(event) => setMortalityCount(event.target.value)} /></label>
            </div>
            <div className="poultry-modal-actions">
              <button type="button" className="poultry-modal-secondary" onClick={() => setMortalityModalOpen(false)} disabled={saving}>Annuler</button>
              <button type="button" className="poultry-modal-primary" onClick={saveMortality} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </section>
        </div>
      )}

      {feedModalOpen && (
        <div className="poultry-modal-backdrop">
          <section className="poultry-modal poultry-modal-medium">
            <ModalCloseButton onClick={() => setFeedModalOpen(false)} disabled={saving} />
            <div className="poultry-modal-header">
              <span className="poultry-modal-icon">▣</span>
              <div><h2>Saisir une consommation</h2><p>Enregistrer les sacs consommés par un lot.</p></div>
            </div>
            <div className="poultry-form-grid">
              <label>Lot<select value={feedLotKey} onChange={(event) => setFeedLotKey(event.target.value)}>
                <option value="">Choisir un lot</option>
                {allLots.map((lot) => <option key={`${lot.source}-${lot.id}`} value={`${lot.source}:${lot.id}`}>{lot.label}</option>)}
              </select></label>
              <label>Date<input type="date" value={feedDate} onChange={(event) => setFeedDate(event.target.value)} /></label>
              <label>Aliment<select value={feedType} onChange={(event) => setFeedType(event.target.value)}>
                <option value="">Choisir un aliment</option>
                {feedTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select></label>
              <label>Sacs consommés (25 kg)<input type="number" min="1" step="1" value={feedBags} onChange={(event) => setFeedBags(event.target.value)} /></label>
            </div>
            {feedSuggestion && (
              <div className="feed-suggestion">
                <div>
                  <strong>Suggestion : {Math.ceil(feedSuggestion.sacs)} sacs de {feedSuggestion.reference.feed_type}</strong>
                  <span>{selectedFeedLot?.label} · {feedSuggestion.age} jours · {formatNombre(selectedFeedLot?.restants || 0)} sujets restants</span>
                </div>
                <button type="button" onClick={() => setFeedBags(String(Math.ceil(feedSuggestion.sacs)))}>
                  Utiliser
                </button>
              </div>
            )}
            <div className="poultry-form-stack feed-note-field">
              <label>Note facultative<input type="text" value={feedNote} onChange={(event) => setFeedNote(event.target.value)} /></label>
            </div>
            <div className="poultry-modal-actions">
              <button type="button" className="poultry-modal-secondary" onClick={() => setFeedModalOpen(false)} disabled={saving}>Annuler</button>
              <button type="button" className="poultry-modal-primary" onClick={saveFeedConsumption} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
