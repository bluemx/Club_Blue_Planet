<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader title="Perfil" :subtitle="['Administra tu cuenta y tu familia.']" />

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
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import { signOut } from '@/lib/auth'
import { currentUser, invalidateSession } from '@/lib/session'
import { summary, useResource } from '@/lib/api'

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
  { title: 'Por revisar', subtitle: 'Propuestas y premios pedidos.', icon: 'inbox', color: 'amber', to: '/pendientes' },
  { title: 'Tutores', subtitle: 'Comparte la cuenta con otro adulto.', icon: 'group', color: 'purple', to: '/tutores' },
  { title: 'Cerrar sesión', subtitle: 'Salir de tu cuenta.', icon: 'logout', color: 'pink', action: logout },
])

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
