import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/coach');

  return (
    <div className="min-h-screen bg-black">
      {isDashboard ? (
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="p-4">
              <Outlet />
            </main>
          </div>
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