import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bamika FC — Elk Grove Youth Soccer',
  '/home': 'Bamika FC — Elk Grove Youth Soccer',
  '/club': 'Our Club | Bamika FC',
  '/login': 'Login | Bamika FC',
  '/register': 'Join Bamika FC',
  '/registration/success': 'Registration Complete | Bamika FC',
  '/training-lab': 'Training Lab | Bamika FC',
  '/live': 'Live | Bamika FC',
  '/dashboard': 'Family Dashboard | Bamika FC',
  '/register-new-athlete': 'Register a Player | Bamika FC',
  '/admin': 'Admin | Bamika FC',
  '/coach': 'Coach Dashboard | Bamika FC',
  '/payment': 'Payment | Bamika FC',
};

export const Layout = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'Bamika FC — Elk Grove Youth Soccer';
  }, [location.pathname]);
  const isPublicMarketingPage =
    location.pathname === '/' || location.pathname === '/home' || location.pathname === '/training-lab' || location.pathname === '/club';

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main
        className={
          isPublicMarketingPage
            ? 'flex flex-col items-stretch w-full'
            : 'flex flex-col items-center w-full max-w-7xl mx-auto px-4'
        }
      >
        <Outlet />
      </main>
    </div>
  );
};
