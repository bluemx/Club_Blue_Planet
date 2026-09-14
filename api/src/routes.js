import { Hono } from 'hono'
import { createAuth } from './auth.js'
import { rateLimit } from './rate-limit.js'

export const api = new Hono()

/**
 * Resolve which family this user acts in. A family is a real row now, so
 * several guardians can share one — the old model keyed everything on a single
 * parent's user id, which made a second guardian their own island.
 */
export async function familyFor (db, user) {
  if (user.role === 'kid') return user.familyId ?? user.parentId

  const row = await db
    .prepare('SELECT familyId FROM family_member WHERE userId = ? LIMIT 1')
    .bind(user.id)
    .first()
  if (row) return row.familyId

  // First request after sign-up: give this adult a family of their own.
  const familyId = crypto.randomUUID()
  const ts = Date.now()
  await db.batch([
    db.prepare('INSERT INTO family (id,name,createdAt) VALUES (?,?,?)')
      .bind(familyId, user.name ?? null, ts),
    db.prepare('INSERT INTO family_member (familyId,userId,role,joinedAt) VALUES (?,?,?,?)')
      .bind(familyId, user.id, 'owner', ts),
    db.prepare('UPDATE user SET familyId = ? WHERE id = ?')
      .bind(familyId, user.id),
  ])
  return familyId
}

/** Attach the session, or 401. Everything below this needs one. */
api.use('*', async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'No autenticado' }, 401)

  const user = session.user
  c.set('user', user)
  c.set('familyId', await familyFor(c.env.DB, user))
  c.set('isKid', user.role === 'kid')
  await next()
})

const now = () => Date.now()

// Nothing enforced a ceiling before, so a logged-in adult could loop the
// create endpoints and fill the user table. These are generous for a real
// family and only exist to bound abuse.
export const MAX_CHILDREN = 20
export const MAX_GUARDIANS = 6  // p. ej. dos padres y cuatro abuelos

function parentOnly (c) {
  if (c.get('isKid')) {
    c.status(403)
    return c.json({ error: 'Solo una cuenta de adulto puede hacer esto.' })
  }
  return null
}

// ----------------------------------------------------------- notifications

/*
 * Notifications are built as statements, never run on their own: each one rides
 * in the same batch as the change it announces. D1 has no interactive
 * transactions, and a "misión aprobada" row must never exist for a mission
 * that wasn't approved.
 */
function notifyUser (db, userId, n) {
  return db
    .prepare('INSERT INTO notification (id,userId,kind,title,body,link,createdAt,icon,color) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), userId, n.kind, n.title, n.body ?? null, n.link ?? null, now(),
          n.icon ?? null, n.color ?? null)
}

/** Every guardian of a family, in one statement — no round trip to list them. */
function notifyGuardians (db, familyId, n) {
  return db
    .prepare(`INSERT INTO notification (id,userId,kind,title,body,link,createdAt)
              SELECT lower(hex(randomblob(16))), userId, ?, ?, ?, ?, ?
              FROM family_member WHERE familyId = ?`)
    .bind(n.kind, n.title, n.body ?? null, n.link ?? null, now(), familyId)
}

/** A kid reported a mission done — the one notice guardians act on most. */
const reportedNotice = (kidName, missionTitle) => ({
  kind: 'revision',
  title: `${kidName} terminó “${missionTitle}”`,
  body: 'Revísala para darle sus puntos.',
  link: '/misiones',
})

// ---------------------------------------------------------------- missions

