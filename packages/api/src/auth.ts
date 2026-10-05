import { betterAuth } from 'better-auth'
import { bearer, username } from 'better-auth/plugins'
import { mikroOrmAdapter } from 'better-auth-mikro-orm'
import type { MikroORM } from '@mikro-orm/postgresql'
import { initORM } from './db'
import { userQueue } from './modules/user/queue'
import logger from './utils/logger'
import { getClientOrigins } from './utils/client-origins'

// Minimal shape of the user object better-auth returns at runtime. See the
// `Auth` type comment below for why this isn't inferred from `createAuth`.
interface AuthUserShape {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  username?: string | null
  displayUsername?: string | null
  role?: string | null
  createdAt: Date
  updatedAt: Date
}

// Minimal shape of what `auth.api.getSession` returns for `session` — only
// the fields macros/auth.ts might plausibly need; extend on demand like AuthApi.
interface AuthSessionShape {
  id: string
  token: string
  userId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  ipAddress?: string | null
  userAgent?: string | null
}

interface AuthApi {
  signUpEmail(input: {
    body: {
      email: string
      password: string
      name: string
      username?: string
      displayUsername?: string
      callbackURL?: string
    }
  }): Promise<{ token: string | null; user: AuthUserShape }>
  signInUsername(input: {
    body: { username: string; password: string; rememberMe?: boolean }
  }): Promise<{
    redirect: boolean
    token: string
    url?: string | null
    user: AuthUserShape
  }>
  // Used by macros/auth.ts to resolve the session. `headers` must be the real
  // WinterCG `Headers` from the incoming request (a plain object won't work);
  // it carries an `Authorization: Bearer <token>` header (bearer() plugin
  // below) or the `better-auth.session_token` cookie Better Auth also issues.
  getSession(input: {
    headers: Headers
  }): Promise<{ session: AuthSessionShape; user: AuthUserShape } | null>
}

// Shared with index.ts's CORS config (must agree with it): feeds Better
// Auth's own Origin/Referer check on state-changing requests.
const clientOrigins = getClientOrigins()

// betterAuth() needs a live MikroORM instance, which only exists after
// `await initORM()`. Solved with a memoized async factory mirroring db.ts's
// initORM, not top-level `await` — worker.ts imports the same module graph
// and must not open an auth-side connection as an import side effect.
const createAuth = (orm: MikroORM) =>
  betterAuth({
    database: mikroOrmAdapter(orm),
    advanced: { database: { generateId: false } },
    // Boot-required (index.ts's env loop) — Better Auth signs/verifies
    // session tokens and CSRF state with this.
    secret: process.env.BETTER_AUTH_SECRET,
    // Public origin of THIS api (Better Auth builds absolute URLs from it).
    baseURL:
      process.env.BETTER_AUTH_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`,
    trustedOrigins: clientOrigins,
    // Don't override advanced.defaultCookieAttributes.sameSite; the default
    // is already 'lax'.
    emailAndPassword: { enabled: true },
    // username(): `signInUsername` looks up strictly by `username` (no email
    // fallback in this better-auth version).
    // bearer(): resolves `Authorization: Bearer <token>` on `getSession`
    // (macros/auth.ts's checkAuth) alongside the session cookie Better Auth
    // also issues, and returns the token in the `set-auth-token` response
    // header. `requireSignature` stays default (false): the client stores
    // that header value verbatim.
    plugins: [username(), bearer()],
    // Model names map to the `Auth*` entity classes:
    // better-auth-mikro-orm resolves a model name to a class via
    // `naming.getEntityName(naming.classToTableName(model))`, so 'authUser'
    // -> `AuthUser`, etc. Physical table names stay
    // `user`/`session`/`account`/`verification` via each entity's
    // `@Entity({ tableName })`.
    user: {
      modelName: 'authUser',
      // `role` MUST stay `input: false` — otherwise a `signUp` body could set
      // `role: 'admin'`: a privilege-escalation hole.
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          input: false,
        },
      },
    },
    session: { modelName: 'authSession' },
    account: { modelName: 'authAccount' },
    verification: { modelName: 'authVerification' },
    databaseHooks: {
      user: {
        create: {
          // Fires after the row is committed (Better Auth's guarantee), so
          // the job is enqueued only once the write succeeded.
          after: async (user) => {
            try {
              await userQueue.add('send-welcome-email', {
                type: 'send-welcome-email',
                userId: user.id,
                // `username` is optional in Better Auth's schema; fall back to
                // email so the queue payload always has a display string.
                username:
                  (user as { username?: string | null }).username ?? user.email,
              })
            } catch (e) {
              // Swallow-and-log: a Redis outage must never turn a successful
              // signup into a failed one.
              logger.error(
                `failed to enqueue send-welcome-email for user ${user.id}`,
                e,
              )
            }
          },
        },
      },
    },
  })

// `export type Auth = ReturnType<typeof createAuth>` fails `check-types` with
//   TS2883: The inferred type of 'createAuth' cannot be named without a
//   reference to '$strip' from '.../zod/v4/core'. This is likely not portable.
// This is an upstream better-auth/zod-v4 declaration-emit limitation (it
// reproduces with the bare `username()` plugin; open better-auth issues e.g.
// #4654, #1861, #6909) and only disappears if `declaration` is turned off in
// tsconfig.json, which we can't do because the emitted `index.d.ts` is the
// contract apps/client consumes.
//
// Workaround: assert the runtime instance through a hand-written type that
// covers exactly what the app uses (`api.getSession`, `api.signUpEmail`,
// `api.signInUsername`, and the WinterCG `handler` that index.ts mounts).
// Extend `AuthApi` on demand; re-check upstream before retrying inference.
export type Auth = {
  api: AuthApi
  handler: (request: Request) => Promise<Response>
}

let instance: Promise<Auth> | null = null

// Cached initializer: safe to call repeatedly, builds once. Caches the
// in-flight PROMISE (assigned synchronously) so concurrent first callers
// share one betterAuth() instance.
export const initAuth = (): Promise<Auth> =>
  (instance ??= (async () =>
    createAuth((await initORM()).orm) as unknown as Auth)())
