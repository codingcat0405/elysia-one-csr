import { Link, useNavigate } from 'react-router'
import { AuthForm } from '#/components/auth-form.tsx'
import type { Credentials } from '#/components/auth-form.tsx'
import { authClient } from '#/lib/auth-client.ts'

export function RegisterPage() {
  const navigate = useNavigate()

  const handleRegister = async ({ username, email, password }: Credentials) => {
    // better-auth's username plugin has no `signUp.username` — sign up via
    // `signUp.email` with `username` as an extra field. `email!` is safe:
    // `emailField` below makes the input required. Sign-up returns a session
    // directly (token captured by authClient's onSuccess), no follow-up sign-in.
    const { error } = await authClient.signUp.email({
      email: email!,
      password,
      // Better Auth requires `name`; reuse the username to keep the form short.
      name: username,
      username,
    })
    if (error) throw error // AuthForm renders error.message inline
    await navigate('/')
  }

  return (
    <AuthForm
      title="Create account"
      description="Username 3-64 characters, password at least 8. Email is required."
      submitLabel="Create account"
      passwordAutoComplete="new-password"
      emailField
      onSubmit={handleRegister}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    />
  )
}
