import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router'
import Header from '#/components/Header.tsx'

export function RootLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}

export function RootErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error'

  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </main>
    </>
  )
}
