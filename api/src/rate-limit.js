/**
 * Small D1-backed limiter for the app's own routes.
 *
 * In-memory counters are useless on Workers (each isolate keeps its own), and
 * Better Auth's limiter only guards /api/auth/*.
 */
export function rateLimit ({ windowSec, max, name }) {
  return async (c, next) => {
    // Cloudflare sets this itself; a client cannot forge it.
    const ip = c.req.header('cf-connecting-ip') || 'unknown'
    const key = `${name}:${ip}`
    const now = Date.now()

    const row = await c.env.DB
      .prepare('SELECT count, resetAt FROM api_rate_limit WHERE key = ?')
      .bind(key)
      .first()

    if (row && row.resetAt > now) {
      if (row.count >= max) {
        const retry = Math.ceil((row.resetAt - now) / 1000)
        return c.json(
          { error: 'Demasiados intentos. Espera unos minutos.' },
          429,
          { 'Retry-After': String(retry) },
        )
      }
      await c.env.DB
        .prepare('UPDATE api_rate_limit SET count = count + 1 WHERE key = ?')
        .bind(key)
        .run()
    } else {
      await c.env.DB
        .prepare(`INSERT INTO api_rate_limit (key, count, resetAt) VALUES (?, 1, ?)
                  ON CONFLICT(key) DO UPDATE SET count = 1, resetAt = excluded.resetAt`)
        .bind(key, now + windowSec * 1000)
        .run()
    }

    await next()
  }
}
