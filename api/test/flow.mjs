#!/usr/bin/env node
/**
 * Full-flow test of Club Blue Planet, as a parent and as kids, against a
 * running API. Every step goes through the public HTTP API, the same way the
 * app does.
 *
 *   npm run test:flow                 # local `wrangler dev` (http://localhost:8787)
 *   npm run test:flow -- --prod       # production, then deletes everything it made
 *   npm run test:flow -- --prod --ai  # also asks Workers AI for ideas (costs a little)
 *
 * It creates two families (the second checks that families can't see each
 * other). Every account it makes is `flow-test-<run>-…@unmensaje.com`; with
 * --prod the rows and photos are removed at the end, pass or fail.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const args = new Set(process.argv.slice(2))
const PROD = args.has('--prod')
const BASE = process.env.BASE || (PROD ? 'https://clubblueplanet.ealbinu.workers.dev' : 'http://localhost:8787')
const ORIGIN = process.env.ORIGIN || (PROD ? 'https://clubblueplanet-app.ealbinu.workers.dev' : 'http://localhost:9200')
const RUN = Date.now().toString(36)
const API_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// ------------------------------------------------------------------ harness

let passed = 0
const failures = []
let section = ''
function step (name) { section = name; console.log(`\n▸ ${name}`) }
function check (name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) } else {
    failures.push(`${section} → ${name}${detail !== '' ? ` (${detail})` : ''}`)
    console.log(`  ✗ ${name}${detail !== '' ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
  }
}

/** A browser-like client: keeps its session cookie, sends the app's Origin. */
function client (label) {
  let cookie = ''
  const call = async (method, p, body, headers = {}) => {
    const raw = body instanceof Uint8Array
    const res = await fetch(BASE + p, {
      method,
      headers: { origin: ORIGIN, ...(raw ? {} : { 'content-type': 'application/json' }), ...headers, ...(cookie && { cookie }) },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    })
    const set = res.headers.getSetCookie?.() ?? []
    if (set.length) cookie = set.map(c => c.split(';')[0]).join('; ')
    const type = res.headers.get('content-type') || ''
    const data = type.includes('json') ? await res.json().catch(() => null) : await res.arrayBuffer()
    return { status: res.status, data, type }
  }
  return {
    label,
    get: (p) => call('GET', p),
    post: (p, b, h) => call('POST', p, b, h),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
  }
}

const find = (list, pred) => (list ?? []).find(pred)
// A 1×1 PNG: the evidence endpoint checks the type and size, not the picture.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))
const made = { emails: [] }

async function signUp (who) {
  const email = `flow-test-${RUN}-${who}@unmensaje.com`
  made.emails.push(email)
  const c = client(who)
  const r = await c.post('/api/auth/sign-up/email', { email, password: `flow-${RUN}-Pass!`, name: who === 'mama' ? 'Mamá Prueba' : 'Otra Familia' })
  return { c, email, status: r.status }
}

async function kidSignIn (parent, childId) {
  const issued = await parent.post('/api/auth/kid-code/issue', { childId })
  const kid = client(`kid-${childId.slice(0, 4)}`)
  const r = await kid.post('/api/auth/kid-code/redeem', { code: issued.data?.code })
  return { kid, status: r.status, code: issued.data?.code }
}

// ------------------------------------------------------------------ the flow

