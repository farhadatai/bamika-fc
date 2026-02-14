import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { Shield, LogOut } from 'lucide-react'

export const Navbar = () => {
  const { user, userRole, setLoading, setIsLoggingOut } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
      setIsLoggingOut(false)
      navigate('/login')
    }
  }

  return (
    <nav className="bg-black text-white border-b border-white/10">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/logo.png" alt="Bamika FC" className="h-10 w-auto" />
          <span className="text-xl font-bold tracking-tighter uppercase text-white">
            Bamika <span className="text-[#EF4444]">FC</span>
          </span>
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              {userRole === 'admin' && (
                <Link to="/admin" className="font-bold text-red-500 hover:text-red-400 transition-colors">
                  Admin
                </Link>
              )}
              {userRole === 'coach' && (
                <Link to="/coach" className="font-bold text-blue-500 hover:text-blue-400 transition-colors">
                  Coach
                </Link>
              )}
              
              <Link to="/dashboard" className="hover:text-primary transition-colors">
                Dashboard
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden md:inline-block">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm hover:text-destructive transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="hover:text-primary transition-colors">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-primary text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors"
              >
                Join Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
