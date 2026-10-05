import { createBrowserRouter, redirect } from 'react-router'
import { getAuthToken } from '#/lib/auth-token.ts'
import { RootLayout, RootErrorBoundary } from '#/routes/root-layout.tsx'
import { AuthedLayout } from '#/routes/authed-layout.tsx'
import { HomePage } from '#/routes/home-page.tsx'
import { LoginPage } from '#/routes/login-page.tsx'
import { RegisterPage } from '#/routes/register-page.tsx'

// Login/register are pointless while a token is stored — bounce to home.
// Token presence only (no network call); `AuthedLayout` validates the session.
const redirectIfAuthed = () => (getAuthToken() ? redirect('/') : null)

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        // Pathless layout: every child route requires a stored session token.
        Component: AuthedLayout,
        children: [{ index: true, Component: HomePage }],
      },
      { path: 'login', loader: redirectIfAuthed, Component: LoginPage },
      { path: 'register', loader: redirectIfAuthed, Component: RegisterPage },
    ],
  },
])
