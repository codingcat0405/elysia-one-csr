import { Elysia } from 'elysia'
import { RequestContext } from '@mikro-orm/postgresql'
import { ForbiddenError, UnauthorizedError } from '../utils/http-errors'
import { initAuth } from '../auth'
import { initORM } from '../db'

export interface AuthUser {
  id: string
  username: string
  role: string
}

const authMacro = new Elysia({ name: 'macro.auth' }).macro({
  checkAuth(roles: string[]) {
    return {
      resolve: async ({ request }): Promise<{ user: AuthUser }> => {
        const [auth, { orm }] = await Promise.all([initAuth(), initORM()])
        // Better Auth reads the session straight off the real request
        // headers (`Authorization: Bearer <token>` via the bearer() plugin).
        //
        // `better-auth-mikro-orm` calls `orm.em.*` directly without forking
        // (see index.ts's `.mount()` comment). This macro runs on plain Eden
        // routes, outside the mounted handler, so it needs its own
        // RequestContext wrapper; without it every checkAuth-protected route
        // 500s with MikroORM's "Using global EntityManager instance
        // methods ..." ValidationError.
        const session = await RequestContext.create(orm.em, () =>
          auth.api.getSession({ headers: request.headers }),
        )
        if (!session) throw new UnauthorizedError('Not authenticated')

        // `role` is a Better Auth `user.additionalFields` entry (auth.ts),
        // always present at runtime (`input: false`, `defaultValue: 'user'`).
        // The `?? 'user'` fallback only guards a row from before the field
        // existed — it is never a path to an unknown/elevated privilege.
        const role = session.user.role ?? 'user'
        if (!roles.includes(role)) throw new ForbiddenError()

        return {
          user: {
            id: session.user.id,
            // `username` is optional in Better Auth's schema; fall back to
            // `name` (NOT NULL, the client sends `name: username` on
            // sign-up), matching the client's `getSessionUser()`. Never fall
            // back to `email` — it would leak the address in a "username" field.
            username: session.user.username ?? session.user.name,
            role,
          },
        }
      },
    }
  },
})

export default authMacro
