<template>
  <q-layout view="lHh Lpr lFf" class="bp-gradient-bg">
    <!-- Desktop / web -->
    <q-header v-if="$q.screen.gt.xs" class="bp-topbar-wrap">
      <div class="bp-topbar bp-desktop-wrap">
        <img src="@/assets/brand/Logo-Menu.svg" class="bp-topbar-logo" />

        <nav class="bp-topbar-nav">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="bp-navlink"
            :class="{ 'bp-navlink--active': isActive(item.to) }"
          >
            <BpIcon :name="item.icon" :active="isActive(item.to)" />
            <span>{{ item.label }}</span>
          </router-link>
        </nav>

        <NotificationBell />

        <router-link :to="moreTo" class="bp-more bp-more--inline" :class="{ 'bp-more--active': isActive(moreTo) }">
          <span class="bp-fab"><BpIcon name="plus" /></span>
          <span class="bp-fab-label">Más</span>
        </router-link>
      </div>
    </q-header>

    <!-- Phone: no top bar, so the bell floats over the page header -->
    <NotificationBell v-if="$q.screen.lt.sm" floating />

    <!-- Full-screen moment when a reward is handed over -->
    <RewardCelebration />

    <q-page-container>
      <router-view v-slot="{ Component }">
        <component :is="Component" :class="{ 'bp-desktop-wrap': $q.screen.gt.xs }" />
      </router-view>
    </q-page-container>

    <!-- Phone -->
    <q-footer v-if="$q.screen.lt.sm" class="bp-navbar-wrap">
      <div class="bp-navbar">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="bp-navlink"
          :class="{ 'bp-navlink--active': isActive(item.to) }"
        >
          <BpIcon :name="item.icon" :active="isActive(item.to)" />
          <span>{{ item.label }}</span>
        </router-link>

        <router-link :to="moreTo" class="bp-more" :class="{ 'bp-more--active': isActive(moreTo) }">
          <span class="bp-fab"><BpIcon name="plus" /></span>
          <span class="bp-fab-label">Más</span>
        </router-link>
      </div>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import BpIcon from '@/components/BpIcon.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import RewardCelebration from '@/components/RewardCelebration.vue'
import {
  notifications, startNotifications, stopNotifications, onNotification, kindOf,
} from '@/lib/notifications'
import { celebrate, celebrations } from '@/lib/celebrate'
import { apiFetch } from '@/lib/auth'
import { currentUser } from '@/lib/session'
import { PIECES, avatarUri } from '@/lib/avatar'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

// The badge palette, in Quasar's colour vocabulary.
const ICON_COLOR = {
  blue: 'primary', green: 'positive', amber: 'warning', pink: 'pink-6', purple: 'deep-purple-5',
}

let offToast = null

// Which reward notices a kid has already been shown full-screen on this device.
const CELEBRATED_KEY = 'bp-celebrated'
const CELEBRATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function wasCelebrated (id) {
  try { return JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]').includes(id) } catch { return false }
}

function markCelebrated (id) {
  try {
    const seen = JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]')
    localStorage.setItem(CELEBRATED_KEY, JSON.stringify([id, ...seen].slice(0, 50)))
  } catch { /* private mode: at worst it plays again */ }
}

function celebrateForKid (n) {
  markCelebrated(n.id)
  celebrate({
    icon: n.icon || 'redeem',
    color: n.color || 'pink',
    title: n.title,
    detail: n.body ? `${n.body} ¡Te lo ganaste!` : '¡Te lo ganaste!',
  })
}

// The API writes the title as "¡Misión aprobada! +N puntos"; the points come from there.
const pointsOf = (n) => Number(/\+(\d+)/.exec(n.title)?.[1] ?? 0)

/*
 * A parent approved: the kid's payoff for doing the mission, with the points.
 * Several at once (the app was closed) make one moment with the total, not a
 * queue of them.
 */
function celebrateApprovals (list) {
  if (!list.length) return
  list.forEach(n => markCelebrated(n.id))
  const points = list.reduce((sum, n) => sum + pointsOf(n), 0)
  if (list.length === 1) {
    const [n] = list
    return celebrate({ icon: n.icon || 'verified', color: n.color || 'green', title: '¡Misión aprobada!', detail: n.body || undefined, points })
  }
  const names = list.map(n => n.body).filter(Boolean)
  const shown = names.slice(0, 2).join(', ')
  celebrate({
    icon: 'verified',
    color: 'green',
    title: `¡${list.length} misiones aprobadas!`,
    detail: names.length > 2 ? `${shown} y ${names.length - 2} más.` : `${shown}.`,
    points,
  })
}

