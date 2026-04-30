import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

export const Layout = () => {
  const location = useLocation();
  const isPublicMarketingPage =
    location.pathname === '/' || location.pathname === '/home' || location.pathname === '/training-lab';

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
