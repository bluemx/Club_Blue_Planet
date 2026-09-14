import { createAuthEndpoint, sessionMiddleware, APIError } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import * as z from 'zod'
import { familyFor, MAX_CHILDREN } from './routes.js'

const CODE_TTL_MS = 24 * 60 * 60 * 1000 // 24 h
const MAX_ATTEMPTS = 5                  // per code, then it is burned

/**
 * Six digits, uniform over 000000–999999 via rejection sampling.
 * Math.random() is not acceptable here: the code is a credential.
 */
function generateCode () {
  const limit = 4294967296 - (4294967296 % 1000000) // largest multiple of 1e6
  const buf = new Uint32Array(1)
  let n
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit)
  return String(n % 1000000).padStart(6, '0')
}

async function sha256 (text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const kidCode = () => ({
  id: 'kid-code',

  endpoints: {
    /** Parent adds a child profile. Kids have no email/password of their own. */
    createChild: createAuthEndpoint(
      '/kid-code/children',
      {
        method: 'POST',
        use: [sessionMiddleware],
        body: z.object({ name: z.string().min(1).max(60) }),
      },
      async (ctx) => {
        const db = ctx.context.options.database
        const parent = ctx.context.session.user

        if (parent.role === 'kid') {
          throw new APIError('FORBIDDEN', { message: 'Solo una cuenta de adulto puede agregar hijos.' })
        }

        // The user table needs a unique email; kids never use it to sign in.
        const familyId = await familyFor(db, parent)

        const count = await db
          .prepare("SELECT COUNT(*) AS n FROM user WHERE familyId = ? AND role = 'kid'")
          .bind(familyId)
          .first()
        if ((count?.n ?? 0) >= MAX_CHILDREN) {
          throw new APIError('BAD_REQUEST', {
            message: `Máximo ${MAX_CHILDREN} hijos por familia.`,
          })
        }

        const child = await ctx.context.internalAdapter.createUser({
          name: ctx.body.name,
          email: `kid-${crypto.randomUUID()}@kid.invalid`,
          emailVerified: false,
          role: 'kid',
          // parentId records who added them; familyId is what grants access.
          parentId: parent.id,
          familyId,
        })

        return ctx.json({ id: child.id, name: child.name })
      },
    ),

    /** Parent lists their children. */
    listChildren: createAuthEndpoint(
      '/kid-code/children',
      { method: 'GET', use: [sessionMiddleware] },
      async (ctx) => {
        const db = ctx.context.options.database
        const parent = ctx.context.session.user

        const familyId = await familyFor(db, parent)

        const { results } = await db
          .prepare('SELECT id, name FROM user WHERE familyId = ? AND role = ? ORDER BY createdAt')
          .bind(familyId, 'kid')
          .all()

        return ctx.json({ children: results ?? [] })
      },
    ),

    /** Parent issues a fresh code for one of their children. */
    issueKidCode: createAuthEndpoint(
      '/kid-code/issue',
      {
        method: 'POST',
        use: [sessionMiddleware],
        body: z.object({ childId: z.string() }),
      },
      async (ctx) => {
        const db = ctx.context.options.database
        const parent = ctx.context.session.user

        if (parent.role === 'kid') {
          throw new APIError('FORBIDDEN', { message: 'Solo una cuenta de adulto puede generar códigos.' })
        }

        // The child must actually belong to this parent.
        const familyId = await familyFor(db, parent)

        const child = await db
          .prepare('SELECT id, name FROM user WHERE id = ? AND familyId = ? AND role = ?')
          .bind(ctx.body.childId, familyId, 'kid')
          .first()

        if (!child) {
          throw new APIError('NOT_FOUND', { message: 'Ese perfil infantil no existe en tu familia.' })
        }

        const code = generateCode()
        const expiresAt = Date.now() + CODE_TTL_MS

        // Only one live code per child: retire the previous ones.
        await db.batch([
          db.prepare('DELETE FROM kid_code WHERE childId = ?').bind(child.id),
          db
            .prepare('INSERT INTO kid_code (id, childId, parentId, codeHash, expiresAt, attempts, createdAt, familyId) VALUES (?,?,?,?,?,0,?,?)')
            .bind(crypto.randomUUID(), child.id, parent.id, await sha256(code), expiresAt, Date.now(), familyId),
        ])

        // The plaintext code is returned exactly once, here.
        return ctx.json({ code, expiresAt, child: { id: child.id, name: child.name } })
      },
    ),

    /** Child redeems a code and gets a normal session. */
    redeemKidCode: createAuthEndpoint(
      '/kid-code/redeem',
      {
        method: 'POST',
        body: z.object({ code: z.string().regex(/^\d{6}$/) }),
      },
      async (ctx) => {
        const db = ctx.context.options.database
        const codeHash = await sha256(ctx.body.code)

        const row = await db
          .prepare('SELECT * FROM kid_code WHERE codeHash = ?')
          .bind(codeHash)
          .first()

        // Same message for "wrong" and "expired" so the endpoint can't be used
        // to probe which codes exist.
        const invalid = () => new APIError('UNAUTHORIZED', { message: 'Código inválido o vencido.' })

        if (!row) throw invalid()

        if (row.expiresAt < Date.now() || row.attempts >= MAX_ATTEMPTS) {
          await db.prepare('DELETE FROM kid_code WHERE id = ?').bind(row.id).run()
          throw invalid()
        }

        const child = await db
          .prepare('SELECT * FROM user WHERE id = ? AND role = ?')
          .bind(row.childId, 'kid')
          .first()

        if (!child) {
          await db.prepare('DELETE FROM kid_code WHERE id = ?').bind(row.id).run()
          throw invalid()
        }

        // A code is a shared secret a child may mistype; it stays valid for
        // reuse until it expires, but only for a bounded number of tries.
        await db
          .prepare('UPDATE kid_code SET attempts = attempts + 1, lastUsedAt = ? WHERE id = ?')
          .bind(Date.now(), row.id)
          .run()

        const session = await ctx.context.internalAdapter.createSession(child.id, ctx)
        await setSessionCookie(ctx, { session, user: child })

        return ctx.json({
          user: { id: child.id, name: child.name, role: 'kid' },
          redirect: '/kid',
        })
      },
    ),
  },
})