async function flow () {
  console.log(`Club Blue Planet · prueba de flujo · ${BASE} · corrida ${RUN}`)

  step('Registro e inicio de sesión del adulto')
  const { c: mama, status } = await signUp('mama')
  check('se registra', status === 200, status)
  let r = await mama.get('/api/me')
  check('/me devuelve al adulto', r.data?.user?.role === 'parent', r.data)
  check('sin hijos todavía', r.data?.user?.childrenCount === 0)
  check('reporte semanal activado por defecto', r.data?.user?.weeklyReport === true)
  check('sin sesión no hay acceso', (await client('anon').get('/api/summary')).status === 401)

  step('Alta de hijos con consentimiento')
  r = await mama.post('/api/auth/kid-code/children', { name: 'Sin consentimiento' })
  check('sin consentimiento se rechaza', r.status === 400, r.status)
  r = await mama.post('/api/auth/kid-code/children', { name: 'Leo', consent: true })
  const leo = r.data?.id
  check('agrega a Leo con consentimiento', !!leo, r.data)
  r = await mama.post('/api/auth/kid-code/children', { name: 'Ana' })
  const ana = r.data?.id
  check('ya no pide consentimiento otra vez', !!ana, r.status)
  check('/me registra el consentimiento', !!(await mama.get('/api/me')).data?.user?.parentConsentAt)
  const year = new Date().getFullYear()
  check('edad de Leo (7)', (await mama.patch(`/api/children/${leo}`, { birthYear: year - 7 })).status === 200)
  check('edad inválida se rechaza', (await mama.patch(`/api/children/${ana}`, { birthYear: 1950 })).status === 400)
  r = await mama.get('/api/summary')
  check('el resumen lista a los 2 hijos', r.data?.children?.length === 2, r.data?.children?.length)

  step('Primeros pasos')
  r = await mama.get('/api/onboarding')
  check('hijo sí; misión, premio y entrada del niño no', r.data?.steps?.child && !r.data.steps.mission && !r.data.steps.reward && !r.data.steps.kidIn, r.data?.steps)

  step('Misiones: catálogo, crear y asignar')
  r = await mama.get('/api/missions')
  const catalog = (r.data?.missions ?? []).filter(m => !m.familyId)
  check('hay sugerencias del catálogo', catalog.length >= 5, catalog.length)
  const tarea = find(catalog, m => m.id === 'sug-tarea') ?? catalog[0]
  r = await mama.post('/api/missions', { title: 'Tiende tu cama', subtitle: 'Antes de desayunar', icon: 'bed', color: 'blue', points: 50 })
  const cama = r.data?.id
  check('crea una misión propia', r.status === 201 && !!cama, r.status)
  r = await mama.post('/api/assignments', { missionId: tarea.id, childIds: [leo, ana] })
  check('asigna una misión del catálogo a los dos', r.status === 201 || r.status === 200, r.status)
  r = await mama.post('/api/assignments', { missionId: cama, childIds: [leo], repeatDays: [0, 1, 2, 3, 4, 5, 6] })
  check('asigna una misión diaria a Leo', r.status === 201 && r.data?.repeat?.length === 7, r.data)
  check('una repetición sin días se rechaza', (await mama.post('/api/assignments', { missionId: cama, childIds: [leo], repeatDays: [] })).status === 400)
  r = await mama.get('/api/routines')
  check('la rutina aparece con su etiqueta', r.data?.routines?.[0]?.label === 'día', r.data?.routines?.[0])

  step('El niño entra con su código')
  const { kid: kLeo, status: kidStatus } = await kidSignIn(mama, leo)
  check('Leo entra con el código de 6 dígitos', kidStatus === 200, kidStatus)
  check('código incorrecto se rechaza', (await client('x').post('/api/auth/kid-code/redeem', { code: '000000' })).status === 401)
  r = await kLeo.get('/api/me')
  check('/me dice que es niño', r.data?.user?.role === 'kid', r.data?.user)
  r = await kLeo.get('/api/assignments')
  const mine = r.data?.assignments ?? []
  check('ve sus 2 misiones (la del catálogo y la diaria de hoy)', mine.length === 2, mine.length)
  check('solo ve las suyas', mine.every(a => a.childId === leo))
  r = await kLeo.get('/api/notifications')
  check('recibió avisos de misión nueva', (r.data?.notifications ?? []).some(n => n.kind === 'asignada'))
  check('el niño no puede crear misiones', (await kLeo.post('/api/missions', { title: 'x' })).status === 403)

  step('El niño manda la foto y el adulto aprueba')
  const aTarea = find(mine, a => a.missionId === tarea.id)
  const aCama = find(mine, a => a.missionId === cama)
  r = await kLeo.post(`/api/assignments/${aTarea.id}/evidence`, PNG, { 'content-type': 'image/png' })
  check('sube la foto de "tarea" → en revisión', r.status === 200 && r.data?.status === 'revision', r)
  check('un archivo que no es foto se rechaza', (await kLeo.post(`/api/assignments/${aCama.id}/evidence`, new Uint8Array([1, 2, 3]), { 'content-type': 'text/plain' })).status === 415)
  check('el niño no puede aprobarse a sí mismo', (await kLeo.patch(`/api/assignments/${aTarea.id}`, { status: 'lista' })).status === 403)
  r = await mama.get('/api/notifications')
  check('el adulto recibe "Leo terminó…"', (r.data?.notifications ?? []).some(n => n.kind === 'revision'))
  r = await mama.get(`/api/assignments/${aTarea.id}/evidence`)
  check('el adulto ve la foto', r.status === 200 && r.type.startsWith('image/'), `${r.status} ${r.type}`)
  r = await mama.patch(`/api/assignments/${aTarea.id}`, { status: 'lista' })
  check('el adulto aprueba', r.status === 200, r.status)
  r = await kLeo.post(`/api/assignments/${aCama.id}/evidence`, PNG, { 'content-type': 'image/png' })
  await mama.patch(`/api/assignments/${aCama.id}`, { status: 'lista' })
  r = await kLeo.get('/api/notifications')
  const approved = (r.data?.notifications ?? []).filter(n => n.kind === 'aprobada')
  check('el niño recibe 2 avisos de aprobación con ícono', approved.length === 2 && approved.every(n => n.icon), approved.length)
  const expected = tarea.points + 50
  r = await kLeo.get('/api/summary')
  const leoNow = r.data?.children?.[0]
  check(`Leo tiene ${expected} puntos`, leoNow?.points === expected, leoNow?.points)
  check('racha de 1 día', leoNow?.streak === 1, leoNow?.streak)
  r = await kLeo.get('/api/badges')
  check('ganó la insignia "Explorador"', !!find(r.data?.badges, b => b.id === 'explorador' && b.earned))
  check('marca sus avisos como leídos', (await kLeo.post('/api/notifications/read', {})).status === 200)

  step('Avatar del niño')
  r = await kLeo.post('/api/avatar', { avatar: { skin: 'f2d3b1', eyes: 'variant19', mouth: 'variant26', sombreros: 'gorra' } })
  check('guarda su avatar', r.status === 200, r.status)
  check('un avatar malformado se rechaza', (await kLeo.post('/api/avatar', { avatar: { 'bad key!': 'x' } })).status === 400)
  r = await mama.get('/api/summary')
  check('el adulto ve el avatar de Leo', JSON.parse(find(r.data?.children, k => k.id === leo)?.avatar || '{}').sombreros === 'gorra')

  step('El niño propone una idea')
  r = await kLeo.post('/api/proposals', { title: 'Leer un cuento a mi hermana', difficulty: 'media' })
  const idea = r.data?.id
  check('propone una idea', r.status === 201 && !!idea, r.status)
  r = await kLeo.post('/api/proposals', { title: 'Idea que no va', difficulty: 'facil' })
  const idea2 = r.data?.id
  r = await mama.get('/api/proposals')
  check('el adulto la ve', (r.data?.proposals ?? []).some(p => p.id === idea))
  check('acepta la idea con 70 puntos', (await mama.patch(`/api/proposals/${idea}`, { status: 'activa', points: 70 })).status === 200)
  check('rechaza la otra', (await mama.patch(`/api/proposals/${idea2}`, { status: 'rechazada' })).status === 200)
  r = await kLeo.get('/api/assignments')
  const fromIdea = find(r.data?.assignments, a => a.missionId === idea)
  check('la idea aceptada quedó en sus misiones con 70 puntos', fromIdea?.points === 70 && fromIdea?.status === 'pendiente', fromIdea)
  check('la rechazada no', !find(r.data?.assignments, a => a.missionId === idea2))

  step('Premios: canje, entrega, rechazo y límites')
  r = await mama.post('/api/rewards', { title: 'Helado', points: 30, maxPerChild: 1 })
  const helado = r.data
  check('crea un premio de 1 vez por hijo', r.status === 201 && helado?.maxPerChild === 1, r.data)
  r = await kLeo.post('/api/redemptions', { rewardId: helado.id })
  const pedido = r.data?.id
  check('Leo lo pide', r.status === 201 && r.data?.status === 'pedida', r.data)
  check('el adulto recibe el aviso de canje', ((await mama.get('/api/notifications')).data?.notifications ?? []).some(n => n.kind === 'canje'))
  r = await kLeo.post('/api/redemptions', { rewardId: helado.id })
  check('no puede pedirlo otra vez (límite 1)', r.status === 409, r.status)
  r = await mama.get('/api/redemptions?status=pedida')
  check('aparece en "por entregar"', (r.data?.redemptions ?? []).some(x => x.id === pedido))
  check('el adulto lo entrega', (await mama.patch(`/api/redemptions/${pedido}`, { status: 'entregada' })).status === 200)
  check('Leo recibe "¡Recibiste…!"', ((await kLeo.get('/api/notifications')).data?.notifications ?? []).some(n => n.kind === 'premio'))
  r = await kLeo.get('/api/summary')
  check(`le quedan ${expected - 30} puntos`, r.data?.children?.[0]?.points === expected - 30, r.data?.children?.[0]?.points)

  r = await mama.post('/api/rewards', { title: 'Película', points: 20, maxPerChild: null })
  const peli = r.data
  r = await kLeo.post('/api/redemptions', { rewardId: peli.id })
  check('el adulto rechaza un pedido', (await mama.patch(`/api/redemptions/${r.data?.id}`, { status: 'rechazada' })).status === 200)
  r = await kLeo.get('/api/summary')
  check('al rechazar se le devuelven los puntos', r.data?.children?.[0]?.points === expected - 30, r.data?.children?.[0]?.points)
  r = await mama.post('/api/redemptions', { rewardId: peli.id, childId: ana })
  check('Ana no tiene puntos para que se lo entreguen', r.status === 400, r.status)

  r = await mama.post('/api/rewards', { title: 'Parque', points: 5, maxPerChild: null, requiredStreak: 3 })
  check('premio que pide 3 días de racha: aún no', (await kLeo.post('/api/redemptions', { rewardId: r.data.id })).status === 409)
  r = await mama.post('/api/rewards', { title: 'Cine', points: 5, maxPerChild: null, expiresInDays: 7 })
  const cine = r.data
  check('premio con fecha límite', cine?.expiresAt > Date.now())
  check('se edita el premio', (await mama.patch(`/api/rewards/${cine.id}`, { title: 'Cine en familia', points: 6 })).status === 200)
  check('se archiva el premio', (await mama.del(`/api/rewards/${cine.id}`)).status === 200)
  check('el archivado ya no se puede pedir', (await kLeo.post('/api/redemptions', { rewardId: cine.id })).status === 404)
  check('el niño no puede crear premios', (await kLeo.post('/api/rewards', { title: 'x', points: 1 })).status === 403)

  step('Editar y archivar misiones y rutinas')
  check('edita su misión', (await mama.patch(`/api/missions/${cama}`, { title: 'Tiende tu cama bien', points: 60 })).status === 200)
  check('las del catálogo no se editan', (await mama.patch(`/api/missions/${tarea.id}`, { title: 'x' })).status === 404)
  const routineId = (await mama.get('/api/routines')).data?.routines?.[0]?.id
  check('cambia los días de la rutina', (await mama.patch(`/api/routines/${routineId}`, { days: [1, 3, 5] })).data?.days?.join() === '1,3,5')
  check('detiene la rutina', (await mama.del(`/api/routines/${routineId}`)).status === 200)
  check('archiva la misión', (await mama.del(`/api/missions/${cama}`)).status === 200)
  check('la archivada no se puede asignar', (await mama.post('/api/assignments', { missionId: cama, childIds: [ana] })).status === 404)

  step('Reporte y preferencias')
  r = await mama.get('/api/report')
  const rep = find(r.data?.children, ch => ch.id === leo)
  check('el reporte cuenta 2 misiones de Leo esta semana', rep?.done === 2, rep)
  check('el niño no ve el reporte', (await kLeo.get('/api/report')).status === 403)
  check('apaga el resumen por correo', (await mama.patch('/api/me/prefs', { weeklyReport: false })).data?.weeklyReport === false)
  r = await mama.get('/api/onboarding')
  check('primeros pasos: misión, premio y entrada del niño hechos', r.data?.steps?.mission && r.data.steps.reward && r.data.steps.kidIn, r.data?.steps)

  step('Tutores: invitar a otro adulto')
  r = await mama.post('/api/guardians/invite', {})
  check('genera un código de invitación', /^\d{6}$/.test(r.data?.code ?? ''), r.data)

  step('Otra familia no ve nada de esta')
  const { c: otra } = await signUp('otra')
  await otra.get('/api/me')
  r = await otra.get('/api/assignments')
  check('no ve misiones ajenas', (r.data?.assignments ?? []).length === 0)
  check('no puede aprobar misiones ajenas', (await otra.patch(`/api/assignments/${fromIdea.id}`, { status: 'lista' })).status === 404)
  check('no puede ver fotos ajenas', (await otra.get(`/api/assignments/${aTarea.id}/evidence`)).status === 404)
  check('no puede sacar código de un niño ajeno', (await otra.post('/api/auth/kid-code/issue', { childId: leo })).status === 404)
  check('no puede borrar a un niño ajeno', (await otra.del(`/api/children/${leo}`)).status === 404)

  if (args.has('--ai')) {
    step('Ideas dinámicas (Workers AI)')
    r = await mama.post('/api/suggestions/ai', { childId: leo, topic: 'Ser responsable' })
    check('devuelve ideas', r.status === 200 && r.data?.ideas?.length >= 3, r.status)
    check('las ideas tienen título, tipo y puntos', (r.data?.ideas ?? []).every(i => i.title && i.icon && [20, 50, 100].includes(i.points)))
  }

  step('Eliminar a un hijo')
  check('borra a Ana', (await mama.del(`/api/children/${ana}`)).status === 200)
  r = await mama.get('/api/summary')
  check('queda solo Leo', r.data?.children?.length === 1)
  r = await mama.del(`/api/children/${leo}`)
  check('borra a Leo (y sus fotos)', r.status === 200)
  check('la sesión del niño borrado ya no sirve', (await kLeo.get('/api/assignments')).status === 401)
}

