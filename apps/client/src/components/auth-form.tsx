import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'

export type Credentials = { username: string; password: string; email?: string }

type AuthFormProps = {
  title: string
  description: string
  submitLabel: string
  /** Throw on failure — the message is shown inline. */
  onSubmit: (credentials: Credentials) => Promise<void>
  footer: React.ReactNode
  /** `current-password` for login, `new-password` for register */
  passwordAutoComplete: 'current-password' | 'new-password'
  /** Register needs a real email input; login doesn't. Default false. */
  emailField?: boolean
}

function toErrorMessage(err: unknown) {
  return (
    (err as { message?: string } | null)?.message ??
    'Something went wrong. Please try again.'
  )
}

// Shared login / register form. Both screens differ only in copy + submit handler.
export function AuthForm({
  title,
  description,
  submitLabel,
  onSubmit,
  footer,
  passwordAutoComplete,
  emailField = false,
}: AuthFormProps) {
  const [credentials, setCredentials] = useState<Credentials>({
    username: '',
    password: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit(credentials)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials((c) => ({ ...c, username: e.target.value }))
                }
                required
              />
            </div>
            {emailField ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials((c) => ({ ...c, email: e.target.value }))
                  }
                  required
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={passwordAutoComplete}
                value={credentials.password}
                onChange={(e) =>
                  setCredentials((c) => ({ ...c, password: e.target.value }))
                }
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? 'Please wait…' : submitLabel}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
