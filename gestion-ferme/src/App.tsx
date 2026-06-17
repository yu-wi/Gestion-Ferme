import { Routes, Route } from 'react-router-dom';
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
import Statistiques from './volailles/Statistiques'; 
import AnalyseEconomie from './volailles/AnalyseEconomie'; 



function App() {
  return (
    <AuthGate>
      {(session) => (
        <>
          <Header userEmail={session.user.email ?? ''} />
          <Toaster position="top-right" reverseOrder={false} />
          <div className="p-4">
            <Routes>
              {/* Page d'accueil avec le planning */}
              <Route index element={<Accueil />} />

              {/* Pages internes */}
              <Route path="volailles" element={<Volailles />} />
              <Route path="aquaponie" element={<Aquaponie />} />
              <Route path="cultures" element={<Cultures />} />
              <Route path="ovins" element={<Ovins />} />

              <Route path="/volailles/alimentation" element={<AlimentationPage />} />
              <Route path="/volailles/historique" element={<Historique />} />
              <Route path="/volailles/statistiques" element={<Statistiques />} />
              <Route path="/volailles/analyseeconomie" element={<AnalyseEconomie />} />

            </Routes>
          </div>
          <Footer />
        </>
      )}
    </AuthGate>
  );
}

export default App;
