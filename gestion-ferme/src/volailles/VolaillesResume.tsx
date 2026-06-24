import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
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

function PoultrySubnav() {
  return (
    <nav className="poultry-tabs" aria-label="Sections volailles">
      <Link to="/volailles" className="poultry-tab-active">Résumé</Link>
      <Link to="/volailles/sica">Lots SICA Madras</Link>
      <Link to="/volailles/sica/historique">Historique SICA</Link>
      <Link to="/volailles/vente-directe">Vente directe</Link>
      <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
      <Link to="/volailles/alimentation">Alimentation</Link>
    </nav>
  );
}

export default function VolaillesResume() {
  const [sicaLots, setSicaLots] = useState<SicaLot[]>([]);
  const [directLots, setDirectLots] = useState<DirectLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [directAvailable, setDirectAvailable] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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

      setLoading(false);
    };
    load();
  }, []);

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
      if (taux >= 3) {
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

      <section className="poultry-kpis">
        <article className="poultry-kpi">
          <i className="poultry-kpi-icon poultry-kpi-green">▣</i><div><small>Lots SICA Madras</small><strong>{formatNombre(sicaLots.length)}</strong><em>{formatNombre(sujetsSica)} sujets</em></div>
        </article>
        <article className="poultry-kpi">
          <i className="poultry-kpi-icon poultry-kpi-blue">◎</i><div><small>Lots Vente directe</small><strong>{formatNombre(directLots.length)}</strong><em>{formatNombre(sujetsDirect)} sujets</em></div>
        </article>
        <article className="poultry-kpi">
          <i className="poultry-kpi-icon poultry-kpi-red">†</i><div><small>Mortalités</small><strong>{formatNombre(mortalites)}</strong><em>Tous lots actifs</em></div>
        </article>
        <article className="poultry-kpi">
          <i className="poultry-kpi-icon poultry-kpi-orange">!</i><div><small>Alertes planning</small><strong>{formatNombre(alertes.length)}</strong><em>Sur 7 jours</em></div>
        </article>
      </section>

      <section className="poultry-summary-grid">
        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Lots actifs SICA Madras</h2>
            <Link to="/volailles/sica">Voir la gestion</Link>
          </div>
          <div className="poultry-summary-list">
            {sicaLots.slice(0, 6).map((lot) => (
              <Link key={lot.id} to="/volailles/sica" className="poultry-summary-row">
                <span>▣</span>
                <div><strong>{lot.nom}</strong><small>{lot.batiment || "Bâtiment non renseigné"} · Arrivé le {formatDate(lot.date_arrivee)}</small></div>
                <b>{formatNombre(lot.sujets_restants ?? lot.quantite)} sujets</b>
              </Link>
            ))}
            {sicaLots.length === 0 && <div className="poultry-empty">Aucun lot SICA actif.</div>}
          </div>
        </article>

        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Lots actifs Vente directe</h2>
            <Link to="/volailles/vente-directe">Voir la gestion</Link>
          </div>
          <div className="poultry-summary-list">
            {directLots.slice(0, 6).map((lot) => (
              <Link key={lot.id} to="/volailles/vente-directe" className="poultry-summary-row">
                <span>◎</span>
                <div><strong>{lot.name}</strong><small>{directSpeciesLabel(lot.species)} · {lot.location || "Emplacement non renseigné"}</small></div>
                <b>{formatNombre(lot.remaining_quantity)} sujets</b>
              </Link>
            ))}
            {directLots.length === 0 && <div className="poultry-empty">Aucun lot vente directe actif.</div>}
          </div>
        </article>

        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Alertes planning</h2>
            <Link to="/planning">Voir le planning</Link>
          </div>
          <div className="poultry-alert-list">
            {alertes.map((alerte) => (
              <Link key={alerte.id} to={alerte.to} className={`poultry-alert poultry-alert-${alerte.tone}`}>
                <span>{alerte.icon}</span><div><strong>{alerte.title}</strong><small>{alerte.detail}</small></div>
              </Link>
            ))}
            {alertes.length === 0 && <div className="poultry-empty">Aucune alerte sur les 7 prochains jours.</div>}
          </div>
        </article>

        <article className="poultry-panel">
          <div className="poultry-panel-heading">
            <h2>Raccourcis de saisie</h2>
            <span>Lots SICA et vente directe</span>
          </div>
          <div className="poultry-shortcuts">
            <Link to="/volailles/sica">† Mortalité SICA</Link>
            <Link to="/volailles/vente-directe">† Mortalité vente directe</Link>
            <Link to="/volailles/alimentation">▣ Saisir alimentation</Link>
            <Link to="/volailles/alimentation">🚚 Livraison aliment</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
