import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';

export const DashboardHeader = () => {
  const { setUser, setLoading, setIsLoggingOut } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setLoading(false);
      setIsLoggingOut(false);
      navigate('/login');
    }
  };

  return (
    <header className="bg-black border-b border-gray-800 h-16 flex items-center px-4 justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/logo.png" alt="Bamika FC" className="h-8 w-auto" />
          <span className="text-xl font-bold tracking-tighter uppercase text-white">
            Bamika <span className="text-[#EF4444]">FC</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-300 hover:text-white transition-colors font-medium">Home</Link>
          <Link to="/admin" className="text-gray-300 hover:text-white transition-colors font-medium">Admin</Link>
          <Link to="/coach" className="text-gray-300 hover:text-white transition-colors font-medium">Coach</Link>
        </nav>
      </div>
      <button onClick={handleLogout} className="bg-primary px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors text-white">
        Logout
      </button>
    </header>
  );
};