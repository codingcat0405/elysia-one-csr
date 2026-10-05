import process from 'node:process'
import { RequestContext } from '@mikro-orm/postgresql'
import { initORM } from './db'
import { initAuth } from './auth'
import logger from './utils/logger'
import { getClientOrigins } from './utils/client-origins'
import { cors } from '@elysiajs/cors'
import { setup } from './middlewares/setup'
import responseMiddleware from './middlewares/responseMiddleware'
import errorMiddleware from './middlewares/errorMiddleware'
import profileController from './modules/profile'
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'

for (const key of ['BETTER_AUTH_SECRET', 'DATABASE_URL', 'REDIS_URL']) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`)
  }
}
if (process.env.ENABLE_BULL_BOARD === 'true') {
  if (!process.env.BULL_BOARD_USER || !process.env.BULL_BOARD_PASSWORD) {
    throw new Error(
      'Missing required env var: BULL_BOARD_USER or BULL_BOARD_PASSWORD',
    )
  }
}

// Exported (not just its return type) so tests can call it directly and get
// a fully-composed Elysia instance to drive with `app.handle()` — see
// Elysia's own unit-test docs (https://elysiajs.com/patterns/unit-test).
export const main = async () => {
  const { orm } = await initORM()
  await orm.schema.updateSchema()
  const auth = await initAuth()
  // load lazily: @bull-board/elysia sync-requires elysia internally, which under
  // Bun must not run before elysia has been ES-imported (memoirist is async)
  const bullBoardPlugin =
    process.env.ENABLE_BULL_BOARD === 'true'
      ? await (await import('./bull-board.js')).createBullBoardPlugin()
      : null

  // A wildcard/reflected origin makes the browser discard the auth cookies when
  // credentials:true — origin must be an explicit list, never `true`/`*`.
  //
  // `credentials: true` is harmless for bearer-token traffic and keeps Better
  // Auth's mounted handler (which still sets its own session cookie) working
  // cross-origin. Auth endpoints get their exact-origin check from
  // `trustedOrigins` (auth.ts).
  const clientOrigins = getClientOrigins()

  const app = new Elysia()
    .use(
      cors({
        origin: clientOrigins,
        credentials: true,
        // `set-auth-token` (bearer() plugin, auth.ts) is a non-simple
        // response header — cross-origin JS cannot read it unless the
        // server explicitly exposes it. Without this, the browser hides the
        // header from client code on sign-up/sign-in and the whole
        // bearer-token scheme silently fails while `app.handle()` tests
        // (which bypass the browser) still pass.
        exposeHeaders: ['set-auth-token'],
      }),
    )
    // `better-auth-mikro-orm` calls `orm.em.*` directly and does NOT fork the
    // EntityManager itself (MikroORM throws "Using global EntityManager
    // instance methods ..." without this wrapper). RequestContext.create()
    // makes every `orm.em.*` call inside the callback resolve to a
    // per-request fork via AsyncLocalStorage, no `allowGlobalContext` needed.
    // Placed BEFORE `.use(setup)` so this mount never pays for a `setup`
    // fork it doesn't use.
    .mount((request) =>
      RequestContext.create(orm.em, () => auth.handler(request)),
    )
    .use(setup)
    .onAfterHandle(responseMiddleware)
    .onError(errorMiddleware)
    .get('/', () => "It's works!")
    .get('/health', () => ({ status: 'ok' }))
    .group('/api', (group) => group.use(profileController))
  if (bullBoardPlugin) app.use(bullBoardPlugin)
  // compose everything BEFORE listen — never .use() after the server is live
  if (process.env.ENABLE_SWAGGER === 'true') {
    app.use(
      swagger({
        path: '/swagger-ui',
        provider: 'swagger-ui',
        documentation: {
          info: {
            title: 'Elysia One CSR API',
            description: 'API documentation',
            version: '1.0.0',
          },
          components: {
            securitySchemes: {
              BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                description:
                  'Sign in via POST /api/auth/sign-in/username and copy the set-auth-token response header.',
              },
            },
          },
        },
      }),
    )
  }

  app.listen(Number(process.env.PORT ?? 3000))

  const port = process.env.PORT ?? 3000
  console.log(`
  _____ _         _         ___
 | ____| |_   _ __(_) __ _  / _ \\ _ __   ___
 |  _| | | | | / __| |/ _\` || | | | '_ \\ / _ \\
 | |___| | |_| \\__ \\ | (_| || |_| | | | |  __/
 |_____|_|\\__, |___/_|\\__,_| \\___/|_| |_|\\___|
          |___/
  Elysia One — the all-in-one Turborepo Elysia + React template
  written by lilhuy0405
`)
  console.log(`🦊 Server:     http://localhost:${port}`)
  if (process.env.ENABLE_SWAGGER === 'true') {
    console.log(`📚 Swagger:    http://localhost:${port}/swagger-ui`)
  }
  if (process.env.ENABLE_BULL_BOARD === 'true') {
    // Never print BULL_BOARD_PASSWORD — this line ends up in stdout, which
    // routinely flows into a log aggregator. Print the username only, as a
    // reminder that Basic Auth is on, not a credential.
    console.log(
      `📊 Bull Board: http://localhost:${port}/bull-board (user: ${process.env.BULL_BOARD_USER})`,
    )
  }
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`)
    await app.stop()
    await orm.close() // release the pool this process owns
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  return app
}

// Boot only when this file is the process entry point, so tests importing
// `main` never double-boot the app. `import.meta.main` is rejected by tsc
// (TS1470) because the package is not `"type": "module"`, hence the
// CJS-style check, which Bun also supports.
if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
//eden treaty export type for FE apps
export type App = Awaited<ReturnType<typeof main>>
