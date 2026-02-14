import { create } from 'zustand'
import { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  userRole: string | null
  setUser: (user: User | null) => void
  setUserRole: (role: string | null) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  isLoggingOut: boolean
  setIsLoggingOut: (isLoggingOut: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userRole: null,
  setUser: (user) => set({ user }),
  setUserRole: (role) => set({ userRole: role }),
  loading: true,
  setLoading: (loading) => set({ loading }),
  isLoggingOut: false,
  setIsLoggingOut: (isLoggingOut) => set({ isLoggingOut }),
}))
