import { ref } from 'vue'
import { previewJoin, joinFamily } from './api'
import { invalidateSession } from './session'

/**
 * Joining another family can merge two families for good, so it takes two
 * steps: preview (which family, whose kids move) → confirm → join. Shared by
 * Tutores and the first-run screen in Hijos, which used to each join blind.
 *
 * @param {(result: object) => any} onJoined  what the page does once in
 */
export function useJoinFamily (onJoined) {
  const joinCode = ref('')
  const checking = ref(false)
  const joining = ref(false)
  const joinError = ref('')
  const plan = ref(null)
  const confirmOpen = ref(false)

  const errorOf = (err, fallback) => err.data?.hint || err.data?.error || fallback

  async function start () {
    if (joinCode.value.length < 6 || checking.value || joining.value) return
    checking.value = true
    joinError.value = ''
    try {
      plan.value = await previewJoin(joinCode.value)
      confirmOpen.value = true
    } catch (err) {
      joinError.value = errorOf(err, 'No se pudo revisar el código.')
      joinCode.value = ''
    } finally {
      checking.value = false
    }
  }

  async function confirm () {
    if (joining.value) return
    joining.value = true
    joinError.value = ''
    try {
      const res = await joinFamily(joinCode.value)
      confirmOpen.value = false
      invalidateSession()   // this account now acts in another family
      await onJoined(res)
    } catch (err) {
      confirmOpen.value = false
      joinError.value = errorOf(err, 'No se pudo unir.')
      joinCode.value = ''
    } finally {
      joining.value = false
    }
  }

  return { joinCode, checking, joining, joinError, plan, confirmOpen, start, confirm }
}
