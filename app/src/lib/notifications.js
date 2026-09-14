import { ref } from 'vue'
import { apiFetch } from './auth'

/** Shared by the bell, the toasts and any page that wants to react. */
export const notifications = ref([])
export const unread = ref(0)

// ponytail: polling, not push. 30s is the ceiling on how stale a notice can be
// while the app is open; lock-screen delivery needs Web Push / native (Capacitor).
const POLL_MS = 30_000

const listeners = new Set()
let timer = null
let primed = false   // the first load is history, not news: no toasts for it
let newest = 0

export async function refreshNotifications () {
  const data = await apiFetch('/api/notifications').catch(() => null)
  if (!data) return

  const list = data.notifications ?? []
  const fresh = primed ? list.filter(n => n.createdAt > newest && !n.readAt) : []

  notifications.value = list
  unread.value = data.unread ?? 0
  if (list.length) newest = Math.max(newest, list[0].createdAt)
  primed = true

  // Oldest first, so stacked toasts read in the order things happened.
  fresh.reverse().forEach(n => listeners.forEach(fn => fn(n)))
}

/** Runs `fn` for every notification that arrives while the app is open. */
export function onNotification (fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function onVisible () {
  if (!document.hidden) refreshNotifications()
}

/** Resolves once the first load is in, so callers can look at what's already there. */
export function startNotifications () {
  if (timer) return Promise.resolve()
  const first = refreshNotifications()
  // A hidden tab doesn't poll — nobody is looking, and it's a request every
  // 30s for every phone with the app left open. Coming back refreshes at once.
  timer = setInterval(() => { if (!document.hidden) refreshNotifications() }, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
  return first
}

export function stopNotifications () {
  clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', onVisible)
  // The next account to sign in on this device must not inherit this list.
  notifications.value = []
  unread.value = 0
  primed = false
  newest = 0
}

/** Clears the badge. Items keep their highlight until the next refresh. */
export async function markNotificationsRead () {
  if (!unread.value) return
  const upTo = notifications.value[0]?.createdAt
  unread.value = 0
  await apiFetch('/api/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ upTo }),
  }).catch(() => {})
}

// Colours are the app's mission-badge family (.bp-row-badge.*).
const KINDS = {
  asignada:   { icon: 'assignment',   color: 'blue' },
  revision:   { icon: 'fact_check',   color: 'amber' },
  aprobada:   { icon: 'verified',     color: 'green' },
  canje:      { icon: 'shopping_bag', color: 'purple' },
  premio:     { icon: 'redeem',       color: 'pink' },
  devuelto:   { icon: 'replay',       color: 'amber' },
  propuesta:  { icon: 'lightbulb',    color: 'purple' },
  aceptada:   { icon: 'thumb_up',     color: 'green' },
  descartada: { icon: 'lightbulb',    color: 'blue' },
}

export const kindOf = (n) => KINDS[n.kind] ?? { icon: 'notifications', color: 'blue' }

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export function timeAgo (ts) {
  // Clamped: a phone clock a minute behind the server shouldn't say "dentro de".
  const s = Math.min(0, Math.round((ts - Date.now()) / 1000))
  if (s > -60) return 'ahora'
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute')
  if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}
