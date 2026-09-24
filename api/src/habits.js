/**
 * Habits over time: recurring missions (routines), streaks and the weekly
 * report. Days are Mexico City days (UTC-6, no DST since 2022).
 */
import { sendEmail } from './email.js'

const TZ_MS = 6 * 3600e3
const DAY_MS = 24 * 3600e3

/** 'YYYY-MM-DD' in Mexico City for a timestamp. */
export const localDay = (ts = Date.now()) => new Date(ts - TZ_MS).toISOString().slice(0, 10)
/** 0 = Sunday … 6 = Saturday, in Mexico City. */
export const localWeekday = (ts = Date.now()) => new Date(ts - TZ_MS).getUTCDay()
/** UTC timestamp of local midnight for a 'YYYY-MM-DD'. */
const dayStart = (day) => Date.parse(`${day}T00:00:00Z`) + TZ_MS

/** Days array [0..6] → bitmask, and back. */
export const daysToMask = (days) => [...new Set(days)].filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
  .reduce((m, d) => m | (1 << d), 0)
export const maskToDays = (mask) => [0, 1, 2, 3, 4, 5, 6].filter(d => mask & (1 << d))

/**
 * Today's copy of every active routine that runs today. Idempotent (the
 * unique (routineId, day) index + INSERT OR IGNORE), so the cron and every
 * read can both call it. A routine copy left undone from an earlier day is
 * dropped: yesterday's "lávate los dientes" isn't today's to-do.
 * Returns the routines that got a new copy (for notifications).
 */
