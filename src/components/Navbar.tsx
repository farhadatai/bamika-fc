import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, userRole } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-black/95 border-b border-gray-800 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-4 text-2xl heading-bamika">
              <img src="/logo.png" alt="Bamika FC Logo" className="h-10 w-auto" />
              <span>BAMIKA <span className="text-[#D4AF37]">FC</span></span>
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                  {userRole === 'admin' && (
                    <Link to="/admin" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Admin</Link>
                  )}
                  {userRole === 'coach' && (
                    <Link to="/coach" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Coach</Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="bg-[#EF4444] text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Login</Link>
                  <Link to="/register" className="bg-[#EF4444] text-white px-3 py-2 rounded-md text-sm font-medium">Register</Link>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-700 text-gray-200 hover:border-[#EF4444] hover:text-white"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-black px-4 pb-5 pt-3">
          <div className="flex flex-col gap-2">
            {user ? (
              <>
                <Link onClick={closeMobileMenu} to="/dashboard" className="rounded-md px-3 py-3 text-sm font-medium text-gray-200 hover:bg-gray-800">Dashboard</Link>
                {userRole === 'admin' && (
                  <Link onClick={closeMobileMenu} to="/admin" className="rounded-md px-3 py-3 text-sm font-medium text-gray-200 hover:bg-gray-800">Admin</Link>
                )}
                {userRole === 'coach' && (
                  <Link onClick={closeMobileMenu} to="/coach" className="rounded-md px-3 py-3 text-sm font-medium text-gray-200 hover:bg-gray-800">Coach</Link>
                )}
                <button
                  onClick={handleLogout}
                  className="rounded-md bg-[#EF4444] px-3 py-3 text-left text-sm font-bold text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link onClick={closeMobileMenu} to="/login" className="rounded-md px-3 py-3 text-sm font-medium text-gray-200 hover:bg-gray-800">Login</Link>
                <Link onClick={closeMobileMenu} to="/register" className="rounded-md bg-[#EF4444] px-3 py-3 text-sm font-bold text-white">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
