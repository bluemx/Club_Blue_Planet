import { ref } from 'vue'

/** Moments waiting to be played; RewardCelebration.vue shows them one at a time. */
export const celebrations = ref([])

let seq = 0

/**
 * Queue a full-screen celebration. Resolves when the viewer dismisses it, so a
 * caller can land what comes next (a counter bump) after the curtain lifts.
 *
 * @param {{ title: string, detail?: string, icon?: string, image?: string, color: string }} moment
 *   `image` (a data: URI) replaces the icon — used to show the kid's own face.
 */
export function celebrate (moment) {
  return new Promise((resolve) => {
    celebrations.value.push({ ...moment, id: `cele-${++seq}`, resolve })
  })
}
