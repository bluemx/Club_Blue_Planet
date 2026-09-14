import { ref } from 'vue'
import { apiFetch } from './auth'

export const currentUser = ref(null)

let inFlight = null
let loadedAt = 0

// The guard runs on every navigation, so the session can't be re-fetched each
// time — but it can't be cached forever either, or a session that expires or
// is revoked server-side keeps navigating as valid until a full reload.
const TTL_MS = 30_000
const SESSION_TIMEOUT_MS = 6_000

/** Cached session lookup, refreshed at most once every TTL_MS. */
export async function fetchSession () {
  if (loadedAt && Date.now() - loadedAt < TTL_MS) return currentUser.value
  if (inFlight) return inFlight

  // Bounded: every navigation waits on this, and a request that hangs (a phone
  // coming back from the background, a network switch) froze every button.
  const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(SESSION_TIMEOUT_MS) : undefined
  inFlight = apiFetch('/api/me', { signal })
    .then(({ user }) => user)
    // Only the server saying no signs you out. Slow or offline: keep who we had.
    .catch((err) => (err.status ? null : currentUser.value))
    .then((user) => {
      currentUser.value = user
      loadedAt = Date.now()
      inFlight = null
      return user
    })

  return inFlight
}

/** Call after sign-in/sign-up/redeem/sign-out so the next guard re-reads. */
export function invalidateSession () {
  loadedAt = 0
  inFlight = null
  currentUser.value = null
}

export const ENTER_FAILED =
  'Entraste, pero la app no pudo abrirse. Recarga la página e inténtalo otra vez. ' +
  'Si sigue igual, revisa que tu navegador no esté en modo privado ni bloqueando cookies.'

/**
 * After signing in: open the app and say whether it opened. A jump that fails
 * (a screen that won't load after a deploy, a browser that didn't keep the
 * session cookie and gets sent back) used to leave the sign-in screen sitting
 * on "Entrando…" with no word.
 */
export async function enterApp (router, path) {
  invalidateSession()
  const from = router.currentRoute.value.path
  await router.push(path).catch(() => {})
  return router.currentRoute.value.path !== from
}
