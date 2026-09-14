// Schema-generation entrypoint only — never deployed.
// The generated SQL depends on the options (fields, plugins), not on which
// SQLite lives behind them, so an in-memory database is enough.
import { DatabaseSync } from 'node:sqlite'
import { betterAuth } from 'better-auth'
import { authOptions } from './auth-options.js'

export const auth = betterAuth({
  database: new DatabaseSync(':memory:'),
  ...authOptions({ BETTER_AUTH_SECRET: 'x'.repeat(32), APP_ORIGINS: '' }),
})
