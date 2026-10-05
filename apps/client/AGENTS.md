# AGENTS.md

Guide for AI coding agents (Claude Code, Cursor, Copilot, Aider, ...) working in `apps/client`. Read the root [`AGENTS.md`](../../AGENTS.md) first for the FE/BE contract (Eden Treaty, auth model) — this file covers frontend-internal conventions only. Read `README.md` for the stack overview.

This is a **client-side-rendered SPA** (React 19 + Vite + React Router, data mode). There is no SSR — don't add SSR guards (`typeof window === 'undefined'`), hydration workarounds, or a server runtime.

## Non-negotiable invariants

### 1. All non-auth API calls go through `lib/eden-client.ts` — never a raw `fetch`

Every request to `packages/api` other than authentication uses `api.<path>.<method>()` (Eden Treaty, typed from the `App` type) plus the `unwrap()` helper from the same file, which turns Eden's `{ data, error }` result into throw-on-error/return-on-success so callers can use plain `try/catch`. **Scoped exception:** `lib/auth-client.ts` (Better Auth's own client) is the one sanctioned non-Eden path, and only for sign-up, sign-in, sign-out, and session lookup — see root `AGENTS.md`'s "The FE/BE contract" §5. Don't call `fetch`/`axios` against the API directly, and don't add a third client.

### 2. Session token is stored in `localStorage` via `auth-token.ts`, never read directly elsewhere

The Better Auth session token lives in `localStorage` under a namespaced key (`elysia-one.auth_token`), captured by `authClient`'s global `onSuccess` from the `set-auth-token` response header on sign-up/sign-in. **Never touch that key outside `lib/auth-token.ts`** — use `getAuthToken()` / `setAuthToken()` / `clearAuthToken()`. No call site may pass its own `fetchOptions.onSuccess` to `authClient` (it would override the global one and silently drop the token capture). On sign-out, `clearAuthToken()` always runs, even if the server-side session delete fails (`signOut()`'s `finally`).

### 3. Global user state: `stores/user-store.ts`, `user.id === ''` means logged out

The Zustand store is the single source of truth for "who's logged in" in the UI (e.g. `Header.tsx` branches on it). The logged-out sentinel is `user.id === ''` (Better Auth IDs are UUID strings) — not a separate `isAuthenticated` boolean. Don't add a parallel auth-state mechanism (e.g. React context) that can drift out of sync with it.

### 4. Auth flow: `routes/authed-layout.tsx` is the only gate

`AuthedLayout` is a pathless layout route (see `src/router.tsx`) wrapping every authenticated screen:

1. **No token** in localStorage → renders nothing and redirects to `/login` (from a `useEffect`).
2. **Token present** → renders the child route immediately.
3. In the same effect, `getSessionUser()` (wraps Better Auth's `authClient.getSession()`) syncs the user into the Zustand store. If the session is invalid/expired/revoked, it **clears the token and the store** and redirects to `/login`.

`AuthedLayout` is the _only_ place that gates access, writes the session user into the store, or invalidates a stored token. `/login` and `/register` have a `loader` that redirects to `/` when a token is stored (presence check only, no network). New authenticated screens go as children of the `AuthedLayout` route in `src/router.tsx` — don't re-implement a per-route "am I logged in" check. The guard is UX only; the API's `checkAuth` is the real security boundary.

### 5. Eden Treaty types come from a build artifact — rebuild `packages/api` after backend changes

`import type { App } from 'api'` resolves to `packages/api/dist/index.d.ts`. That's produced by `bun run build` in `packages/api` (or `bunx turbo build --filter=api`), and nothing rebuilds it automatically when you run `bun dev` here. If a route/type looks wrong or missing after a backend change, rebuild the API package before assuming it's a frontend bug.

### 6. Don't hand-roll types for data the API already provides

If `api.<path>.<method>()`'s inferred type is awkward, that's a signal to fix the `model.ts` schema in `packages/api`, not to write a local interface that duplicates (and can drift from) the real contract.

### 7. UI primitives: extend via shadcn, don't hand-roll

Base components in `components/ui/` come from shadcn/ui (`components.json`: style `new-york`, aliases under `#/`). Add new primitives with `bunx --bun shadcn@latest add <component>` — this project uses `bun`, not the `pnpm dlx` command shadcn's own docs default to.

### 8. Import alias `#/*` → `src/*`

Used throughout instead of relative `../../` paths (see `package.json`'s `imports` field and `tsconfig.json`'s `paths`). Follow it in new files.

## Routing

All routes are declared in one place, `src/router.tsx` (`createBrowserRouter`, no codegen). Page/layout components live in `src/routes/*.tsx` as named exports, kebab-case file names (`home-page.tsx`, `authed-layout.tsx`). Navigate with `useNavigate()` / `<Link to="...">` from `react-router`.

## Adding a new authenticated feature (checklist)

1. Create the page in `src/routes/<name>-page.tsx` and add it as a child of the `AuthedLayout` route in `src/router.tsx` (inherits the guard + synced user store).
2. Call the API via `api.<path>.<method>()` from `lib/eden-client.ts` at the call site — no new client, no raw `fetch`.
3. If the call needs a new backend route/schema, make that change in `packages/api` first, then `bun run build` there before wiring up the frontend call.
4. Reuse `components/ui/*` primitives; add new shadcn components via the CLI rather than writing new base primitives.

## Before you finish

- Run `bun run check-types` (`tsc --noEmit`), `bun run lint` (oxlint), `bun run build`, `bun test`, and from the repo root: `bun run format:check` (Prettier). Zero errors **and** zero warnings before shipping — see root `AGENTS.md`'s "Before shipping" for the fix-vs-suppress rule.
- If you changed anything under `packages/api`, rebuild it (`bun run build` there) before relying on this package's types.
