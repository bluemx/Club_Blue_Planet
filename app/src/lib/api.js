import { ref } from 'vue'
import { apiFetch, API_URL } from './auth'

export const missions = () => apiFetch('/api/missions')
export const rewards = () => apiFetch('/api/rewards')
export const summary = () => apiFetch('/api/summary')
export const assignments = () => apiFetch('/api/assignments')
/** status: 'pedida' (waiting to be handed over) or 'resueltas' (everything else). */
export const redemptions = ({ limit = 12, offset = 0, childId, status } = {}) => {
  const q = new URLSearchParams({ limit, offset })
  if (childId) q.set('childId', childId)
  if (status) q.set('status', status)
  return apiFetch(`/api/redemptions?${q}`)
}

export const createMission = (mission) =>
  apiFetch('/api/missions', { method: 'POST', body: JSON.stringify(mission) })

/** childIds may be one id or an array — the API accepts both. */
export const assignMission = (missionId, childIds) =>
  apiFetch('/api/assignments', {
    method: 'POST',
    body: JSON.stringify({ missionId, childIds: [].concat(childIds) }),
  })

export const setAssignmentStatus = (id, status, note) =>
  apiFetch(`/api/assignments/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note }) })

/** Sends the raw file; the API keys it by family and flips the status. */
export async function uploadEvidence (assignmentId, file) {
  const res = await fetch(`${API_URL}/api/assignments/${assignmentId}/evidence`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error('upload'), { status: res.status, data })
  return data
}

export const evidenceUrl = (assignmentId) =>
  `${API_URL}/api/assignments/${assignmentId}/evidence`

export const proposals = () => apiFetch('/api/proposals')

export const proposeMission = (proposal) =>
  apiFetch('/api/proposals', { method: 'POST', body: JSON.stringify(proposal) })

export const resolveProposal = (id, status, points) =>
  apiFetch(`/api/proposals/${id}`, { method: 'PATCH', body: JSON.stringify({ status, points }) })

/** 'revertida' undoes a delivery or a pending request and frees the points. */
export const resolveRedemption = (id, status) =>
  apiFetch(`/api/redemptions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })

/** A kid saves the avatar they designed (their own only). */
export const saveAvatar = (avatar) =>
  apiFetch('/api/avatar', { method: 'POST', body: JSON.stringify({ avatar }) })

/** What joining with this code would do — changes nothing. */
export const previewJoin = (code) =>
  apiFetch('/api/guardians/join/preview', { method: 'POST', body: JSON.stringify({ code }) })

export const joinFamily = (code) =>
  apiFetch('/api/guardians/join', { method: 'POST', body: JSON.stringify({ code }) })

export const redeemReward = (rewardId) =>
  apiFetch('/api/redemptions', { method: 'POST', body: JSON.stringify({ rewardId }) })

/** Adult hands a reward to a specific child; the API marks it delivered. */
export const redeemRewardFor = (rewardId, childId) =>
  apiFetch('/api/redemptions', { method: 'POST', body: JSON.stringify({ rewardId, childId }) })

/**
 * Tiny loader for screens: exposes data/loading/error and a reload.
 * Keeps every page from re-implementing the same three refs.
 */
export function useResource (loader, initial = null) {
  const data = ref(initial)
  const loading = ref(true)
  const error = ref('')

  // quiet: refresh in place without the spinner — for updates the user didn't
  // ask for, where blanking the screen would be worse than a stale second.
  async function reload ({ quiet = false } = {}) {
    if (!quiet) loading.value = true
    error.value = ''
    try {
      data.value = await loader()
    } catch (err) {
      error.value = err.status === 401
        ? 'Tu sesión expiró.'
        : 'No se pudieron cargar los datos.'
    } finally {
      loading.value = false
    }
  }

  reload()
  return { data, loading, error, reload }
}

/** Parent sets a child's year of birth (null clears it). */
export const setChildBirthYear = (childId, birthYear) =>
  apiFetch(`/api/children/${childId}`, { method: 'PATCH', body: JSON.stringify({ birthYear }) })

/** Five AI mission ideas for a child's age and a topic; nothing is saved. */
export const aiIdeas = (childId, topic) =>
  apiFetch('/api/suggestions/ai', { method: 'POST', body: JSON.stringify({ childId, topic }) })