/** Catalog: the shared suggestions plus this family's own. */
api.get('/missions', async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM mission
              WHERE (familyId IS NULL OR familyId = ?) AND status = 'activa'
              ORDER BY familyId IS NOT NULL, createdAt`)
    .bind(c.get('familyId'))
    .all()
  return c.json({ missions: results ?? [] })
})

api.post('/missions', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const title = (body.title || '').trim()
  if (!title) return c.json({ error: 'Falta el título.' }, 400)

  const mission = {
    id: crypto.randomUUID(),
    familyId: c.get('familyId'),
    title,
    subtitle: body.subtitle ?? null,
    icon: body.icon || 'eco',
    color: body.color || 'blue',
    points: Number.isFinite(body.points) ? body.points : 50,
    createdAt: now(),
  }

  await c.env.DB
    .prepare('INSERT INTO mission (id,familyId,title,subtitle,icon,color,points,createdAt) VALUES (?,?,?,?,?,?,?,?)')
    .bind(mission.id, mission.familyId, mission.title, mission.subtitle, mission.icon, mission.color, mission.points, mission.createdAt)
    .run()

  return c.json(mission, 201)
})

// ------------------------------------------------------------- assignments

/** Parent sees the whole family's; a kid sees only their own. */
api.get('/assignments', async (c) => {
  const sql = `
    SELECT a.*, m.title, m.subtitle, m.icon, m.color, u.name AS childName, u.avatar AS childAvatar,
           (a.evidenceKey IS NOT NULL) AS hasPhoto
    FROM assignment a
    JOIN mission m ON m.id = a.missionId
    JOIN user u ON u.id = a.childId
    WHERE a.familyId = ? ${c.get('isKid') ? 'AND a.childId = ?' : ''}
    ORDER BY a.createdAt DESC`

  const stmt = c.env.DB.prepare(sql)
  const bound = c.get('isKid')
    ? stmt.bind(c.get('familyId'), c.get('user').id)
    : stmt.bind(c.get('familyId'))

  const { results } = await bound.all()
  return c.json({ assignments: results ?? [] })
})

api.post('/assignments', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const { missionId } = body

  // Accepts one child or several: the UI assigns the same mission to siblings.
  const childIds = [...new Set(
    Array.isArray(body.childIds) ? body.childIds : [body.childId].filter(Boolean)
  )]

  if (!missionId || !childIds.length) {
    return c.json({ error: 'Falta la misión o el hijo.' }, 400)
  }

  const familyId = c.get('familyId')

  const mission = await c.env.DB
    // Only 'activa': a retired suggestion or a kid's proposal nobody accepted yet
    // must not be assignable just because a stale client still knows its id.
    .prepare("SELECT id, title, points FROM mission WHERE id = ? AND (familyId IS NULL OR familyId = ?) AND status = 'activa'")
    .bind(missionId, familyId)
    .first()
  if (!mission) return c.json({ error: 'Esa misión no existe.' }, 404)

  // Every child must belong to this family, or a parent could reach into
  // another family by passing a foreign id among their own.
  const placeholders = childIds.map(() => '?').join(',')
  const { results: owned } = await c.env.DB
    .prepare(`SELECT id FROM user WHERE id IN (${placeholders}) AND familyId = ? AND role = 'kid'`)
    .bind(...childIds, familyId)
    .all()

  if ((owned?.length ?? 0) !== childIds.length) {
    return c.json({ error: 'Algún hijo no es de tu familia.' }, 404)
  }

  const createdAt = now()
  const rows = childIds.map((childId) => ({
    id: crypto.randomUUID(), missionId, childId, familyId,
    status: 'pendiente', points: mission.points, createdAt,
  }))

  // D1 has no interactive transactions; batch keeps the inserts atomic.
  await c.env.DB.batch([
    ...rows.map((r) =>
      c.env.DB
        .prepare('INSERT INTO assignment (id,missionId,childId,familyId,status,points,createdAt) VALUES (?,?,?,?,?,?,?)')
        .bind(r.id, r.missionId, r.childId, r.familyId, r.status, r.points, r.createdAt)
    ),
    ...rows.map((r) => notifyUser(c.env.DB, r.childId, {
      kind: 'asignada',
      title: `Nueva misión: ${mission.title}`,
      body: `Complétala y gana ${mission.points} puntos.`,
      link: '/kid/misiones',
    })),
  ])

  return c.json({ assignments: rows }, 201)
})

/**
 * Kids may only move their own task to 'revision'. Approving (and the points
 * that come with it) is a parent action — a kid must never be able to grant
 * themselves points.
 */
api.patch('/assignments/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const status = body.status

  const row = await c.env.DB
    .prepare(`SELECT a.*, m.title, m.icon, m.color FROM assignment a JOIN mission m ON m.id = a.missionId
              WHERE a.id = ? AND a.familyId = ?`)
    .bind(id, c.get('familyId'))
    .first()

  if (!row) return c.json({ error: 'No encontrado.' }, 404)

  if (c.get('isKid')) {
    if (row.childId !== c.get('user').id) return c.json({ error: 'No es tuya.' }, 403)
    if (status !== 'revision') {
      return c.json({ error: 'Solo puedes marcarla como lista para revisión.' }, 403)
    }
    const steps = [
      c.env.DB
        .prepare('UPDATE assignment SET status = ?, reportedAt = ?, note = ? WHERE id = ?')
        .bind('revision', now(), body.note ?? row.note, id),
    ]
    // Only on the transition: reporting again must not ping every guardian twice.
    if (row.status !== 'revision') {
      steps.push(notifyGuardians(c.env.DB, c.get('familyId'), reportedNotice(c.get('user').name, row.title)))
    }
    await c.env.DB.batch(steps)
    return c.json({ ...row, status: 'revision' })
  }

  if (!['pendiente', 'revision', 'lista'].includes(status)) {
    return c.json({ error: 'Estado inválido.' }, 400)
  }

  const steps = [
    c.env.DB
      .prepare('UPDATE assignment SET status = ?, approvedAt = ? WHERE id = ?')
      .bind(status, status === 'lista' ? now() : null, id),
  ]
  if (status === 'lista' && row.status !== 'lista') {
    steps.push(notifyUser(c.env.DB, row.childId, {
      kind: 'aprobada',
      title: `¡Misión aprobada! +${row.points} puntos`,
      body: row.title,
      link: '/kid/misiones',
      // The kid's app celebrates it full-screen with the mission's own art.
      icon: row.icon,
      color: row.color,
    }))
  }
  await c.env.DB.batch(steps)

  return c.json({ ...row, status })
})

// ----------------------------------------------------------------- rewards

api.get('/rewards', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM reward WHERE familyId IS NULL OR familyId = ? ORDER BY points')
    .bind(c.get('familyId'))
    .all()
  return c.json({ rewards: results ?? [] })
})

api.post('/rewards', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const title = (body.title || '').trim()
  if (!title) return c.json({ error: 'Falta el título.' }, 400)

  const reward = {
    id: crypto.randomUUID(),
    familyId: c.get('familyId'),
    title,
    subtitle: body.subtitle ?? null,
    icon: body.icon || 'redeem',
    color: body.color || 'blue',
    points: Number.isFinite(body.points) ? body.points : 100,
    createdAt: now(),
  }

  await c.env.DB
    .prepare('INSERT INTO reward (id,familyId,title,subtitle,icon,color,points,createdAt) VALUES (?,?,?,?,?,?,?,?)')
    .bind(reward.id, reward.familyId, reward.title, reward.subtitle, reward.icon, reward.color, reward.points, reward.createdAt)
    .run()

  return c.json(reward, 201)
})

// ------------------------------------------------------------- points

/**
 * Balance is derived, never stored: approved missions minus redemptions that
 * were not rejected. A stored counter would drift the first time any write
 * half-fails, and D1 has no interactive transactions to lean on.
 */
async function balanceFor (db, childId) {
  const row = await db
    .prepare(`
      SELECT
        (SELECT COALESCE(SUM(points),0) FROM assignment  WHERE childId = ?1 AND status = 'lista') -
        (SELECT COALESCE(SUM(points),0) FROM redemption  WHERE childId = ?1
           AND status IN ('pedida','entregada')) AS balance`)
    .bind(childId)
    .first()
  return row?.balance ?? 0
}

api.get('/summary', async (c) => {
  const familyId = c.get('familyId')
  const isKid = c.get('isKid')

  // The session user doesn't carry the avatar column, so both branches read the table.
  const children = isKid
    ? [await c.env.DB.prepare('SELECT id, name, avatar FROM user WHERE id = ?').bind(c.get('user').id).first()]
    : (await c.env.DB.prepare('SELECT id, name, avatar FROM user WHERE familyId = ? AND role = ? ORDER BY createdAt')
        .bind(familyId, 'kid').all()).results ?? []

  const withPoints = await Promise.all(
    children.map(async (child) => ({ ...child, points: await balanceFor(c.env.DB, child.id) }))
  )

  const counts = await c.env.DB
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'lista'    THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'revision' THEN 1 ELSE 0 END) AS pending
      FROM assignment WHERE familyId = ?`)
    .bind(familyId)
    .first()

  return c.json({
    children: withPoints,
    totals: {
      missions: counts?.total ?? 0,
      completed: counts?.completed ?? 0,
      awaiting: counts?.pending ?? 0,
      points: withPoints.reduce((sum, ch) => sum + ch.points, 0),
    },
  })
})

