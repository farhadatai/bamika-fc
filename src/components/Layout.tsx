import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { Shield } from 'lucide-react';

export function Layout() {
  const { user, userRole, setUser, setLoading, setIsLoggingOut } = useAuthStore();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true); // Prevent premature redirect
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setLoading(false);
      setIsLoggingOut(false); // Allow redirect now (or manual navigate below)
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="bg-zinc-950 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="Bamika FC Logo" 
                className="h-10 w-auto group-hover:scale-110 transition-transform bg-transparent" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <Shield className="h-10 w-10 text-white group-hover:text-primary transition-colors" />
            )}
            <span className="text-2xl font-bold tracking-tighter text-white group-hover:text-primary transition-colors">
              BAMIKA <span className="text-primary">FC</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                {user.email === 'admin@bamikafc.com' && (
                  <Link to="/admin" className="hover:text-primary transition-colors font-medium">
                    Admin
                  </Link>
                )}
                {userRole === 'coach' && (
                  <Link to="/coach" className="hover:text-primary transition-colors font-medium">
                    Coach
                  </Link>
                )}
                <Link to="/dashboard" className="hover:text-primary transition-colors font-medium">Dashboard</Link>
                <button 
                  onClick={handleLogout}
                  className="bg-primary px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-primary transition-colors font-medium">Login</Link>
                <Link 
                  to="/register" 
                  className="bg-primary px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors text-white"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4">
        <Outlet />
      </main>
      <footer className="bg-black text-gray-400 p-6 text-center">
        <p>&copy; {new Date().getFullYear()} Bamika FC. All rights reserved.</p>
      </footer>
    </div>
  );
}
