# System Architecture

`packages/api` is an Elysia HTTP server plus a separate BullMQ worker process, both on MikroORM/PostgreSQL and Redis. The React + Vite SPA in `apps/client` talks to it through Eden Treaty (typed from the exported `App` type) and Better Auth's client (auth flows only). See `../README.md` for the file layout and `../AGENTS.md` for invariants.

## Authentication flow

Auth is [Better Auth](https://better-auth.com) (username/password) with the `bearer()` plugin, mounted at `/api/auth/*` in `src/index.ts`.

1. **Sign-up / sign-in:** the client posts to `/api/auth/sign-up/email` or `/api/auth/sign-in/username`.
2. **Token:** Better Auth returns the session token in the `set-auth-token` response header. CORS `exposeHeaders: ['set-auth-token']` (`src/index.ts`) lets the browser read it cross-origin.
3. **Storage:** the SPA stores it in `localStorage` (`apps/client/src/lib/auth-token.ts`) and sends `Authorization: Bearer <token>` on every request (Better Auth client and Eden Treaty both).
4. **Session resolution:** the `checkAuth(roles)` macro (`src/macros/auth.ts`) calls `auth.api.getSession({ headers })` and injects `user`; a missing session throws `UnauthorizedError`, a role mismatch `ForbiddenError`.
5. **Client guard:** `apps/client/src/routes/authed-layout.tsx` validates the session before rendering authed pages and redirects to `/login` otherwise. This is UI state only; `checkAuth` is the security boundary.
6. **Sign-out:** Better Auth revokes the server session and the client clears its `localStorage` token.

`role` is a server-owned `user.additionalFields` entry with `input: false`, so it can't be set from sign-up bodies.

## Security properties and constraints

- **Cross-site deployment:** bearer tokens are not subject to `SameSite` rules, so the SPA and API can be on different registrable domains.
- **CSRF:** the browser never auto-attaches a bearer token; `trustedOrigins` (from `CLIENT_URL`, must be the exact origin) adds an Origin/Referer allowlist on state-changing requests.
- **XSS:** `localStorage` is readable by injected scripts; mitigate with CSP and input sanitization.
- **Cookie:** Better Auth also sets `better-auth.session_token`; the app ignores it.

## Request lifecycle

```
Browser (SPA)
  | Authorization: Bearer <token>
  v
Elysia (src/index.ts)
  cors -> .mount(RequestContext.create(auth.handler))   /api/auth/*
       -> setup (per-request em.fork + services)
       -> routes (/api/profile/* with checkAuth) -> responseMiddleware / errorMiddleware
  |
  v
MikroORM (PostgreSQL)  +  Redis (result cache, BullMQ)
```

Background jobs: `auth.ts`'s `databaseHooks.user.create.after` enqueues `send-welcome-email` on the `user` queue; `src/worker.ts` (separate process) consumes it with one `em.fork()` per job.
