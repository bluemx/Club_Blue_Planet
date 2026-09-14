import { ref } from 'vue'
import { apiFetch } from './auth'

export const currentUser = ref(null)

let inFlight = null
let loadedAt = 0

// The guard runs on every navigation, so the session can't be re-fetched each
// time — but it can't be cached forever either, or a session that expires or
// is revoked server-side keeps navigating as valid until a full reload.
const TTL_MS = 30_000

/** Cached session lookup, refreshed at most once every TTL_MS. */
export async function fetchSession () {
  if (loadedAt && Date.now() - loadedAt < TTL_MS) return currentUser.value
  if (inFlight) return inFlight

  inFlight = apiFetch('/api/me')
    .then(({ user }) => user)
    .catch(() => null)
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
