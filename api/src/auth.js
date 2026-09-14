import { betterAuth } from 'better-auth'
import { authOptions, originList } from './auth-options.js'

/**
 * Better Auth is built per-request: the D1 binding only exists inside `fetch`,
 * so there is no module-scope instance to reuse.
 */
export function createAuth (env) {
  return betterAuth({
    // 1.5+ detects a D1Database binding natively (no adapter needed).
    database: env.DB,
    ...authOptions(env),
  })
}

export { originList }
