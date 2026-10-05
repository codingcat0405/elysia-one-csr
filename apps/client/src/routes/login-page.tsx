import { Link, useNavigate } from 'react-router'
import { AuthForm } from '#/components/auth-form.tsx'
import type { Credentials } from '#/components/auth-form.tsx'
import { authClient } from '#/lib/auth-client.ts'

export function LoginPage() {
  const navigate = useNavigate()

  const handleLogin = async ({ username, password }: Credentials) => {
    // Username-only: the installed better-auth username plugin has no email
    // fallback. authClient's onSuccess stores the `set-auth-token` header.
    const { error } = await authClient.signIn.username({ username, password })
    if (error) throw error // AuthForm renders error.message inline
    // No setUser here — AuthedLayout owns syncing the session into the store.
    await navigate('/')
  }

  return (
    <AuthForm
      title="Sign in"
      description="Enter your credentials to access your account."
      submitLabel="Sign in"
      passwordAutoComplete="current-password"
      onSubmit={handleLogin}
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="underline underline-offset-4">
            Create one
          </Link>
        </>
      }
    />
  )
}
