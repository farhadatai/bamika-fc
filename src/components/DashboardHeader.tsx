import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export default function DashboardHeader() {
  const navigate = useNavigate();
  const { user, userRole } = useAuthStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-2xl font-black uppercase italic text-white">
              Bamika <span className="text-[#EF4444]">FC</span>
            </Link>
          </div>
          <div className="flex items-center">
            <div className="text-white mr-4">
              Welcome, <span className="font-bold">{user?.user_metadata.first_name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-[#EF4444] text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
