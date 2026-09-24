import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth, originList } from './auth.js'
import { api, familyFor } from './routes.js'
import { materializeRoutines, sendWeeklyReports } from './habits.js'

const app = new Hono()

// Credentials are cookies, so the origin must be echoed exactly — never '*'.
app.use('*', async (c, next) => {
  const allowed = originList(c.env)
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 600,
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

// Better Auth owns everything under /api/auth, including the kid-code plugin.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

/** Reject anonymous callers; hand the session to the route. */
async function requireSession (c) {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return null
  return session
}

app.get('/api/me', async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: 'No autenticado' }, 401)

  const { id, name, email, role, parentId } = session.user
  const isKid = role === 'kid'

  // The router needs this on every navigation to decide whether a parent still
  // has to onboard a child, so it rides along instead of costing a second call.
  //
  // Counted by family, not parentId: parentId only records who *added* a child,
  // so a guardian who joined an existing family counted 0 and the router kept
  // bouncing them back to onboarding despite the family having kids.
  let childrenCount = 0
  if (!isKid) {
    const familyId = await familyFor(c.env.DB, session.user)
    const row = await c.env.DB
      .prepare('SELECT COUNT(*) AS n FROM user WHERE familyId = ? AND role = ?')
      .bind(familyId, 'kid')
      .first()
    childrenCount = row?.n ?? 0
  }

  // Not a Better Auth field, so it isn't on the session; one indexed read.
  const extra = await c.env.DB.prepare('SELECT avatar, parentConsentAt, weeklyReport FROM user WHERE id = ?').bind(id).first()

  return c.json({
    user: {
      id, name, email, role: role ?? 'parent', parentId, childrenCount,
      avatar: extra?.avatar ?? null,
      parentConsentAt: extra?.parentConsentAt ?? null,
      weeklyReport: !!extra?.weeklyReport,
    },
  })
})

app.route('/api', api)

export default {
  fetch: app.fetch,
  // Crons (wrangler.jsonc): daily, today's recurring missions; Monday, the report.
  async scheduled (event, env, ctx) {
    if (event.cron === '0 15 * * 1') ctx.waitUntil(sendWeeklyReports(env))
    else ctx.waitUntil(materializeRoutines(env.DB))
  },
}
