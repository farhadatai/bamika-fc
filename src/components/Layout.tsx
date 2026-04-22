import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import DashboardHeader from './DashboardHeader';

export const Layout = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') || 
                      location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/coach');

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
};