<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader title="Cuenta" :subtitle="['Administra tu cuenta y tu familia.']" />

    <div class="bp-sheet">
      <div class="bp-row q-mb-md">
        <q-avatar size="52px" color="primary" text-color="white" icon="face" />
        <div class="col">
          <div class="bp-row-title" style="font-size: 15px">{{ user?.name || '—' }}</div>
          <div class="bp-row-subtitle">{{ user?.email }}</div>
        </div>
        <div class="bp-points-pill">
          <q-icon name="star" size="14px" />
          {{ totalPoints }}
        </div>
      </div>

      <component
        :is="i.to ? 'router-link' : 'div'"
        v-for="i in items"
        :key="i.title"
        :to="i.to"
        class="bp-plain-link"
      >
        <MissionRow v-bind="rowProps(i)" tappable @click="i.action && i.action()">
          <template #trailing>
            <q-icon name="chevron_right" color="grey-5" size="22px" />
          </template>
        </MissionRow>
      </component>

      <!-- Weekly email: on by default, one switch to stop it. -->
      <MissionRow title="Resumen semanal por correo" subtitle="Cada lunes, cómo les fue a tus hijos." icon="mail" color="green">
        <template #trailing>
          <q-toggle :model-value="weekly" color="secondary" :disable="savingPrefs" aria-label="Resumen semanal por correo" @update:model-value="toggleWeekly" />
        </template>
      </MissionRow>
    </div>

    <LegalDialog v-model="privacyOpen" kind="privacy" />
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import { signOut } from '@/lib/auth'
import { currentUser, invalidateSession } from '@/lib/session'
import { summary, setPrefs, useResource } from '@/lib/api'
import LegalDialog from '@/components/LegalDialog.vue'

const router = useRouter()

const { data } = useResource(summary)
const user = currentUser
const children = computed(() => data.value?.children ?? [])
const totalPoints = computed(() => data.value?.totals?.points ?? 0)

const childrenLabel = computed(() =>
  children.value.length
    ? children.value.map(c => c.name).join(', ')
    : 'Agrega el primero.'
)

async function logout () {
  await signOut()
  invalidateSession()
  router.push('/login')
}

const items = computed(() => [
  { title: 'Mis hijos', subtitle: childrenLabel.value, icon: 'family_restroom', color: 'blue', to: '/hijos' },
  { title: 'Código para tu hijo', subtitle: 'Genera el código de cuenta infantil.', icon: 'pin', color: 'blue', to: '/perfil/codigo-infantil' },
  { title: 'Reporte semanal', subtitle: 'Cómo les va a tus hijos, semana a semana.', icon: 'insights', color: 'green', to: '/reporte' },
  { title: 'Por revisar', subtitle: 'Propuestas y premios pedidos.', icon: 'inbox', color: 'amber', to: '/pendientes' },
  { title: 'Tutores', subtitle: 'Comparte la cuenta con otro adulto.', icon: 'group', color: 'purple', to: '/tutores' },
  { title: 'Aviso de privacidad', subtitle: 'Qué datos guardamos y cómo los cuidamos.', icon: 'shield', color: 'purple', action: () => { privacyOpen.value = true } },
  { title: 'Cerrar sesión', subtitle: 'Salir de tu cuenta.', icon: 'logout', color: 'pink', action: logout },
])

const privacyOpen = ref(false)
const weekly = computed(() => user.value?.weeklyReport !== false)
const savingPrefs = ref(false)
async function toggleWeekly (on) {
  savingPrefs.value = true
  try {
    await setPrefs({ weeklyReport: on })
    if (user.value) user.value = { ...user.value, weeklyReport: on }
  } finally {
    savingPrefs.value = false
  }
}

// keep routing/behaviour keys out of the row's attrs
const rowProps = ({ to, action, ...rest }) => rest
</script>

<style scoped>
.bp-plain-link {
  display: block;
  text-decoration: none;
  color: inherit;
}
</style>
