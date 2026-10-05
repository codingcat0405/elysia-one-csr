import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { clearAuthToken, getAuthToken } from '#/lib/auth-token.ts'
import { getSessionUser } from '#/lib/auth-client.ts'
import { useUserStore } from '#/stores/user-store.ts'

// Pathless layout wrapping every authenticated screen. The only place that
// gates access and invalidates a stored token:
//   1. no token in localStorage      → render nothing, redirect to /login
//   2. token present                 → render children right away
//   3. sync the Better Auth session  → zustand user store; if the session is
//      invalid/expired/revoked, clear token + store and redirect to /login.
// UX only — the API's `checkAuth` is the real security boundary.
export function AuthedLayout() {
  // Read once on mount (pure CSR, localStorage is always available here).
  const [hasToken] = useState(() => getAuthToken() !== null)
  const setUser = useUserStore((s) => s.setUser)
  const clearUser = useUserStore((s) => s.clearUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (!hasToken) {
      void navigate('/login', { replace: true })
      return
    }

    let cancelled = false
    void getSessionUser().then((user) => {
      // Token gone = user logged out while this request was in flight; don't
      // re-populate the store with the stale session.
      if (cancelled || !getAuthToken()) return
      if (user) {
        setUser(user)
        return
      }
      clearAuthToken()
      clearUser()
      void navigate('/login', { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [hasToken, setUser, clearUser, navigate])

  return hasToken ? <Outlet /> : null
}
