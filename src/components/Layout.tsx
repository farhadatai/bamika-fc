import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { DashboardHeader } from './DashboardHeader';

export const Layout = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') || 
                      location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/coach') ||
                      location.pathname.startsWith('/home'); // Added /home to dashboard routes

  return (
    <div className="min-h-screen bg-black text-white">
      {isDashboard ? (
        <div className="flex flex-col">
          <DashboardHeader />
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      ) : (
        <>
          <Navbar />
          <main>
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
};