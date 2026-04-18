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
import RegisterNewAthlete from './pages/RegisterNewAthlete'
import AdminDashboard from './pages/AdminDashboard'
import CoachDashboard from './pages/CoachDashboard'
import Payment from './pages/Payment'
import RegistrationSuccess from './pages/registration/Success'
import TrainingLab from './pages/TrainingLab'
import ParentDetailView from './pages/ParentDetailView'

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchRole(session.user.id)
      }

      setLoading(false)
    })

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
      <Route element={<Layout />}>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/registration/success" element={<RegistrationSuccess />} />
        <Route path="/training-lab" element={<TrainingLab />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/register/new" element={<RegisterNewAthlete />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/parent/:id" element={<ParentDetailView />} />
          <Route path="/coach" element={<CoachDashboard />} />
          <Route path="/payment" element={<Payment />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App