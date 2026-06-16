// src/components/Layout.tsx
import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div>
      <header style={{ background: '#4CAF50', padding: '1rem', color: 'white' }}>
        <nav>
          <Link to="/" style={{ marginRight: '1rem', color: 'white' }}>Accueil</Link>
          <Link to="/volailles" style={{ marginRight: '1rem', color: 'white' }}>Volailles</Link>
          <Link to="/aquaponie" style={{ marginRight: '1rem', color: 'white' }}>Aquaponie</Link>
          <Link to="/cultures" style={{ marginRight: '1rem', color: 'white' }}>Cultures</Link>
          <Link to="/ovins" style={{ color: 'white' }}>Ovins</Link>
        </nav>
      </header>
      <main style={{ padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