// ------------------------------------------------------------ redemptions

api.post('/redemptions', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const familyId = c.get('familyId')
  const childId = c.get('isKid') ? c.get('user').id : body.childId

  if (!childId || !body.rewardId) return c.json({ error: 'Falta el premio o el hijo.' }, 400)

  const reward = await c.env.DB
    .prepare('SELECT id, title, points, icon, color FROM reward WHERE id = ? AND (familyId IS NULL OR familyId = ?)')
    .bind(body.rewardId, familyId)
    .first()

  if (!reward) return c.json({ error: 'Ese premio no existe.' }, 404)

  const balance = await balanceFor(c.env.DB, childId)
  if (balance < reward.points) {
    return c.json({ error: 'No alcanzan los puntos.', balance, needed: reward.points }, 400)
  }

  // A kid is asking for it; an adult doing this is handing it over, so it needs
  // no second approval step.
  const status = c.get('isKid') ? 'pedida' : 'entregada'
  const ts = now()
  const id = crypto.randomUUID()

  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO redemption (id,rewardId,childId,familyId,status,points,createdAt,resolvedAt) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id, reward.id, childId, familyId, status, reward.points, ts, status === 'entregada' ? ts : null),
    c.get('isKid')
      ? notifyGuardians(c.env.DB, familyId, {
          kind: 'canje',
          title: `${c.get('user').name} quiere canjear “${reward.title}”`,
          body: `Cuesta ${reward.points} puntos. Entrégalo desde Recompensas.`,
          link: '/recompensas',
        })
      : notifyUser(c.env.DB, childId, {
          kind: 'premio',
          title: `¡Recibiste “${reward.title}”!`,
          body: `Se usaron ${reward.points} de tus puntos.`,
          link: '/kid/recompensas',
          icon: reward.icon,
          color: reward.color,
        }),
  ])

  return c.json({ id, status, points: reward.points, balance: balance - reward.points }, 201)
})

