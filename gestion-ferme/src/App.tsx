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
import Planning from './pages/Planning';
import Sauvegardes from './pages/Sauvegardes';
import Parametres from './pages/Parametres';
import VolaillesResume from './volailles/VolaillesResume';

import AlimentationPage from './volailles/alimentationPage'
import Historique from './volailles/Historique'; 
import Analyse from './volailles/Analyse';
import AnalyseLot from './volailles/AnalyseLot';
import VenteDirecte from './volailles/VenteDirecte';
import Inventaire from './volailles/Inventaire';



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
                  <Route path="planning" element={<Planning />} />
                  <Route path="sauvegardes" element={<Sauvegardes />} />
                  <Route path="parametres" element={<Parametres />} />
                  <Route path="volailles" element={<VolaillesResume />} />
                  <Route path="/volailles/sica" element={<Volailles />} />
                  <Route path="aquaponie" element={<Aquaponie />} />
                  <Route path="cultures" element={<Cultures />} />
                  <Route path="ovins" element={<Ovins />} />
                  <Route path="/volailles/alimentation" element={<AlimentationPage />} />
                  <Route path="/volailles/vente-directe" element={<VenteDirecte />} />
                  <Route path="/volailles/vente-directe/historique" element={<VenteDirecte />} />
                  <Route path="/volailles/historique" element={<Historique />} />
                  <Route path="/volailles/sica/historique" element={<Historique />} />
                  <Route path="/volailles/historique/:lotId/analyse" element={<AnalyseLot />} />
                  <Route path="/volailles/sica/historique/:lotId/analyse" element={<AnalyseLot />} />
                  <Route path="/volailles/analyse" element={<Navigate to="/volailles/analyse/sica" replace />} />
                  <Route path="/volailles/analyse/sica" element={<Analyse />} />
                  <Route path="/volailles/analyse/vente-directe" element={<Analyse />} />
                  <Route path="/volailles/inventaire" element={<Inventaire />} />
                  <Route path="/volailles/statistiques" element={<Navigate to="/volailles/analyse/sica" replace />} />
                  <Route path="/volailles/analyseeconomie" element={<Navigate to="/volailles/analyse/sica?onglet=economie" replace />} />
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
