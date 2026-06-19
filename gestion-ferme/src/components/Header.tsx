import { useState } from "react";
import { NavLink } from "react-router-dom";
import type { FC, ReactNode } from "react";
import chickenLogo from "../assets/chicken.svg";
import fishLogo from "../assets/fish.svg";
import plantsLogo from "../assets/plants.svg";
import sheepLogo from "../assets/sheep.svg";
import { supabase } from "../supabaseClient";

type HeaderProps = {
  userEmail: string;
};

type NavigationItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

const production: NavigationItem[] = [
  { to: "/volailles", label: "Volailles", icon: <img src={chickenLogo} alt="" /> },
  { to: "/aquaponie", label: "Aquaponie", icon: <img src={fishLogo} alt="" /> },
  { to: "/cultures", label: "Cultures", icon: <img src={plantsLogo} alt="" /> },
  { to: "/ovins", label: "Ovins", icon: <img src={sheepLogo} alt="" /> },
];

const gestion: NavigationItem[] = [
  { to: "/volailles/alimentation", label: "Alimentation", icon: "◫" },
  { to: "/volailles/historique", label: "Historique", icon: "◷" },
  { to: "/volailles/statistiques", label: "Statistiques", icon: "▥" },
  { to: "/volailles/analyseeconomie", label: "Analyse économique", icon: "◔" },
];

const Header: FC<HeaderProps> = ({ userEmail }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const fermerMenu = () => setMenuOpen(false);

  const liens = (items: NavigationItem[]) =>
    items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={fermerMenu}
        className={({ isActive }) =>
          `app-nav-link${isActive ? " app-nav-link-active" : ""}`
        }
      >
        <span className="app-nav-icon">{item.icon}</span>
        <span>{item.label}</span>
      </NavLink>
    ));

  return (
    <>
      <div className="app-mobile-header">
        <button
          type="button"
          className="app-menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Ouvrir le menu"
        >
          ☰
        </button>
        <div>
          <div className="app-mobile-brand">La Ferme de Bernard</div>
          <div className="app-mobile-subtitle">Gestion agricole</div>
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          className="app-sidebar-overlay"
          onClick={fermerMenu}
          aria-label="Fermer le menu"
        />
      )}

      <aside className={`app-sidebar${menuOpen ? " app-sidebar-open" : ""}`}>
        <div className="app-brand">
          <div className="app-brand-mark">
            <img src={chickenLogo} alt="" />
          </div>
          <div>
            <div className="app-brand-name">La Ferme<br />de Bernard</div>
            <div className="app-brand-subtitle">Gestion agricole</div>
          </div>
        </div>

        <nav className="app-navigation" aria-label="Navigation principale">
          <NavLink
            to="/"
            end
            onClick={fermerMenu}
            className={({ isActive }) =>
              `app-nav-link${isActive ? " app-nav-link-active" : ""}`
            }
          >
            <span className="app-nav-icon">⌂</span>
            <span>Accueil</span>
          </NavLink>

          <div className="app-nav-section">Production</div>
          {liens(production)}

          <div className="app-nav-section">Gestion</div>
          {liens(gestion)}
        </nav>

        <div className="app-user-panel">
          <div className="app-user-avatar">
            {userEmail.slice(0, 1).toUpperCase() || "U"}
          </div>
          <div className="app-user-copy">
            <strong>{userEmail || "Utilisateur"}</strong>
            <span>Administrateur</span>
          </div>
          <button
            type="button"
            className="app-logout-button"
            onClick={() => supabase.auth.signOut()}
            title="Déconnexion"
          >
            ↪
          </button>
        </div>
      </aside>
    </>
  );
};

export default Header;
