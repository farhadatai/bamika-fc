import React from 'react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const Header = () => {
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
    <header className="bg-white shadow p-4 flex justify-end">
      <button onClick={handleLogout} className="bg-primary px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors text-white">
        Logout
      </button>
    </header>
  );
};