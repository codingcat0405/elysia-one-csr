# Elysia One CSR — client

React 19 + Vite single-page app (client-side rendering only) for the `elysia-one-csr` monorepo. Talks to `packages/api` exclusively through an Eden-Treaty-typed client — see the root [`AGENTS.md`](../../AGENTS.md) for the FE/BE contract, and this package's [`AGENTS.md`](./AGENTS.md) for frontend-specific rules before extending it.

## Stack

- [Vite](https://vite.dev) + React 19, no SSR
- [React Router](https://reactrouter.com) (data mode: `createBrowserRouter`, routes in `src/router.tsx`)
- Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com/) (`components/ui/`, style: `new-york`)
- [Zustand](https://zustand.docs.pmnd.rs/) for global client state (currently: the logged-in user)
- [`@elysia/eden`](https://elysiajs.com/eden/overview.html) (Eden Treaty) for a fully-typed API client generated from `packages/api`'s `App` type
- [Better Auth](https://better-auth.com) client (username/password) via `src/lib/auth-client.ts`; session token stored in `localStorage` via `src/lib/auth-token.ts`

## Getting started

Requires `packages/api` to be running (for actual requests) **and built at least once** (for types — see "Type safety" below).

```bash
cp .env.example .env   # see "Environment" below
bun install
bun run dev             # http://localhost:3001
```

From the repo root, `bun run dev` (Turborepo) starts both `apps/client` and `packages/api` together.

## Environment

Build-time `VITE_*` vars (`.env`, see `.env.example`) — baked into the bundle, never put secrets here:

| Var            | Default                 | Notes                                                                        |
| -------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `VITE_API_URL` | `http://localhost:3000` | API origin as seen from the browser; also the Better Auth client's `baseURL` |

## Building for production

```bash
bun run build     # static files in dist/
bun run preview   # serve dist/ locally on :3001
```

`dist/` is plain static files — host it anywhere (nginx, S3/CloudFront, Vercel, Netlify...) with an SPA fallback (unknown paths → `index.html`). `VITE_API_URL` is baked in at build time.

Docker: `Dockerfile` (build from the repo root: `docker build -f apps/client/Dockerfile -t client .`) builds the bundle and serves it with nginx (`nginx.conf`, SPA fallback) on port 80. See the root [`README.md`](../../README.md#docker) for the full local stack via `docker-compose.yml`.

## Auth

```
login/register → authClient (onSuccess stores set-auth-token → localStorage) → navigate('/')
AuthedLayout   → no token: redirect /login
                 token:    render page + getSessionUser() → zustand store
                           invalid session → clear token + store, redirect /login
logout         → signOut() (always clears token) → clear store → /login
```

- Global "who's logged in" state is a Zustand store (`src/stores/user-store.ts`). `user.id === ''` is the "logged out" sentinel.
- `src/routes/authed-layout.tsx` is the only auth gate. Add new authenticated screens as its children in `src/router.tsx`.
- `/login` and `/register` redirect to `/` when a token is already stored. Login is **username-only** (the installed `better-auth` username plugin has no email fallback); registration calls `authClient.signUp.email(...)` with `username` as an extra field.

## Type safety (Eden Treaty)

`src/lib/eden-client.ts` builds its `api` client from `import type { App } from 'api'` — the Elysia app type exported by `packages/api/src/index.ts`. This gives compile-time-checked routes, request bodies, and response shapes with no manually-written API types.

This only works once `packages/api` has been built (`bun run build` there, or `bunx turbo build --filter=api` from the root) — that's what produces `dist/index.d.ts`. It is **not** rebuilt automatically by `bun run dev`. If routes/types look stale, rebuild `packages/api` first.

## Code quality (linting & formatting)

- **Linting:** `bun run lint` (from root or here) runs `oxlint` via Turborepo — shared config at the repo root covers all workspaces.
- **Formatting:** `bun run format` and `bun run format:check` run from the repo root only (not via Turborepo) with Prettier's shared root-level config.

## Conventions

- Import alias `#/*` → `src/*` (see `tsconfig.json` / `package.json`'s `imports`) — used instead of relative `../../` paths.
- shadcn/ui components live in `src/components/ui/`; add new ones with `bunx --bun shadcn@latest add <component>` rather than hand-rolling primitives.
- Routes: declared in `src/router.tsx`; page components in `src/routes/` (kebab-case files, named exports).

See [`AGENTS.md`](./AGENTS.md) for the full list of conventions AI agents and contributors must not break.