export async function materializeRoutines (db, familyId = null) {
  const today = localDay()
  const bit = 1 << localWeekday()
  const { results: due } = await db
    .prepare(`SELECT r.id, r.familyId, r.missionId, r.childId, m.title, m.points
              FROM routine r JOIN mission m ON m.id = r.missionId AND m.status = 'activa'
              WHERE r.stoppedAt IS NULL AND (r.days & ?) != 0 ${familyId ? 'AND r.familyId = ?' : ''}
                AND NOT EXISTS (SELECT 1 FROM assignment a WHERE a.routineId = r.id AND a.day = ?)`)
    .bind(bit, ...(familyId ? [familyId] : []), today)
    .all()

  const ts = Date.now()
  const stale = db
    .prepare(`DELETE FROM assignment WHERE routineId IS NOT NULL AND status = 'pendiente' AND day < ?
              ${familyId ? 'AND familyId = ?' : ''}`)
    .bind(today, ...(familyId ? [familyId] : []))

  if (!due?.length) { await stale.run(); return [] }

  await db.batch([
    stale,
    ...due.map(r => db
      .prepare(`INSERT OR IGNORE INTO assignment (id,missionId,childId,familyId,status,points,createdAt,routineId,day)
                VALUES (?,?,?,?, 'pendiente', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), r.missionId, r.childId, r.familyId, r.points, ts, r.id, today)),
  ])
  return due
}

/**
 * Days in a row, ending today or yesterday, on which the child reported at
 * least one mission. Today not done yet doesn't break it.
 */
export async function streakFor (db, childId) {
  const since = Date.now() - 400 * DAY_MS
  const { results } = await db
    .prepare(`SELECT reportedAt FROM assignment
              WHERE childId = ? AND reportedAt IS NOT NULL AND reportedAt > ? AND status IN ('revision','lista')`)
    .bind(childId, since)
    .all()
  const days = new Set((results ?? []).map(r => localDay(r.reportedAt)))
  let cursor = Date.now()
  if (!days.has(localDay(cursor))) cursor -= DAY_MS
  let n = 0
  while (days.has(localDay(cursor))) { n++; cursor -= DAY_MS }
  return n
}

/** Monday 00:00 (Mexico) of the week `weeksAgo` weeks back, and the next Monday. */
function weekBounds (weeksAgo = 0) {
  const today = localDay()
  const wd = localWeekday()
  const mondayOffset = (wd + 6) % 7
  const start = dayStart(today) - mondayOffset * DAY_MS - weeksAgo * 7 * DAY_MS
  return { start, end: start + 7 * DAY_MS }
}

/**
 * A family's week, per child: missions approved, points earned, compared
 * with the week before, the streak, the kinds of missions and what's waiting.
 */
export async function weekReport (db, familyId, weeksAgo = 0) {
  const { start, end } = weekBounds(weeksAgo)
  const prev = weekBounds(weeksAgo + 1)
  const { results: kids } = await db
    .prepare("SELECT id, name, avatar FROM user WHERE familyId = ? AND role = 'kid' ORDER BY createdAt")
    .bind(familyId).all()

  const children = []
  for (const k of kids ?? []) {
    const [{ results: done }, last, waiting, spent] = await Promise.all([
      db.prepare(`SELECT a.points, m.icon, m.title FROM assignment a JOIN mission m ON m.id = a.missionId
                  WHERE a.childId = ? AND a.status = 'lista' AND a.approvedAt >= ? AND a.approvedAt < ?`)
        .bind(k.id, start, end).all(),
      db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(points),0) AS pts FROM assignment
                  WHERE childId = ? AND status = 'lista' AND approvedAt >= ? AND approvedAt < ?`)
        .bind(k.id, prev.start, prev.end).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM assignment WHERE childId = ? AND status = 'revision'`).bind(k.id).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM redemption WHERE childId = ? AND status = 'entregada' AND resolvedAt >= ? AND resolvedAt < ?`)
        .bind(k.id, start, end).first(),
    ])
    const byIcon = {}
    for (const d of done ?? []) byIcon[d.icon] = (byIcon[d.icon] ?? 0) + 1
    children.push({
      id: k.id,
      name: k.name,
      avatar: k.avatar,
      done: done?.length ?? 0,
      points: (done ?? []).reduce((s, d) => s + d.points, 0),
      lastWeekDone: last?.n ?? 0,
      lastWeekPoints: last?.pts ?? 0,
      streak: await streakFor(db, k.id),
      waiting: waiting?.n ?? 0,
      rewards: spent?.n ?? 0,
      byIcon: Object.entries(byIcon).sort((a, b) => b[1] - a[1]).map(([icon, n]) => ({ icon, n })),
    })
  }
  return { start, end, children }
}

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/** Monday morning: last week's report to every guardian who hasn't opted out. */
export async function sendWeeklyReports (env) {
  const db = env.DB
  const { results: guardians } = await db
    .prepare(`SELECT u.email, u.name, fm.familyId FROM family_member fm JOIN user u ON u.id = fm.userId
              WHERE u.weeklyReport = 1 AND u.email NOT LIKE '%@kid.invalid'`)
    .all()
  const byFamily = {}
  for (const g of guardians ?? []) (byFamily[g.familyId] ??= []).push(g)

  const app = (env.APP_ORIGINS || '').split(',')[0]
  for (const [familyId, list] of Object.entries(byFamily)) {
    const report = await weekReport(db, familyId, 1)
    if (!report.children.length) continue
    const lines = report.children.map(ch => {
      const trend = ch.done > ch.lastWeekDone ? '↑' : ch.done < ch.lastWeekDone ? '↓' : '='
      return `${ch.name}: ${ch.done} misiones aprobadas (${trend} vs ${ch.lastWeekDone}), ${ch.points} puntos, racha de ${ch.streak} días${ch.waiting ? `, ${ch.waiting} por revisar` : ''}.`
    })
    const text = `Así les fue la semana pasada:\n\n${lines.join('\n')}\n\nVe el detalle en ${app}/#/reporte\n\nPara dejar de recibir este correo, desactívalo en Cuenta.`
    const html = `<div style="font-family:Arial,sans-serif;color:#0B2A5B;max-width:520px">
      <h2 style="color:#1467E4">Así les fue la semana pasada</h2>
      ${report.children.map(ch => `<p style="margin:0 0 12px"><strong>${esc(ch.name)}</strong><br>
        ${ch.done} misiones aprobadas (la semana anterior: ${ch.lastWeekDone}) · ${ch.points} puntos · racha de ${ch.streak} días${ch.waiting ? ` · ${ch.waiting} por revisar` : ''}</p>`).join('')}
      <p><a href="${esc(app)}/#/reporte" style="color:#1467E4;font-weight:bold">Ver el reporte completo</a></p>
      <p style="color:#7C93B5;font-size:12px">Para dejar de recibir este correo, desactívalo en Cuenta dentro de la app.</p></div>`
    for (const g of list) {
      await sendEmail(env, { to: g.email, subject: 'Tu resumen semanal de Club Blue Planet', text, html }).catch(() => {})
    }
  }
}