// ------------------------------------------------------------------ cleanup

function cleanupProd () {
  const like = `flow-test-${RUN}-%@unmensaje.com`
  const fam = `(SELECT familyId FROM user WHERE email LIKE '${like}')`
  const sql = [
    `DELETE FROM routine WHERE familyId IN ${fam}`,
    `DELETE FROM redemption WHERE familyId IN ${fam}`,
    `DELETE FROM assignment WHERE familyId IN ${fam}`,
    `DELETE FROM reward WHERE familyId IN ${fam}`,
    `DELETE FROM mission WHERE familyId IN ${fam}`,
    `DELETE FROM family WHERE id IN ${fam}`,
    `DELETE FROM user WHERE familyId IN ${fam} OR email LIKE '${like}'`,
    `SELECT COUNT(*) AS left FROM user WHERE email LIKE '${like}'`,
  ].join('; ')
  // Photos: deleting the children through the API already removed them from R2.
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'club-blue-planet', '--remote', '--json', '--command', sql],
    { cwd: API_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const left = JSON.parse(out).at(-1)?.results?.[0]?.left
  console.log(`\nLimpieza en producción: ${left === 0 ? 'todo borrado' : `quedaron ${left} cuentas`}`)
}

try {
  await flow()
} catch (err) {
  failures.push(`${section} → se detuvo: ${err.stack || err}`)
  console.log(`  ✗ se detuvo: ${err.message}`)
} finally {
  if (PROD) { try { cleanupProd() } catch (e) { console.log(`\nLimpieza falló: ${e.message}`) } }
}

console.log(`\n${failures.length ? '✗' : '✓'} ${passed} pasaron, ${failures.length} fallaron`)
for (const f of failures) console.log(`  - ${f}`)
process.exit(failures.length ? 1 : 0)
