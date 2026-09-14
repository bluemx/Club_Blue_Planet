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

// Every signed-in screen lives under this layout, so this is the one place the
// polling starts — and stops on sign-out, when the router leaves for /login.
onMounted(() => {
  // A reward handed over while the app was closed still gets its moment the
  // next time the kid opens it — once per device.
  startNotifications().then(() => {
    if (!isKid.value) return
    notifications.value
      .filter(n => n.kind === 'premio' && !n.readAt && !wasCelebrated(n.id) &&
        Date.now() - n.createdAt < CELEBRATE_WINDOW_MS)
      .reverse()
      .forEach(celebrateForKid)
  })

  offToast = onNotification((n) => {
    // For a kid, getting the reward is the payoff of the whole app: it takes
    // the stage instead of a toast.
    if (n.kind === 'premio' && isKid.value) return celebrateForKid(n)

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
  { to: '/estadisticas', icon: 'stats', label: 'Estadísticas' },
  { to: '/perfil', icon: 'profile', label: 'Perfil' },
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
