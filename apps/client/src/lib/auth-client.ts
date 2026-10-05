import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'
import { getAuthToken, setAuthToken, clearAuthToken } from './auth-token'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  fetchOptions: {
    auth: { type: 'Bearer', token: () => getAuthToken() ?? '' },
    // Only sign-in/sign-up responses carry `set-auth-token` (exposed via CORS
    // in packages/api/src/index.ts) — this fires for every authClient call, so
    // a single guard here covers both. No call site may pass its own
    // `fetchOptions.onSuccess`: better-auth lets a per-call one override this
    // global one, silently dropping the token capture.
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get('set-auth-token')
      if (token) setAuthToken(token)
    },
  },
  plugins: [usernameClient()],
})

export type SessionUser = { id: string; username: string; role: string }

// Collapses every failure (network error, no session, API down) to `null` and
// never throws. Callers decide what "not logged in" means for their own route.
export async function getSessionUser(): Promise<SessionUser | null> {
  // No token → logged out; skip a request that could never succeed.
  if (!getAuthToken()) return null
  try {
    const { data } = await authClient.getSession()
    if (!data?.user) return null

    const { user } = data
    return {
      id: user.id,
      // `username` is optional in Better Auth's schema; fall back to the
      // required `name` (sign-up sends `name: username`) so the Header never
      // renders blank. Same fallback as the API's checkAuth macro.
      username: user.username ?? user.name,
      // `role` is a server-only `user.additionalFields` entry (packages/api/src/auth.ts),
      // not surfaced by `usernameClient()`'s `$InferServerPlugin` — the client's
      // generated user type has no `role` key, so a cast is required here even
      // though the value is genuinely present on the wire.
      role: (user as { role?: string }).role ?? 'user',
    }
  } catch {
    return null
  }
}

// A server-side session delete doesn't remove the client's localStorage
// copy — clear it explicitly, even when the network call fails, so a stale
// token never keeps attaching itself to requests after sign-out.
export async function signOut(): Promise<void> {
  try {
    await authClient.signOut()
  } finally {
    clearAuthToken()
  }
}
