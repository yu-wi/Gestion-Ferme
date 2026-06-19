import { Navigate, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import AuthGate from './components/AuthGate';
import { Toaster } from "react-hot-toast";

import './App.css';

import Volailles from './pages/Volailles';
import Aquaponie from './pages/Aquaponie';
import Cultures from './pages/Cultures';
import Ovins from './pages/Ovins';
import Accueil from './pages/Accueil'; 

import AlimentationPage from './volailles/alimentationPage'
import Historique from './volailles/Historique'; 
import Analyse from './volailles/Analyse';
import AnalyseLot from './volailles/AnalyseLot';



function App() {
  return (
    <AuthGate>
      {(session, profile) => {
        const legacyUserName = import.meta.env.VITE_AUTH_USERNAME?.trim();
        const userName =
          profile?.display_name ||
          profile?.username ||
          legacyUserName ||
          (session.user.email ?? '').split('@')[0];

        return (
          <div className="app-shell">
            <Header
              userEmail={userName}
              userRole={profile?.role || (legacyUserName ? "admin" : undefined)}
            />
            <Toaster position="top-right" reverseOrder={false} />
            <div className="app-content">
              <main className="app-main">
                <Routes>
                  <Route index element={<Accueil userName={userName} />} />
                  <Route path="volailles" element={<Volailles />} />
                  <Route path="aquaponie" element={<Aquaponie />} />
                  <Route path="cultures" element={<Cultures />} />
                  <Route path="ovins" element={<Ovins />} />
                  <Route path="/volailles/alimentation" element={<AlimentationPage />} />
                  <Route path="/volailles/historique" element={<Historique />} />
                  <Route path="/volailles/historique/:lotId/analyse" element={<AnalyseLot />} />
                  <Route path="/volailles/analyse" element={<Analyse />} />
                  <Route path="/volailles/statistiques" element={<Navigate to="/volailles/analyse" replace />} />
                  <Route path="/volailles/analyseeconomie" element={<Navigate to="/volailles/analyse?onglet=economie" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </div>
        );
      }}
    </AuthGate>
  );
}

export default App;
