import { Elysia } from 'elysia'
import authMacro from '../../macros/auth'
import { setup } from '../../middlewares/setup'
import { ProfileModel } from './model'

// Minimal role-gated demo module: shows Eden Treaty + `checkAuth` role-gated
// routes.
const profileController = new Elysia({ prefix: '/profile' })
  .use(setup)
  .use(authMacro)
  .get('/me', ({ user }) => user, {
    checkAuth: ['user', 'admin'],
    response: { 200: ProfileModel.sessionUser },
    detail: { tags: ['Profile'], security: [{ BearerAuth: [] }] },
  })
  .get('/admin', ({ user }) => user, {
    checkAuth: ['admin'],
    response: { 200: ProfileModel.sessionUser },
    detail: { tags: ['Profile'], security: [{ BearerAuth: [] }] },
  })

export default profileController
