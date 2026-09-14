<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Por revisar"
      :subtitle="['Ideas que proponen tus hijos', 'y premios que quieren canjear.']"
    />

    <!-- Proposals -->
    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="lightbulb" color="primary" size="26px" />
        Aventuras propuestas
      </div>

      <q-inner-loading :showing="loadingProposals" />

      <TransitionGroup tag="div" name="bp-fly">
        <MissionRow
          v-for="p in proposalList"
          :key="p.id"
          :title="p.title"
          :subtitle="`${p.childName} · dificultad ${p.difficulty || 'fácil'}`"
          :icon="p.icon"
          :color="p.color"
          :points="p.points"
        >
          <template #trailing>
            <q-btn
              flat round dense icon="close" color="grey-6"
              aria-label="Descartar"
              :loading="busyId === p.id"
              @click="resolve(p, 'rechazada')"
            >
              <q-tooltip>Descartar</q-tooltip>
            </q-btn>
            <q-btn
              round unelevated size="sm" icon="check"
              color="secondary" text-color="white"
              aria-label="Convertir en misión"
              :loading="busyId === p.id"
              @click="resolve(p, 'activa')"
            >
              <q-tooltip>Convertir en misión</q-tooltip>
            </q-btn>
          </template>
        </MissionRow>
      </TransitionGroup>

      <p v-if="!loadingProposals && !proposalList.length" class="bp-hint">
        Ninguna propuesta por ahora.
      </p>
    </div>

    <!-- Redemptions -->
    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="redeem" color="primary" size="26px" />
        Premios pedidos
      </div>

      <q-inner-loading :showing="loadingRedemptions" />
      <p v-if="actionError" class="bp-auth-error q-mb-sm">{{ actionError }}</p>

      <TransitionGroup tag="div" name="bp-fly">
        <MissionRow
          v-for="r in pendingRedemptions"
          :key="r.id"
          :title="r.title"
          :subtitle="`${r.childName} lo pidió`"
          :icon="r.icon"
          :color="r.color"
          :points="r.points"
          :sign="false"
        >
          <template #trailing>
            <q-btn
              flat round dense icon="close" color="grey-6"
              aria-label="Rechazar y devolver puntos"
              :disable="!!busyId"
              @click="resolveR(r, 'rechazada')"
            >
              <q-tooltip>Rechazar y devolver puntos</q-tooltip>
            </q-btn>
            <q-btn
              unelevated rounded no-caps size="sm"
              color="secondary" icon="redeem" label="Entregar"
              :loading="busyId === r.id"
              :disable="!!busyId && busyId !== r.id"
              @click="resolveR(r, 'entregada')"
            />
          </template>
        </MissionRow>
      </TransitionGroup>

      <p v-if="!loadingRedemptions && !pendingRedemptions.length" class="bp-hint">
        Nadie ha pedido un premio todavía.
      </p>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  proposals, redemptions, resolveProposal, resolveRedemption, useResource,
} from '@/lib/api'
import { celebrate } from '@/lib/celebrate'

const { data: pData, loading: loadingProposals } = useResource(proposals)
const { data: rData, loading: loadingRedemptions } = useResource(
  () => redemptions({ status: 'pedida', limit: 50 })
)

const proposalList = computed(() => pData.value?.proposals ?? [])
const pendingRedemptions = computed(() => rData.value?.redemptions ?? [])

const busyId = ref(null)
const actionError = ref('')

// Resolved items leave in place — no reload, no spinner over the whole list.
async function resolve (p, status) {
  busyId.value = p.id
  try {
    await resolveProposal(p.id, status)
    pData.value = { ...pData.value, proposals: proposalList.value.filter(x => x.id !== p.id) }
  } finally {
    busyId.value = null
  }
}

async function resolveR (r, status) {
  if (busyId.value) return
  busyId.value = r.id
  actionError.value = ''
  try {
    await resolveRedemption(r.id, status)
  } catch (err) {
    actionError.value = err.data?.error || 'No se pudo guardar. Inténtalo de nuevo.'
    return
  } finally {
    busyId.value = null
  }

  rData.value = { ...rData.value, redemptions: pendingRedemptions.value.filter(x => x.id !== r.id) }

  if (status === 'entregada') {
    celebrate({
      icon: r.icon,
      color: r.color,
      title: `¡“${r.title}” es para ${r.childName}!`,
      detail: `Se usaron ${r.points} de sus puntos.`,
    })
  }
}
</script>
