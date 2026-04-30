import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
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

const isMissingProfileColumnError = (message?: string) => (
  !!message
  && message.includes('schema cache')
  && message.includes('profiles')
  && (
    message.includes('first_name')
    || message.includes('last_name')
    || message.includes('email')
    || message.includes('role')
  )
)

function App() {
  const { setUser, setUserRole, setLoading } = useAuthStore()

  useEffect(() => {
    const fetchRole = async (user: User) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (data) {
        setUserRole(data.role)
        return
      }

      if (isMissingProfileColumnError(error?.message)) {
        setUserRole('user')
        return
      }

      const meta = user.user_metadata || {}
      const firstName = typeof meta.first_name === 'string' ? meta.first_name : ''
      const lastName = typeof meta.last_name === 'string' ? meta.last_name : ''
      const phone = typeof meta.phone === 'string' ? meta.phone : ''
      const fullName = typeof meta.full_name === 'string' ? meta.full_name : `${firstName} ${lastName}`.trim()

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          email: user.email,
          phone,
          role: 'user',
        }, { onConflict: 'id' })
        .select('role')
        .single()

      if (createdProfile) {
        setUserRole(createdProfile.role)
        return
      }

      if (isMissingProfileColumnError(createError?.message)) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: fullName,
            phone,
          }, { onConflict: 'id' })

        setUserRole('user')
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchRole(session.user)
      }

      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchRole(session.user)
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
          <Route path="/register-new-athlete" element={<RegisterNewAthlete />} />
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
