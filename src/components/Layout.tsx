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
      <main className="flex flex-col items-center w-full max-w-7xl mx-auto px-4">
        <Outlet />
      </main>
    </div>
  );
};