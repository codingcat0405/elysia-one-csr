import { treaty } from '@elysia/eden'
import type { App } from 'api'
import { getAuthToken } from './auth-token'

// Every request attaches `Authorization: Bearer <token>` when a token is
// stored (see auth-token.ts); no header at all when logged out.
const client = treaty<App>(
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  {
    headers() {
      const token = getAuthToken()
      return token ? { authorization: `Bearer ${token}` } : undefined
    },
  },
)

export const api = client.api

type EdenResult<TData> = {
  data: TData
  error: { status: unknown; value: unknown } | null
  response?: Response
}

// Eden treaty resolves *every* call to `{ data, error, status, ... }` and never
// throws on a non-2xx response. `unwrap` collapses that into "return the body, or
// throw the API error body" so callers can use plain try/catch. Eden nests the response body under `error.value` — for this backend
// that's `{ message, status }`.
export async function unwrap<TData>(
  call: Promise<EdenResult<TData>>,
): Promise<NonNullable<TData>> {
  const { data, error } = await call
  if (error) throw error.value
  if (data == null) throw new Error('Empty response from server')
  return data
}
