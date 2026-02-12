import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/auth'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/Home'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import PlayerRegistration from './pages/PlayerRegistration'
import AdminDashboard from './pages/AdminDashboard'
import CoachDashboard from './pages/CoachDashboard'
import Payment from './pages/Payment'

function App() {
  const { setUser, setUserRole, setLoading } = useAuthStore()

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      
      if (data) {
        setUserRole(data.role)
      }
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user.id)
      }
      setLoading(false)
    })

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user.id)
      } else {
        setUserRole(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setUserRole, setLoading])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      
      <Route element={<Layout />}>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/register/new" element={<PlayerRegistration />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/coach" element={<CoachDashboard />} />
          <Route path="/payment" element={<Payment />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
