import { Link, useLocation } from 'react-router-dom';
import type { FC } from 'react';
import chickenLogo from "../assets/chicken.svg";
import fishLogo from "../assets/fish.svg";
import plantsLogo from "../assets/plants.svg";
import sheepLogo from "../assets/sheep.svg";


const Header: FC = () => {
  const location = useLocation();

  const isVolaillesPage = location.pathname.startsWith("/volailles");

  return (
    <header
      style={{
        padding: '10px 20px',
        backgroundColor: '#ce7644aa',
        color: 'white',
        borderRadius: '10px',
        marginBottom: '20px',
      }} >
        
      {/* Titre */}  
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
          Gestion SCEA La Ferme de Bernard
        </h1>
      </div>

      {/* Menu principal */}
      <nav>
        <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', margin: 0, padding: 0, justifyContent: 'center' }}>
          <li><Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Accueil</Link></li>
          <li>
            <Link to="/volailles" style={{ color: 'white', textDecoration: 'none' }}>
              <img src={chickenLogo} alt="Volailles" style={{ width: '30px', height: '30px', marginBottom: '5px' }} />
              Volailles
            </Link>
          </li>
          <li>
            <Link to="/aquaponie" style={{ color: 'white', textDecoration: 'none' }}>
              <img src={fishLogo} alt="Aquaponie" style={{ width: '30px', height: '30px', marginBottom: '5px' }} />
              Aquaponie
            </Link>
          </li>
          <li>
            <Link to="/cultures" style={{ color: 'white', textDecoration: 'none' }}>
              <img src={plantsLogo} alt="Cultures" style={{ width: '30px', height: '30px', marginBottom: '5px' }} />
              Cultures
            </Link>
          </li>
          <li>
            <Link to="/ovins" style={{ color: 'white', textDecoration: 'none' }}>
              <img src={sheepLogo} alt="Ovins" style={{ width: '30px', height: '30px', marginBottom: '5px' }} />
              Ovins
            </Link>
          </li>
        </ul>
      </nav>

      {/* Sous-catégories pour "Volailles" */}
      {isVolaillesPage && (
        <nav style={{ marginTop: '10px', backgroundColor: '#d4945acc', borderRadius: '8px', padding: '5px 15px' }}>
          <ul style={{ display: 'flex', gap: '15px', listStyle: 'none', margin: 0, padding: 0, justifyContent: 'center' }}>
            <li><Link to="/volailles/alimentation" style={{ color: 'white', textDecoration: 'none' }}>Alimentation</Link></li>
            <li><Link to="/volailles/historique" style={{ color: 'white', textDecoration: 'none' }}>Historique</Link></li>
            <li><Link to="/volailles/statistiques" style={{ color: 'white', textDecoration: 'none' }}>Statistiques</Link></li>
            <li><Link to="/volailles/analyseeconomie" style={{ color: 'white', textDecoration: 'none' }}>Analyse économique</Link></li>

          </ul>
        </nav>
      )}
    </header>
  );
};

export default Header;