api.get('/redemptions', async (c) => {
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 12))
  const offset = Math.max(0, Number(c.req.query('offset')) || 0)
  const childFilter = c.req.query('childId')

  const where = ['r.familyId = ?']
  const args = [c.get('familyId')]

  if (c.get('isKid')) {
    where.push('r.childId = ?')
    args.push(c.get('user').id)
  } else if (childFilter) {
    where.push('r.childId = ?')
    args.push(childFilter)
  }

  const clause = where.join(' AND ')

  // The parent's two tabs: requests still to hand over, and everything already
  // resolved. Counts share the scope but not the status filter, so both tab
  // badges come back with either list.
  const status = c.req.query('status')
  const byStatus = status === 'pedida' ? " AND r.status = 'pedida'"
    : status === 'resueltas' ? " AND r.status != 'pedida'"
    : ''

  // One extra row tells us whether another page exists without a COUNT(*).
  const [page, totals] = await c.env.DB.batch([
    c.env.DB
      .prepare(`
        SELECT r.*, w.title, w.icon, w.color, u.name AS childName, u.avatar AS childAvatar
        FROM redemption r
        JOIN reward w ON w.id = r.rewardId
        JOIN user u ON u.id = r.childId
        WHERE ${clause}${byStatus}
        ORDER BY COALESCE(r.resolvedAt, r.createdAt) DESC
        LIMIT ? OFFSET ?`)
      .bind(...args, limit + 1, offset),
    c.env.DB
      .prepare(`
        SELECT COALESCE(SUM(r.status = 'pedida'), 0)  AS pedida,
               COALESCE(SUM(r.status != 'pedida'), 0) AS resueltas
        FROM redemption r WHERE ${clause}`)
      .bind(...args),
  ])

  const rows = page.results ?? []
  const hasMore = rows.length > limit

  return c.json({
    redemptions: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
    offset,
    limit,
    counts: totals.results?.[0] ?? { pedida: 0, resueltas: 0 },
  })
})

// ----------------------------------------------------------------- badges

/**
 * Badges are derived from completed missions, not stored. There is no state a
 * badge could hold that the assignment table doesn't already imply, and a
 * stored copy would need backfilling every time the rules change.
 */
const BADGES = [
  { id: 'explorador', label: 'Explorador',      icon: 'explore',        color: 'blue',   need: 1 },
  { id: 'orden',      label: 'Súper ordenado',  icon: 'bed',            color: 'purple', need: 3, match: ['bed', 'desk'] },
  { id: 'manos',      label: 'Manos limpias',   icon: 'clean_hands',    color: 'green',  need: 5, match: ['clean_hands'] },
  { id: 'lector',     label: 'Lector estrella', icon: 'menu_book',      color: 'blue',   need: 3, match: ['menu_book'] },
  { id: 'atleta',     label: 'Atleta',          icon: 'directions_run', color: 'amber',  need: 3, match: ['directions_run'] },
  { id: 'imparable',  label: 'Imparable',       icon: 'local_fire_department', color: 'pink', need: 10 },
]

api.get('/badges', async (c) => {
  const childId = c.get('isKid') ? c.get('user').id : c.req.query('childId')
  if (!childId) return c.json({ error: 'Falta el hijo.' }, 400)

  const { results } = await c.env.DB
    .prepare(`
      SELECT m.icon, COUNT(*) AS n
      FROM assignment a JOIN mission m ON m.id = a.missionId
      WHERE a.childId = ? AND a.familyId = ? AND a.status = 'lista'
      GROUP BY m.icon`)
    .bind(childId, c.get('familyId'))
    .all()

  const byIcon = Object.fromEntries((results ?? []).map(r => [r.icon, r.n]))
  const total = (results ?? []).reduce((sum, r) => sum + r.n, 0)

  const badges = BADGES.map((b) => {
    const done = b.match ? b.match.reduce((sum, icon) => sum + (byIcon[icon] ?? 0), 0) : total
    return {
      id: b.id, label: b.label, icon: b.icon, color: b.color,
      earned: done >= b.need, progress: Math.min(done, b.need), need: b.need,
    }
  })

  return c.json({ badges })
})

// --------------------------------------------------------------- evidence

// The app sends ≤800px WebP/JPEG (tens of KB); this only stops anything else.
const MAX_PHOTO_BYTES = 1024 * 1024 // 1 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * The kid uploads one photo and the mission moves to 'revision' in the same
 * step: evidence without the status change would leave the parent with nothing
 * to review, and the status without evidence defeats the point.
 */