/*
 * A badge that opens an avatar piece gets its own moment: the kid's face,
 * already wearing it. Remembered per kid on this device. The first run takes
 * whatever is already open as history, so nobody gets five celebrations the
 * day this ships.
 */
async function announceUnlocks () {
  const me = currentUser.value
  if (!me || me.role !== 'kid') return
  const data = await apiFetch('/api/badges').catch(() => null)
  if (!Array.isArray(data?.badges)) return

  const earned = new Map(data.badges.filter(b => b.earned).map(b => [b.id, b]))
  const open = PIECES.filter(p => p.unlock && earned.has(p.unlock))
  const key = `bp-unlocks-seen:${me.id}`

  let seen = null
  try { seen = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* fresh */ }
  const remember = (ids) => { try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* private mode */ } }

  if (!Array.isArray(seen)) return remember(open.map(p => p.id))

  for (const p of open.filter(p => !seen.includes(p.id))) {
    seen.push(p.id)
    celebrate({
      image: avatarUri({ ...(JSON.parse(me.avatar || 'null') ?? {}), [p.key]: p.value }, me.id),
      color: 'amber',
      title: `¡Desbloqueaste: ${p.title}!`,
      // No pronoun: "póntelo" is wrong for la corona, "póntela" for el sombrero.
      detail: `Por ganar la insignia «${earned.get(p.unlock).label}». Ya está disponible en «Diseña tu avatar».`,
    })
  }
  remember(seen)
}

// Every signed-in screen lives under this layout, so this is the one place the
// polling starts — and stops on sign-out, when the router leaves for /login.
onMounted(() => {
  // A reward handed over while the app was closed still gets its moment the
  // next time the kid opens it — once per device.
  startNotifications().then(() => {
    if (!isKid.value) return
    const unseen = (kind) => notifications.value
      .filter(n => n.kind === kind && !n.readAt && !wasCelebrated(n.id) &&
        Date.now() - n.createdAt < CELEBRATE_WINDOW_MS)
      .reverse()
    celebrateApprovals(unseen('aprobada'))
    unseen('premio').forEach(celebrateForKid)
    announceUnlocks()
  })

  offToast = onNotification((n) => {
    // For a kid, getting the reward is the payoff of the whole app: it takes
    // the stage instead of a toast.
    if (n.kind === 'premio' && isKid.value) return celebrateForKid(n)
    if (n.kind === 'aprobada' && isKid.value) {
      celebrateApprovals([n])
      // An approval can complete a badge, and a badge can open a piece.
      announceUnlocks()
      return
    }

    const k = kindOf(n)
    $q.notify({
      message: n.title,
      caption: n.body || undefined,
      icon: k.icon,
      iconColor: ICON_COLOR[k.color],
      color: 'white',
      textColor: 'dark',
      classes: 'bp-toast',
      position: 'top',
      timeout: 5000,
      actions: n.link && n.link !== route.path
        ? [{ label: 'Ver', color: 'primary', noCaps: true, handler: () => router.push(n.link) }]
        : [],
    })
  })
})

onBeforeUnmount(() => {
  offToast?.()
  stopNotifications()
  // The queue outlives the layout; a kid's pending moment must not play for
  // whoever signs in next on this device.
  celebrations.value.splice(0).forEach(m => m.resolve?.())
})

// The kid area gets a shorter nav: no household statistics.
const ADULT_NAV = [
  { to: '/', icon: 'home', label: 'Inicio' },
  { to: '/misiones', icon: 'missions', label: 'Misiones' },
  { to: '/recompensas', icon: 'rewards', label: 'Recompensas' },
  { to: '/perfil', icon: 'profile', label: 'Cuenta' },
]

const KID_NAV = [
  { to: '/kid', icon: 'home', label: 'Inicio' },
  { to: '/kid/misiones', icon: 'missions', label: 'Mis misiones' },
  { to: '/kid/recompensas', icon: 'rewards', label: 'Premios' },
  { to: '/kid/perfil', icon: 'profile', label: 'Insignias' },
]

const isKid = computed(() => route.path.startsWith('/kid'))
const navItems = computed(() => (isKid.value ? KID_NAV : ADULT_NAV))
const moreTo = computed(() => (isKid.value ? '/kid/nueva' : '/nueva'))

const isActive = (path) => route.path === path
</script>
