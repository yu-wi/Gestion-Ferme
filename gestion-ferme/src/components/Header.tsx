import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { FC, ReactNode } from "react";
import chickenLogo from "../assets/chicken.svg";
import fishLogo from "../assets/fish.svg";
import plantsLogo from "../assets/plants.svg";
import sheepLogo from "../assets/sheep.svg";
import { supabase } from "../supabaseClient";
import type { UserRole } from "../auth/userProfile";

type HeaderProps = {
  userEmail: string;
  userRole?: UserRole;
};

type NavigationItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

const production: NavigationItem[] = [
  { to: "/aquaponie", label: "Aquaponie", icon: <img src={fishLogo} alt="" /> },
  { to: "/cultures", label: "Cultures", icon: <img src={plantsLogo} alt="" /> },
  { to: "/ovins", label: "Ovins", icon: <img src={sheepLogo} alt="" /> },
];

const estDansProductionVolailles = (pathname: string) =>
  pathname === "/volailles" ||
  pathname.startsWith("/volailles/sica") ||
  pathname.startsWith("/volailles/vente-directe") ||
  pathname.startsWith("/volailles/alimentation") ||
  pathname.startsWith("/volailles/historique") ||
  pathname.startsWith("/volailles/analyse");

const Header: FC<HeaderProps> = ({ userEmail, userRole }) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [volaillesOpen, setVolaillesOpen] = useState(
    estDansProductionVolailles(location.pathname)
  );

  const fermerMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (estDansProductionVolailles(location.pathname)) {
      setVolaillesOpen(true);
    }
  }, [location.pathname]);

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

          <NavLink
            to="/planning"
            onClick={fermerMenu}
            className={({ isActive }) =>
              `app-nav-link${isActive ? " app-nav-link-active" : ""}`
            }
          >
            <span className="app-nav-icon">□</span>
            <span>Planning</span>
          </NavLink>

          <div className="app-nav-section">Production</div>
          <div className="app-nav-group">
            <div
              className={`app-nav-group-row${
                estDansProductionVolailles(location.pathname)
                  ? " app-nav-group-active"
                  : ""
              }`}
            >
              <NavLink
                to="/volailles"
                end
                onClick={fermerMenu}
                className="app-nav-parent-link"
              >
                <span className="app-nav-icon">
                  <img src={chickenLogo} alt="" />
                </span>
                <span>Volailles</span>
              </NavLink>
              <button
                type="button"
                className="app-nav-toggle"
                onClick={() => setVolaillesOpen((open) => !open)}
                aria-label={
                  volaillesOpen
                    ? "Replier le menu Volailles"
                    : "Déplier le menu Volailles"
                }
                aria-expanded={volaillesOpen}
              >
                {volaillesOpen ? "⌃" : "⌄"}
              </button>
            </div>

            {volaillesOpen && (
              <div className="app-nav-submenu">
                <NavLink
                  to="/volailles"
                  end
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Résumé
                </NavLink>
                <NavLink
                  to="/volailles/sica"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Lots SICA Madras
                </NavLink>
                <NavLink
                  to="/volailles/sica/historique"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Historique SICA
                </NavLink>
                <NavLink
                  to="/volailles/vente-directe"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Vente directe
                </NavLink>
                <NavLink
                  to="/volailles/vente-directe/historique"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Historique vente directe
                </NavLink>
                <NavLink
                  to="/volailles/alimentation"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Alimentation
                </NavLink>
                <NavLink
                  to="/volailles/analyse/sica"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Analyse SICA
                </NavLink>
                <NavLink
                  to="/volailles/analyse/vente-directe"
                  onClick={fermerMenu}
                  className={({ isActive }) =>
                    `app-nav-sublink${isActive ? " app-nav-sublink-active" : ""}`
                  }
                >
                  <span>•</span>
                  Analyse vente directe
                </NavLink>
              </div>
            )}
          </div>
          {liens(production)}
        </nav>

        <div className="app-user-panel">
          <div className="app-user-avatar">
            {userEmail.slice(0, 1).toUpperCase() || "U"}
          </div>
          <div className="app-user-copy">
            <strong>{userEmail || "Utilisateur"}</strong>
            <span>{userRole === "admin" ? "Administrateur" : "Utilisateur"}</span>
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
