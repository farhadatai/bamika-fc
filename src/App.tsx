import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/auth'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/Home'
import LandingPage from './pages/LandingPage'
import ClubPage from './pages/ClubPage'
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
import CoachSetupPassword from './pages/CoachSetupPassword'

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
  const { user, setUser, setUserRole, setLoading } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const maybeOpenCoachSetup = (role?: string | null, signedInUser?: User | null) => {
      const metadataRole = typeof signedInUser?.user_metadata?.role === 'string' ? signedInUser.user_metadata.role : ''
      const authReturn = `${window.location.search}${window.location.hash}`
      const isInviteReturn = authReturn.includes('type=invite')
        || authReturn.includes('type=recovery')
        || authReturn.includes('token_hash=')
        || authReturn.includes('access_token=')

      if ((role === 'coach' || metadataRole === 'coach') && isInviteReturn && window.location.pathname !== '/coach/setup-password') {
        navigate('/coach/setup-password', { replace: true })
      }
    }

    const fetchRole = async (user: User) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (data) {
        setUserRole(data.role)
        maybeOpenCoachSetup(data.role, user)
        return
      }

      if (isMissingProfileColumnError(error?.message)) {
        setUserRole('user')
        maybeOpenCoachSetup(user.user_metadata?.role === 'coach' ? 'coach' : 'user', user)
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
        maybeOpenCoachSetup(createdProfile.role, user)
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
        maybeOpenCoachSetup(user.user_metadata?.role === 'coach' ? 'coach' : 'user', user)
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
  }, [setUser, setUserRole, setLoading, navigate, location.pathname])

  useEffect(() => {
    if (!user) return

    const timeoutMs = 30 * 60 * 1000
    let timeoutId = window.setTimeout(handleIdleLogout, timeoutMs)

    async function handleIdleLogout() {
      await supabase.auth.signOut()
      window.location.assign('/login')
    }

    const resetTimer = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(handleIdleLogout, timeoutMs)
    }

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))

    return () => {
      window.clearTimeout(timeoutId)
      events.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [user])

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/club" element={<ClubPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/registration/success" element={<RegistrationSuccess />} />
        <Route path="/training-lab" element={<TrainingLab />} />
        <Route path="/coach/setup-password" element={<CoachSetupPassword />} />

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
