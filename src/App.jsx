import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, onAuthChange } from './lib/firebase';
import { query } from './lib/database';
import Header from './components/Header';
import Footer from './components/Footer';
import Catalog from './pages/Catalog';
import StudioPage from './pages/StudioPage';
import ServicePage from './pages/ServicePage';
import ProfilePage from './pages/ProfilePage';
import CreditsPage from './pages/CreditsPage';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard';

function AboutPage() { return <div className="container"><h1>О нас</h1><p>Мы - профессиональная студия медиаконтента! Пока все, MVP все таки</p></div>; }
function EmployeesPage() { return <div className="container"><h1>Наши сотрудники</h1><p>Страница в разработке</p></div>; }

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await query(
          "SELECT role FROM user_profiles WHERE user_phone = ?",
          [currentUser.phoneNumber]
        );
        setUserRole(profile[0]?.role || 'client');
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="container"><p>Загрузка...</p></div>;
  }

  return (
    <BrowserRouter>
      <Header userRole={userRole} />
      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        <Routes>
          {/* Общие страницы */}
          <Route path="/" element={<Catalog />} />
          <Route path="/studio/:studioId" element={<StudioPage />} />
          <Route path="/service/:serviceId" element={<ServicePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          
          {/* Страница работника (доступ только с ролью worker или admin) */}
          <Route 
            path="/worker" 
            element={
              userRole === 'worker' || userRole === 'admin' ? 
                <WorkerDashboard /> : 
                <Navigate to="/" />
            } 
          />
          
          {/* Страница админа (доступ только с ролью admin) */}
          <Route 
            path="/admin" 
            element={
              userRole === 'admin' ? 
                <AdminDashboard /> : 
                <Navigate to="/" />
            } 
          />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;