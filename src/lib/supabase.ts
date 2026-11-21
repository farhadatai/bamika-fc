import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---------------------------------------------------------------------------
// Keep our own API calls logged in.
//
// Pages call /api/... with "Authorization: Bearer <access token>". The server
// re-checks that token with Supabase. A browser tab that stayed open can hold a
// token Supabase no longer accepts (expired, or the session was ended on the
// Supabase side) - database reads still work from cache/RLS, but every server
// action failed with "Invalid admin session" / "Invalid coach session".
//
// This wraps fetch once, for every page: if one of our API calls comes back
// 401, renew the session and retry once with the fresh token. If the session
// cannot be renewed, sign out and send the person to log in again with a clear
// message, instead of leaving buttons that silently fail.
// ---------------------------------------------------------------------------

const isOwnApiCall = (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

const readAuthHeader = (init?: RequestInit) => {
  const headers = new Headers(init?.headers || {})
  return headers.get('Authorization')
}

let renewing: Promise<string | null> | null = null

// One renewal at a time, shared by every call that hit a 401 together.
const renewAccessToken = () => {
  if (!renewing) {
    renewing = supabase.auth.refreshSession()
      .then(({ data, error }) => (error || !data.session ? null : data.session.access_token))
      .catch(() => null)
      .finally(() => { window.setTimeout(() => { renewing = null }, 0) })
  }
  return renewing
}

let sendingToLogin = false

const LOGIN_REDIRECT_KEY = 'bamika:login-redirect-at'

const sendToLogin = async () => {
  if (sendingToLogin) return
  // If we already sent them to log in a few minutes ago and the server still
  // refuses a brand-new login, the problem is not their session - don't loop.
  try {
    const last = Number(window.sessionStorage.getItem(LOGIN_REDIRECT_KEY) || 0)
    if (Date.now() - last < 5 * 60 * 1000) return
    window.sessionStorage.setItem(LOGIN_REDIRECT_KEY, String(Date.now()))
  } catch {
    // Storage blocked: fall through and redirect once.
  }
  sendingToLogin = true
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } finally {
    window.location.assign('/login?session=expired')
  }
}

if (typeof window !== 'undefined' && !(window as unknown as { __bamikaFetchWrapped?: boolean }).__bamikaFetchWrapped) {
  (window as unknown as { __bamikaFetchWrapped?: boolean }).__bamikaFetchWrapped = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init)
    const authHeader = readAuthHeader(init)
    if (response.status !== 401 || !authHeader?.startsWith('Bearer') || !isOwnApiCall(input)) return response

    const freshToken = await renewAccessToken()
    if (!freshToken) {
      void sendToLogin()
      return response
    }

    const headers = new Headers(init?.headers || {})
    headers.set('Authorization', `Bearer ${freshToken}`)
    const retried = await originalFetch(input, { ...init, headers })
    if (retried.status === 401) void sendToLogin()
    return retried
  }
}