api.post('/assignments/:id/evidence', async (c) => {
  const id = c.req.param('id')

  const row = await c.env.DB
    .prepare(`SELECT a.*, m.title FROM assignment a JOIN mission m ON m.id = a.missionId
              WHERE a.id = ? AND a.familyId = ?`)
    .bind(id, c.get('familyId'))
    .first()
  if (!row) return c.json({ error: 'No encontrado.' }, 404)

  if (c.get('isKid') && row.childId !== c.get('user').id) {
    return c.json({ error: 'No es tuya.' }, 403)
  }

  const type = c.req.header('content-type') || ''
  if (!ALLOWED_TYPES.includes(type)) {
    return c.json({ error: 'Solo se aceptan fotos (JPG, PNG, WEBP o HEIC).' }, 415)
  }

  const body = await c.req.arrayBuffer()
  if (!body.byteLength) return c.json({ error: 'La foto llegó vacía.' }, 400)
  if (body.byteLength > MAX_PHOTO_BYTES) {
    return c.json({ error: 'La foto pesa más de 1 MB.' }, 413)
  }

  // Keyed family/child/assignment so deleting a child (or a whole family) is a
  // prefix delete — the DB cascade alone would orphan the photos in R2, and a
  // child's photo must not outlive their profile.
  const key = `${c.get('familyId')}/${row.childId}/${id}/${crypto.randomUUID()}`
  await c.env.EVIDENCE.put(key, body, { httpMetadata: { contentType: type } })

  // Replacing evidence shouldn't leave the previous object paying storage.
  if (row.evidenceKey) {
    await c.env.EVIDENCE.delete(row.evidenceKey).catch(() => {})
  }

  const steps = [
    c.env.DB
      .prepare('UPDATE assignment SET evidenceKey = ?, evidenceType = ?, status = ?, reportedAt = ? WHERE id = ?')
      .bind(key, type, 'revision', now(), id),
  ]
  // A replaced photo on a mission already under review isn't news.
  if (c.get('isKid') && row.status !== 'revision') {
    steps.push(notifyGuardians(c.env.DB, c.get('familyId'), reportedNotice(c.get('user').name, row.title)))
  }
  await c.env.DB.batch(steps)

  return c.json({ ok: true, status: 'revision' })
})

