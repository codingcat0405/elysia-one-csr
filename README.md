# elysia-one-csr

A Bun + Turborepo full-stack TypeScript template: an **Elysia** API and a **client-side-rendered React SPA**, wired together with end-to-end types via Eden Treaty.

## What's inside

| Workspace      | Stack                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api` | [Elysia](https://elysiajs.com/) on [Bun](https://bun.sh/), [MikroORM](https://mikro-orm.io/) (PostgreSQL), [Better Auth](https://better-auth.com) (username/password, bearer tokens), BullMQ + Redis |
| `apps/client`  | [React 19](https://react.dev) + [Vite](https://vite.dev) SPA, [React Router](https://reactrouter.com), Tailwind v4 + shadcn/ui, Zustand, Eden Treaty typed API client                                |

Highlights:

- **End-to-end types** — the client imports the API's `App` type; every route, body and response is type-checked, no hand-written API client.
- **Bearer-token auth** — Better Auth issues a session token on sign-in/sign-up; the SPA stores it in `localStorage` and sends `Authorization: Bearer <token>`. Works across domains (no cookies).
- **Role-gated routes** — `checkAuth(['admin'])` macro on the API; `role` is server-owned, never client-settable.
- **Background jobs** — one BullMQ queue per module, worker runs as a separate process, Bull Board dashboard (Basic Auth).
- **Static client** — `vite build` produces plain files; serve them from any static host or the bundled nginx image.

Each workspace has a `README.md` (stack/usage) and an `AGENTS.md` (rules for contributors and AI agents). **Read the root [`AGENTS.md`](./AGENTS.md) before making cross-cutting changes.**

## Getting started

Prerequisites: [Bun](https://bun.sh/) 1.3+, PostgreSQL, Redis.

```sh
bun install
cp packages/api/.env.example packages/api/.env   # fill DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET
cp apps/client/.env.example apps/client/.env     # VITE_API_URL (defaults to http://localhost:3000)
bunx turbo build --filter=api                    # generates the API types the client compiles against
bun run dev                                      # api on :3000, client on :3001
bun run dev:worker                               # optional: BullMQ worker (separate process)
```

Open `http://localhost:3001`, register an account, and you land on the authenticated home page.

> **Why `turbo build --filter=api`?** The client's API types come from `packages/api/dist/index.d.ts`, which is gitignored and not rebuilt by `dev`. Re-run it whenever API routes or schemas change.

## Commands

Run from the repo root (Turborepo runs them in every workspace):

```sh
bun run dev          # api + client dev servers (not the worker)
bun run dev:worker   # BullMQ worker
bun run build        # build every workspace
bun run check-types  # tsc --noEmit everywhere
bun run lint         # oxlint everywhere
bun run test         # tests (packages/api's need Postgres + Redis and a real .env)
bun run format       # prettier --write . (root only)
bun run format:check # prettier --check . (root only)
```

Single workspace: `bunx turbo dev --filter=client`, `bunx turbo check-types --filter=api`.

Use `bun run test`, not a bare `bun test` from the root — the latter loads env from the root (no `.env` there), so the API's DB-backed tests fail at boot.

## Docker

**Full local stack** (`postgres` + `redis` + `api` + `worker` + `client`):

```sh
cp .env.example .env   # fill BETTER_AUTH_SECRET (openssl rand -base64 48)
docker compose up --build
```

Open `http://localhost:3001` (client: nginx serving the static build) — the API is on `http://localhost:3000`. Postgres/Redis are not published to the host (avoids clashing with a local Postgres/Redis used for `bun run dev`); add a `ports:` block in `docker-compose.yml` with a non-default host port if you need direct access.

**Single images** — both Dockerfiles use `turbo prune`, so the build context is the repo root:

```sh
docker build -f packages/api/Dockerfile -t api .
docker build -f apps/client/Dockerfile -t client . \
  --build-arg VITE_API_URL=https://api.example.com
```

`VITE_API_URL` is baked into the client bundle at build time.

## Deploying

- **API:** run the `api` image (and the same image with `bun run src/worker.ts` for the worker). Set `CLIENT_URL` to the exact client origin (CORS + Better Auth trusted origins) and `BETTER_AUTH_URL` to the API's public URL. See [`packages/api/README.md`](./packages/api/README.md) for all env vars.
- **Client:** any static host with an SPA fallback (unknown paths → `index.html`), or the `client` nginx image. Build with `VITE_API_URL` set to the API's public URL.

## Tooling

[TypeScript](https://www.typescriptlang.org/), [oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Prettier](https://prettier.io), [Turborepo](https://turborepo.dev/).
