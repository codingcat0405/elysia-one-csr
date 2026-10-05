// Bearer token storage — the ONLY module that touches the token's
// localStorage key. The token is attached as `Authorization: Bearer` on every
// request (see auth-client.ts / eden-client.ts). Storage access is try/catch'd
// (Safari private mode / storage disabled) and degrades to "logged out".
const AUTH_TOKEN_KEY = 'elysia-one.auth_token'

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // storage unavailable — nothing to do, the app degrades to logged-out
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // storage unavailable — nothing to do
  }
}