/** Streams the photo, but only to someone in the same family. */
api.get('/assignments/:id/evidence', async (c) => {
  const id = c.req.param('id')

  const row = await c.env.DB
    .prepare('SELECT childId, evidenceKey, evidenceType FROM assignment WHERE id = ? AND familyId = ?')
    .bind(id, c.get('familyId'))
    .first()

  if (!row?.evidenceKey) return c.json({ error: 'Sin foto.' }, 404)
  if (c.get('isKid') && row.childId !== c.get('user').id) {
    return c.json({ error: 'No es tuya.' }, 403)
  }

  const object = await c.env.EVIDENCE.get(row.evidenceKey)
  if (!object) return c.json({ error: 'Sin foto.' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': row.evidenceType || 'image/jpeg',
      // Private: it is one family's child, never a shared cache.
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

// ---------------------------------------------------------------- children

/** Remove a child, their assignments and every photo they uploaded. */
api.delete('/children/:id', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const childId = c.req.param('id')
  const familyId = c.get('familyId')

  const child = await c.env.DB
    .prepare('SELECT id FROM user WHERE id = ? AND familyId = ? AND role = ?')
    .bind(childId, familyId, 'kid')
    .first()
  if (!child) return c.json({ error: 'Ese hijo no es de tu familia.' }, 404)

  // R2 first: if this half fails the profile stays and can be retried, whereas
  // deleting the row first would strand the photos with nothing pointing to them.
  //
  // Deleted by the keys stored in the DB, not by a familyId prefix: a child can
  // move between families when guardians merge, and the keys keep the family id
  // they were written with — a prefix would silently miss those.
  const { results: withPhotos } = await c.env.DB
    .prepare('SELECT evidenceKey FROM assignment WHERE childId = ? AND evidenceKey IS NOT NULL')
    .bind(childId)
    .all()

  const keys = (withPhotos ?? []).map(r => r.evidenceKey)
  for (let i = 0; i < keys.length; i += 100) {
    await c.env.EVIDENCE.delete(keys.slice(i, i + 100))
  }

  // assignment/redemption/kid_code rows cascade from the user row.
  await c.env.DB.prepare('DELETE FROM user WHERE id = ?').bind(childId).run()

  return c.json({ ok: true })
})

// ------------------------------------------------------------ guardians

const INVITE_TTL_MS = 24 * 60 * 60 * 1000

/** Who else is in this family. */
api.get('/guardians', async (c) => {
  const { results } = await c.env.DB
    .prepare(`
      SELECT u.id, u.name, u.email, m.role, m.joinedAt
      FROM family_member m JOIN user u ON u.id = m.userId
      WHERE m.familyId = ? ORDER BY m.joinedAt`)
    .bind(c.get('familyId'))
    .all()

  return c.json({ guardians: results ?? [], you: c.get('user').id })
})

/** Issue a 6-digit code another adult can redeem to join this family. */
api.post('/guardians/invite', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const familyId = c.get('familyId')
  const code = generateSixDigits()
  const expiresAt = Date.now() + INVITE_TTL_MS

  await c.env.DB.batch([
    // One live invite per family, same as the kid codes.
    c.env.DB.prepare('DELETE FROM family_invite WHERE familyId = ? AND usedAt IS NULL').bind(familyId),
    c.env.DB
      .prepare('INSERT INTO family_invite (id,familyId,invitedBy,codeHash,expiresAt,createdAt) VALUES (?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), familyId, c.get('user').id, await sha256Hex(code), expiresAt, Date.now()),
  ])

  return c.json({ code, expiresAt })
})

/**
 * Everything a join would do, worked out without doing any of it. The preview
 * and the join both run this, so what the adult confirms is exactly what then
 * happens. Returns `{ error, status }` or the plan.
 */
async function planJoin (c, code) {
  if (!/^\d{6}$/.test(code || '')) return { error: 'El código son 6 dígitos.', status: 400 }

  const db = c.env.DB
  const user = c.get('user')
  const invite = await db
    .prepare('SELECT * FROM family_invite WHERE codeHash = ? AND usedAt IS NULL')
    .bind(await sha256Hex(code))
    .first()

  if (!invite || invite.expiresAt < Date.now()) {
    return { error: 'Código inválido o vencido.', status: 401 }
  }
  if (invite.familyId === c.get('familyId')) {
    return { error: 'Ya perteneces a esa familia.', status: 400 }
  }

  const from = c.get('familyId')
  const to = invite.familyId

  const names = (r) => (r.results ?? []).map(x => x.name)
  const [guardians, theirKids, yourKids, others] = await db.batch([
    db.prepare(`SELECT u.name FROM family_member m JOIN user u ON u.id = m.userId
                WHERE m.familyId = ? ORDER BY m.joinedAt`).bind(to),
    db.prepare("SELECT name FROM user WHERE familyId = ? AND role = 'kid' ORDER BY createdAt").bind(to),
    db.prepare("SELECT name FROM user WHERE familyId = ? AND role = 'kid' ORDER BY createdAt").bind(from),
    db.prepare(`SELECT u.name FROM family_member m JOIN user u ON u.id = m.userId
                WHERE m.familyId = ? AND m.userId != ? ORDER BY m.joinedAt`).bind(from, user.id),
  ])

  if ((guardians.results?.length ?? 0) >= MAX_GUARDIANS) {
    return { error: `Esa familia ya tiene ${MAX_GUARDIANS} tutores.`, status: 409 }
  }

  // Only this adult moves if the old family still has other guardians —
  // dragging shared children out from under them would be wrong. Whatever they
  // built alone comes with them, instead of forcing them to delete real kids.
  const merging = (others.results?.length ?? 0) === 0
  const movingKids = merging ? names(yourKids) : []

  if (movingKids.length + (theirKids.results?.length ?? 0) > MAX_CHILDREN) {
    return { error: `Juntas, las dos familias pasarían de ${MAX_CHILDREN} hijos.`, status: 409 }
  }

  return {
    invite,
    from,
    to,
    merging,
    preview: {
      guardians: names(guardians),
      theirKids: names(theirKids),
      movingKids,
      yourKids: names(yourKids),
      stayingBehind: names(others),
      merging,
    },
  }
}

// One bucket for both: the preview must not be a faster way to test codes.
const joinLimit = rateLimit({ name: 'guardians-join', windowSec: 300, max: 5 })

/**
 * What joining with this code would do, changing nothing. It shows the inviting
 * family's first names — to the person holding their invite, which is the point:
 * a mistyped code must not land someone in a stranger's family unnoticed.
 */
api.post('/guardians/join/preview', joinLimit, async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const plan = await planJoin(c, body.code)
  if (plan.error) return c.json({ error: plan.error }, plan.status)

  return c.json(plan.preview)
})

/** An adult with their own account joins an existing family. */
api.post('/guardians/join', joinLimit, async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const plan = await planJoin(c, body.code)
  if (plan.error) return c.json({ error: plan.error }, plan.status)

  const { invite, from, to, merging } = plan
  const user = c.get('user')
  const ts = Date.now()

  const steps = [
    c.env.DB.prepare('INSERT INTO family_member (familyId,userId,role,joinedAt) VALUES (?,?,?,?)')
      .bind(to, user.id, 'guardian', ts),
    c.env.DB.prepare('DELETE FROM family_member WHERE familyId = ? AND userId = ?')
      .bind(from, user.id),
    c.env.DB.prepare('UPDATE user SET familyId = ? WHERE id = ?').bind(to, user.id),
    c.env.DB.prepare('UPDATE family_invite SET usedAt = ?, usedBy = ? WHERE id = ?')
      .bind(ts, user.id, invite.id),
  ]

  if (merging) {
    // Everything keyed to the old family follows. Evidence objects keep their
    // original R2 keys — deletion reads those from the DB, so they stay reachable.
    for (const table of ['user', 'mission', 'assignment', 'reward', 'redemption', 'kid_code']) {
      steps.push(
        c.env.DB.prepare(`UPDATE ${table} SET familyId = ? WHERE familyId = ?`).bind(to, from)
      )
    }
    steps.push(c.env.DB.prepare('DELETE FROM family WHERE id = ?').bind(from))
  }

  // D1 has no interactive transactions; batch is what keeps this atomic.
  await c.env.DB.batch(steps)

  return c.json({
    ok: true,
    familyId: to,
    merged: merging,
    movedChildren: plan.preview.movingKids.length,
  })
})

function generateSixDigits () {
  const limit = 4294967296 - (4294967296 % 1000000)
  const buf = new Uint32Array(1)
  let n
  do { crypto.getRandomValues(buf); n = buf[0] } while (n >= limit)
  return String(n % 1000000).padStart(6, '0')
}

async function sha256Hex (text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// --------------------------------------------------------------- proposals

/** A kid suggests a mission. It is inert until an adult accepts it. */
api.post('/proposals', async (c) => {
  if (!c.get('isKid')) return c.json({ error: 'Esto lo proponen los hijos.' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const title = (body.title || '').trim()
  if (!title) return c.json({ error: 'Falta el título.' }, 400)

  // The kid picks a theme and a difficulty; the adult sets the real reward,
  // so points are not accepted from this side.
  const POINTS = { facil: 30, media: 50, dificil: 80 }
  const difficulty = POINTS[body.difficulty] ? body.difficulty : 'facil'

  const proposal = {
    id: crypto.randomUUID(),
    familyId: c.get('familyId'),
    title: title.slice(0, 120),
    subtitle: `Propuesta por ${c.get('user').name}`,
    icon: body.icon || 'lightbulb',
    color: body.color || 'purple',
    points: POINTS[difficulty],
    createdAt: now(),
  }

  await c.env.DB.batch([
    c.env.DB
      .prepare(`INSERT INTO mission
                (id,familyId,title,subtitle,icon,color,points,createdAt,status,proposedBy,difficulty)
                VALUES (?,?,?,?,?,?,?,?,'propuesta',?,?)`)
      .bind(proposal.id, proposal.familyId, proposal.title, proposal.subtitle, proposal.icon,
            proposal.color, proposal.points, proposal.createdAt, c.get('user').id, difficulty),
    notifyGuardians(c.env.DB, proposal.familyId, {
      kind: 'propuesta',
      title: `${c.get('user').name} propuso una aventura`,
      body: proposal.title,
      link: '/pendientes',
    }),
  ])

  return c.json({ ...proposal, status: 'propuesta' }, 201)
})

/** Pending proposals — adults review them, kids watch their own. */
api.get('/proposals', async (c) => {
  const sql = `
    SELECT m.*, u.name AS childName, u.avatar AS childAvatar
    FROM mission m LEFT JOIN user u ON u.id = m.proposedBy
    WHERE m.familyId = ? AND m.status = 'propuesta'
      ${c.get('isKid') ? 'AND m.proposedBy = ?' : ''}
    ORDER BY m.createdAt DESC`

  const stmt = c.env.DB.prepare(sql)
  const { results } = await (c.get('isKid')
    ? stmt.bind(c.get('familyId'), c.get('user').id)
    : stmt.bind(c.get('familyId'))).all()

  return c.json({ proposals: results ?? [] })
})

/** Accept (becomes a real mission) or discard. */
api.patch('/proposals/:id', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const id = c.req.param('id')

  const row = await c.env.DB
    .prepare("SELECT id, title, proposedBy FROM mission WHERE id = ? AND familyId = ? AND status = 'propuesta'")
    .bind(id, c.get('familyId'))
    .first()
  if (!row) return c.json({ error: 'No encontrada.' }, 404)

  // The kid who proposed it is left waiting otherwise — tell them either way.
  const tellKid = (n) => (row.proposedBy ? [notifyUser(c.env.DB, row.proposedBy, n)] : [])

  if (body.status === 'rechazada') {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM mission WHERE id = ?').bind(id),
      ...tellKid({
        kind: 'descartada',
        title: 'Tu idea no se aceptó esta vez',
        body: `“${row.title}”. ¡Propón otra!`,
        link: '/kid/nueva',
      }),
    ])
    return c.json({ ok: true, status: 'rechazada' })
  }

  // Accepting may also adjust the points the adult thinks it is worth.
  const points = Number.isFinite(body.points) ? Math.max(0, Math.min(500, body.points)) : null
  await c.env.DB.batch([
    c.env.DB
      .prepare(`UPDATE mission SET status = 'activa'${points === null ? '' : ', points = ?'} WHERE id = ?`)
      .bind(...(points === null ? [id] : [points, id])),
    ...tellKid({
      kind: 'aceptada',
      title: '¡Aceptaron tu idea!',
      body: `“${row.title}” ya es una misión.`,
      link: '/kid',
    }),
  ])

  return c.json({ ok: true, status: 'activa' })
})

// ------------------------------------------------------- redemption review

/**
 * Adults resolve a redemption. Rejecting refunds automatically: the balance is
 * derived and only counts redemptions that are not 'rechazada'.
 */
api.patch('/redemptions/:id', async (c) => {
  const blocked = parentOnly(c); if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  if (!['entregada', 'rechazada', 'revertida'].includes(body.status)) {
    return c.json({ error: 'Estado inválido.' }, 400)
  }

  // Resolving acts on a request; reverting undoes something already resolved,
  // which is the whole point of it — so the allowed source states differ.
  const from = body.status === 'revertida'
    ? ['pedida', 'entregada']
    : ['pedida']

  const row = await c.env.DB
    .prepare(`SELECT r.id, r.status, r.childId, r.points, w.title, w.icon, w.color
              FROM redemption r JOIN reward w ON w.id = r.rewardId
              WHERE r.id = ? AND r.familyId = ? AND r.status IN (${from.map(() => '?').join(',')})`)
    .bind(c.req.param('id'), c.get('familyId'), ...from)
    .first()

  if (!row) {
    return c.json({
      error: body.status === 'revertida'
        ? 'Ese canje ya no se puede revertir.'
        : 'No encontrado.',
    }, 404)
  }

  const notice = {
    entregada: {
      kind: 'premio',
      title: `¡Recibiste “${row.title}”!`,
      body: 'Ya puedes disfrutarlo.',
    },
    rechazada: {
      kind: 'devuelto',
      title: `Tu canje de “${row.title}” no se aprobó`,
      body: `Te devolvimos ${row.points} puntos.`,
    },
    revertida: {
      kind: 'devuelto',
      title: `Se deshizo el canje de “${row.title}”`,
      body: `Te devolvimos ${row.points} puntos.`,
    },
  }[body.status]

  await c.env.DB.batch([
    c.env.DB
      .prepare('UPDATE redemption SET status = ?, resolvedAt = ? WHERE id = ?')
      .bind(body.status, now(), row.id),
    notifyUser(c.env.DB, row.childId, { ...notice, link: '/kid/recompensas', icon: row.icon, color: row.color }),
  ])

  return c.json({ ok: true, status: body.status })
})

// ------------------------------------------------------------ notifications

/** The latest notifications and how many are unread. The app polls this. */
api.get('/notifications', async (c) => {
  const db = c.env.DB
  const userId = c.get('user').id

  const [list, unread] = await db.batch([
    db.prepare(`SELECT id, kind, title, body, link, createdAt, readAt, icon, color
                FROM notification WHERE userId = ?
                ORDER BY createdAt DESC LIMIT 30`).bind(userId),
    db.prepare('SELECT COUNT(*) AS n FROM notification WHERE userId = ? AND readAt IS NULL').bind(userId),
  ])

  return c.json({
    notifications: list.results ?? [],
    unread: unread.results?.[0]?.n ?? 0,
  })
})

const NOTIFICATION_KEEP_MS = 60 * 24 * 60 * 60 * 1000 // two months

/**
 * Marks read everything up to `upTo` — the newest one the user actually saw — so
 * a notification that lands while the panel is open isn't swallowed unseen.
 */
api.post('/notifications/read', async (c) => {
  const db = c.env.DB
  const userId = c.get('user').id
  const body = await c.req.json().catch(() => ({}))
  const upTo = Number.isFinite(body.upTo) ? body.upTo : now()

  await db.batch([
    db.prepare('UPDATE notification SET readAt = ? WHERE userId = ? AND readAt IS NULL AND createdAt <= ?')
      .bind(now(), userId, upTo),
    // Read ones past two months are history nobody scrolls back to.
    db.prepare('DELETE FROM notification WHERE userId = ? AND readAt IS NOT NULL AND createdAt < ?')
      .bind(userId, now() - NOTIFICATION_KEEP_MS),
  ])

  return c.json({ ok: true })
})

// ------------------------------------------------------------------ avatar

// Face parts (skin, eyes, eyebrows, mouth, glasses) plus the app's own layer
// categories — folder names under app/src/assets/avatar — so a designer adding
// a category needs no API change. Checked by shape only: values are rendered
// on the device into an SVG shown through <img>, which runs no script, so a bad
// value can at worst draw a wrong piece on that kid's own face.
const AVATAR_KEY = /^[a-z][a-zA-Z]{1,19}$/
const AVATAR_VALUE = /^[a-z0-9-]{1,24}$/i
const AVATAR_MAX_KEYS = 16

/** A kid saves the avatar they designed. Only for themselves. */
api.post('/avatar', async (c) => {
  if (!c.get('isKid')) return c.json({ error: 'El avatar lo diseña cada niño desde su cuenta.' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const given = body.avatar
  if (!given || typeof given !== 'object' || Array.isArray(given)) {
    return c.json({ error: 'Avatar inválido.' }, 400)
  }

  const entries = Object.entries(given)
  if (entries.length > AVATAR_MAX_KEYS) return c.json({ error: 'Avatar inválido.' }, 400)

  const avatar = {}
  for (const [key, value] of entries) {
    if (!AVATAR_KEY.test(key)) return c.json({ error: 'Avatar inválido.' }, 400)
    if (value == null) continue
    if (typeof value !== 'string' || !AVATAR_VALUE.test(value)) {
      return c.json({ error: 'Avatar inválido.' }, 400)
    }
    avatar[key] = value
  }

  await c.env.DB
    .prepare('UPDATE user SET avatar = ? WHERE id = ?')
    .bind(JSON.stringify(avatar), c.get('user').id)
    .run()

  return c.json({ avatar })
})
