<template>
  <q-btn
    round flat
    class="bp-bell"
    :class="{ 'bp-bell--ring': ringing, 'bp-bell--float': floating }"
    :aria-label="unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'"
  >
    <q-icon name="notifications" size="24px" />
    <span v-if="unread" class="bp-bell-badge">{{ unread > 9 ? '9+' : unread }}</span>

    <q-menu
      anchor="bottom right"
      self="top right"
      :offset="[0, 10]"
      class="bp-notif-menu"
      @show="markNotificationsRead"
    >
      <div class="bp-notif-head">Notificaciones</div>

      <p v-if="!notifications.length" class="bp-hint bp-notif-empty">
        {{ isKid
          ? 'Aquí te avisamos cuando tengas misiones nuevas o premios.'
          : 'Aquí te avisamos cuando tus hijos terminen misiones o pidan premios.' }}
      </p>

      <button
        v-for="n in notifications"
        :key="n.id"
        v-close-popup
        type="button"
        class="bp-notif"
        :class="{ 'bp-notif--new': !n.readAt }"
        @click="open(n)"
      >
        <span class="bp-row-badge" :class="kindOf(n).color">
          <q-icon :name="kindOf(n).icon" />
        </span>
        <span class="bp-notif-text">
          <span class="bp-notif-title">{{ n.title }}</span>
          <span v-if="n.body" class="bp-notif-body">{{ n.body }}</span>
          <span class="bp-notif-time">{{ timeAgo(n.createdAt) }}</span>
        </span>
      </button>
    </q-menu>
  </q-btn>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  notifications, unread, markNotificationsRead, onNotification, kindOf, timeAgo,
} from '@/lib/notifications'

// Phone: no top bar to sit in, so it floats over the page header.
defineProps({ floating: { type: Boolean, default: false } })

const route = useRoute()
const router = useRouter()
const isKid = computed(() => route.path.startsWith('/kid'))

const ringing = ref(false)
let stopRinging = null

const off = onNotification(() => {
  // Off then on in the next frame, or a second arrival can't restart the swing.
  ringing.value = false
  clearTimeout(stopRinging)
  requestAnimationFrame(() => { ringing.value = true })
  stopRinging = setTimeout(() => { ringing.value = false }, 1000)
})

onBeforeUnmount(() => {
  off()
  clearTimeout(stopRinging)
})

function open (n) {
  if (n.link && n.link !== route.path) router.push(n.link)
}
</script>
