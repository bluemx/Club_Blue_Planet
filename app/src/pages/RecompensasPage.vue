<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Recompensas"
      :subtitle="['Define qué pueden canjear tus hijos', 'con los puntos que ganen.']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="redeem" color="primary" size="26px" />
        Toca una recompensa para entregársela a uno de tus hijos.
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <template v-if="!loading && !error">
        <MissionRow
          v-for="r in list"
          :key="r.id"
          :title="r.title"
          :subtitle="[r.subtitle, limitLabel(r), askedLabel(r)].filter(Boolean).join(' · ')"
          :icon="r.icon"
          :color="r.color"
          :points="r.points"
          :sign="false"
          tappable
          @click="openGrant(r)"
        />

        <p v-if="!children.length" class="bp-hint">
          Agrega un hijo para poder entregar recompensas.
        </p>
      </template>

      <q-btn
        outline rounded no-caps
        icon="add"
        label="Crear recompensa"
        class="bp-cta"
        @click="createOpen = true"
      />
    </div>

    <div class="bp-sheet">
      <!--
        Same shape as Misiones: "Historial" is the inbox a resolved request
        lands in, and its counter takes the hit once it arrives.
      -->
      <div class="bp-seg" role="tablist">
        <button
          type="button"
          role="tab"
          class="bp-seg-btn"
          :class="{ 'bp-seg-btn--on': tab === 'pendientes' }"
          :aria-selected="tab === 'pendientes'"
          @click="tab = 'pendientes'"
        >
          <span class="bp-seg-icon"><q-icon name="card_giftcard" size="18px" /></span>
          Por entregar
          <span class="bp-seg-count">{{ pending.length }}</span>
        </button>

        <button
          type="button"
          role="tab"
          class="bp-seg-btn"
          :class="{ 'bp-seg-btn--on': tab === 'historial' }"
          :aria-selected="tab === 'historial'"
          @click="tab = 'historial'"
        >
          <span ref="historyIcon" :key="`hi${bumpHistory}`" class="bp-seg-icon" :class="{ 'bp-seg-icon--gulp': bumpHistory }">
            <q-icon name="inventory_2" size="18px" />
          </span>
          Historial
          <span :key="`hc${bumpHistory}`" class="bp-seg-count bp-seg-count--done" :class="{ 'bp-seg-count--bump': bumpHistory }">
            {{ resolvedCount }}
          </span>
        </button>
      </div>

      <p v-if="actionError" class="bp-auth-error q-mb-sm">{{ actionError }}</p>

      <!-- Requests from the kids, waiting to be handed over -->
      <template v-if="tab === 'pendientes'">
        <q-inner-loading :showing="loadingPending" />

        <TransitionGroup v-if="!loadingPending" tag="div" name="bp-fly">
          <MissionRow
            v-for="r in pending"
            :key="r.id"
            :ref="(el) => setRow(r.id, el)"
            :by="{ id: r.childId, avatar: r.childAvatar }"
            :title="r.title"
            :subtitle="`${r.childName} lo pidió · ${when(r)}`"
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
                @click="reject(r)"
              >
                <q-tooltip>Rechazar y devolver puntos</q-tooltip>
              </q-btn>
              <q-btn
                unelevated rounded no-caps size="sm"
                color="secondary" icon="redeem" label="Entregar"
                :loading="busyId === r.id"
                :disable="!!busyId && busyId !== r.id"
                @click="deliver(r)"
              />
            </template>
          </MissionRow>
        </TransitionGroup>

        <p v-if="!loadingPending && !pending.length" class="bp-hint">
          Nadie ha pedido un premio. Cuando tus hijos canjeen puntos, aparecerá aquí.
        </p>
      </template>

      <!-- Everything already resolved, paginated -->
      <template v-else>
        <KidPicker
          v-if="children.length > 1"
          v-model="filterChild"
          :children="children"
          allow-all
          label="Filtrar por hijo"
          class="q-mb-sm"
          @change="goToPage(0)"
        />

        <q-inner-loading :showing="loadingHistory" />

        <TransitionGroup tag="div" name="bp-fly">
          <MissionRow
            v-for="h in history"
            :key="h.id"
            :by="{ id: h.childId, avatar: h.childAvatar }"
            :title="h.title"
            :subtitle="`${h.childName} · ${when(h)}`"
            :icon="h.icon"
            :color="h.color"
            :points="h.points"
            :sign="false"
          >
            <template #trailing>
              <q-btn
                v-if="h.status === 'entregada'"
                flat round dense icon="undo" color="grey-6"
                aria-label="Revertir"
                :loading="revertingId === h.id"
                @click="askRevert(h)"
              >
                <q-tooltip>Revertir</q-tooltip>
              </q-btn>
              <span class="bp-state" :class="STATE[h.status].cls">
                {{ STATE[h.status].label }}
              </span>
            </template>
          </MissionRow>
        </TransitionGroup>

        <p v-if="!loadingHistory && !history.length" class="bp-hint">
          {{ offset ? 'No hay más canjes.' : 'Aquí llegan los premios que entregues.' }}
        </p>

        <div v-if="offset || hasMore" class="bp-pager">
          <q-btn
            flat rounded dense no-caps icon="chevron_left" label="Anteriores"
            :disable="!offset || loadingHistory"
            @click="goToPage(offset - pageSize)"
          />
          <span class="bp-pager-info">{{ offset + 1 }}–{{ offset + history.length }}</span>
          <q-btn
            flat rounded dense no-caps icon-right="chevron_right" label="Siguientes"
            :disable="!hasMore || loadingHistory"
            @click="goToPage(offset + pageSize)"
          />
        </div>
      </template>
    </div>

    <q-dialog v-model="revertOpen">
      <div class="bp-confirm">
        <h2 class="bp-confirm-title">¿Revertir este canje?</h2>
        <p class="bp-confirm-text">
          Se le devuelven {{ reverting?.points }} puntos a {{ reverting?.childName }}
          y el canje queda marcado como revertido.
        </p>
        <div class="bp-confirm-foot">
          <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
          <q-btn
            unelevated rounded no-caps
            color="primary" label="Revertir" class="col"
            :loading="revertingId === reverting?.id"
            @click="doRevert"
          />
        </div>
      </div>
    </q-dialog>

    <GrantRewardDialog
      v-model="grantOpen"
      :reward="picked"
      :children="children"
      :pending="pending.filter(p => p.rewardId === picked?.id)"
      @granted="onGranted"
      @deliver="deliver"
    />

    <!-- create reward -->
    <q-dialog v-model="createOpen">
      <div class="bp-assign">
        <header class="bp-assign-head">
          <h2 class="bp-assign-title">Nueva recompensa</h2>
          <q-btn v-close-popup flat round dense icon="close" color="grey-7" aria-label="Cerrar" />
        </header>

        <div class="bp-assign-body">
          <div class="bp-field-label">¿Qué se gana?</div>
          <q-input
            v-model="title"
            outlined dense rounded hide-bottom-space
            placeholder="Ej. Una salida al cine"
            class="bp-field q-mb-md"
            maxlength="80"
          />

          <div class="bp-field-label">¿Cuántos puntos cuesta?</div>
          <div class="bp-points-row">
            <q-btn round flat dense icon="remove" color="primary" @click="bump(-50)" />
            <span class="bp-points-value">
              <q-icon name="star" size="20px" />
              {{ points }}
            </span>
            <q-btn round flat dense icon="add" color="primary" @click="bump(50)" />
          </div>

          <div class="bp-field-label q-mt-md">¿Cuántas veces puede canjearla cada hijo?</div>
          <div class="bp-limit" role="radiogroup" aria-label="Veces por hijo">
            <button
              v-for="opt in LIMITS"
              :key="String(opt.value)"
              type="button"
              role="radio"
              class="bp-limit-opt"
              :class="{ 'is-on': maxPerChild === opt.value }"
              :aria-checked="maxPerChild === opt.value"
              @click="maxPerChild = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <p class="bp-limit-hint">
            {{ maxPerChild === null
              ? 'Tus hijos podrán canjearla cuantas veces junten los puntos.'
              : `Cuando un hijo la canjee ${maxPerChild === 1 ? 'una vez' : `${maxPerChild} veces`}, ya no podrá pedirla. Para dársela otra vez, crea una nueva.` }}
          </p>

          <p v-if="createError" class="bp-auth-error q-mt-sm">{{ createError }}</p>
        </div>

        <footer class="bp-assign-foot">
          <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
          <button type="button" class="bp-submit col" :disabled="!title.trim() || saving" @click="save">
            {{ saving ? 'Guardando…' : 'Crear' }}
          </button>
        </footer>
      </div>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import GrantRewardDialog from '@/components/GrantRewardDialog.vue'
import KidPicker from '@/components/KidPicker.vue'
import { rewards, redemptions, summary, resolveRedemption, useResource } from '@/lib/api'
import { apiFetch } from '@/lib/auth'
import { onNotification } from '@/lib/notifications'
import { celebrate } from '@/lib/celebrate'
import { flyTo } from '@/lib/fly'

const { data, loading, error, reload } = useResource(rewards)
const { data: summaryData, reload: reloadSummary } = useResource(summary)
const children = computed(() => summaryData.value?.children ?? [])
const list = computed(() => data.value?.rewards ?? [])

const tab = ref('pendientes')

// ----------------------------------------------------------- por entregar

const {
  data: pendingData, loading: loadingPending, reload: reloadPending,
} = useResource(() => redemptions({ status: 'pedida', limit: 50 }))
const pending = computed(() => pendingData.value?.redemptions ?? [])

// "Loberto la pidió" on the reward itself, so the list says who's waiting.
function askedLabel (r) {
  const names = [...new Set(pending.value.filter(p => p.rewardId === r.id).map(p => p.childName))]
  if (!names.length) return ''
  return names.length === 1 ? `${names[0]} la pidió` : `${names.slice(0, -1).join(', ')} y ${names.at(-1)} la pidieron`
}

// A kid asking for a reward shows up here without a reload.
const off = onNotification((n) => {
  if (n.kind === 'canje') reloadPending({ quiet: true })
})
onBeforeUnmount(off)

// -------------------------------------------------------------- historial

const pageSize = 12
const offset = ref(0)
const filterChild = ref('')
const historyData = ref(null)
const loadingHistory = ref(true)
const resolvedCount = ref(0)

async function loadHistory ({ quiet = false } = {}) {
  if (!quiet) loadingHistory.value = true
  try {
    historyData.value = await redemptions({
      status: 'resueltas',
      limit: pageSize,
      offset: offset.value,
      childId: filterChild.value || undefined,
    })
    resolvedCount.value = historyData.value?.counts?.resueltas ?? resolvedCount.value
  } finally {
    loadingHistory.value = false
  }
}

function goToPage (next) {
  offset.value = Math.max(0, next)
  loadHistory()
}

loadHistory()

const history = computed(() => historyData.value?.redemptions ?? [])
const hasMore = computed(() => historyData.value?.hasMore ?? false)

const STATE = {
  pedida: { label: 'Pedida', cls: 'revision' },
  entregada: { label: 'Entregada', cls: 'lista' },
  rechazada: { label: 'Rechazada', cls: 'pendiente' },
  revertida: { label: 'Revertida', cls: 'pendiente' },
}

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const when = (h) => dateFmt.format(new Date(h.resolvedAt || h.createdAt))

// ----------------------------------------------------- deliver / reject

const rows = new Map()
function setRow (id, comp) {
  if (comp?.$el) rows.set(id, comp.$el)
  else rows.delete(id)
}

const historyIcon = ref(null)
const bumpHistory = ref(0)
const busyId = ref(null)
const actionError = ref('')

function dropPending (id) {
  pendingData.value = { ...pendingData.value, redemptions: pending.value.filter(r => r.id !== id) }
}

// The counter goes up on arrival, then the page re-syncs with the server.
function landInHistory () {
  resolvedCount.value++
  bumpHistory.value++
  loadHistory({ quiet: true })
}

const deliveredMoment = (reward, childName) => ({
  icon: reward.icon,
  color: reward.color,
  title: `¡“${reward.title}” es para ${childName}!`,
  detail: `Se usaron ${reward.points} de sus puntos.`,
})

/**
 * Handing over a reward is what the whole points loop exists for, so it gets
 * the stage. It saves first — a celebration that has to be taken back is worse
 * than half a second of spinner — then plays, and the history counter takes the
 * hit once the curtain lifts.
 */
async function deliver (r) {
  if (busyId.value) return
  busyId.value = r.id
  actionError.value = ''
  try {
    await resolveRedemption(r.id, 'entregada')
  } catch (err) {
    actionError.value = err.data?.error || 'No se pudo entregar. Inténtalo de nuevo.'
    return
  } finally {
    busyId.value = null
  }

  dropPending(r.id)
  reloadSummary({ quiet: true })
  await celebrate(deliveredMoment(r, r.childName))
  landInHistory()
}

/** Optimistic, like approving a mission: it flies to Historial while saving. */
async function reject (r) {
  if (busyId.value) return
  busyId.value = r.id
  actionError.value = ''

  const before = pendingData.value
  let failed = false
  flyTo(rows.get(r.id), historyIcon.value).then(() => { if (!failed) landInHistory() })
  dropPending(r.id)

  try {
    await resolveRedemption(r.id, 'rechazada')
    reloadSummary({ quiet: true })
  } catch (err) {
    failed = true
    pendingData.value = before   // back where it was
    actionError.value = err.data?.error || 'No se pudo rechazar. Inténtalo de nuevo.'
  } finally {
    busyId.value = null
  }
}

// --------------------------------------------------- direct grant (catalog)

const grantOpen = ref(false)
const picked = ref(null)

function openGrant (reward) {
  if (!children.value.length) return
  picked.value = reward
  grantOpen.value = true
}

async function onGranted ({ reward, child }) {
  reloadSummary({ quiet: true })
  await celebrate(deliveredMoment(reward, child.name))
  landInHistory()
}

// --------------------------------------------------------------- revert

const revertOpen = ref(false)
const reverting = ref(null)
const revertingId = ref(null)

function askRevert (h) {
  reverting.value = h
  revertOpen.value = true
}

async function doRevert () {
  const h = reverting.value
  revertingId.value = h.id
  try {
    await resolveRedemption(h.id, 'revertida')
    revertOpen.value = false
    await Promise.all([loadHistory({ quiet: true }), reloadSummary({ quiet: true })])
  } finally {
    revertingId.value = null
    reverting.value = null
  }
}

// ------------------------------------------------------------ create reward

const createOpen = ref(false)
const title = ref('')
const points = ref(200)
// Per child; null = no limit. 1 by default: used up, the parent makes a new one.
const LIMITS = [
  { value: 1, label: '1 vez' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: null, label: 'Sin límite' },
]
const maxPerChild = ref(1)
const limitLabel = (r) => (r.maxPerChild == null ? '' : r.maxPerChild === 1 ? '1 vez por hijo' : `${r.maxPerChild} veces por hijo`)
const saving = ref(false)
const createError = ref('')

const bump = (n) => { points.value = Math.min(2000, Math.max(50, points.value + n)) }

async function save () {
  saving.value = true
  createError.value = ''

  try {
    await apiFetch('/api/rewards', {
      method: 'POST',
      body: JSON.stringify({ title: title.value.trim(), points: points.value, maxPerChild: maxPerChild.value, icon: 'redeem', color: 'blue' }),
    })
    title.value = ''
    points.value = 200
    maxPerChild.value = 1
    createOpen.value = false
    await reload({ quiet: true })
  } catch (err) {
    createError.value = err.data?.error || 'No se pudo crear.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bp-limit {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bp-limit-opt {
  flex: 1 0 auto;
  min-width: 48px;
  padding: 8px 12px;
  border: 1.5px solid #E1ECFA;
  border-radius: 999px;
  background: #fff;
  color: #55708F;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.bp-limit-opt.is-on {
  border-color: #1467E4;
  background: #EAF2FF;
  color: #1467E4;
}

.bp-limit-hint {
  margin: 8px 2px 0;
  color: #6F86A8;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
}

.bp-assign {
  display: flex;
  flex-direction: column;
  background: #fff;
  width: 100%;
  max-width: 420px;
  border-radius: 24px;
}

.bp-assign-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 14px 12px 18px;
  border-bottom: 1px solid #E8F0FB;
}

.bp-assign-title {
  font-size: 17px;
  font-weight: 800;
  color: #0B2A5B;
  margin: 0;
}

.bp-assign-body {
  padding: 14px 18px 6px;
}

.bp-assign-foot {
  display: flex;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #E8F0FB;
}

.bp-assign-foot .bp-submit {
  padding: 11px 16px;
  font-size: 13.5px;
}

.bp-points-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px;
  border: 1px solid #E8F0FB;
  border-radius: 18px;
}

.bp-points-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 26px;
  font-weight: 800;
  color: #0B2A5B;
  min-width: 90px;
  justify-content: center;
}

.bp-points-value .q-icon {
  color: #FFC531;
}

.bp-state {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.bp-state.pendiente { background: #EEF3FB; color: #6F86A8; }
.bp-state.revision  { background: #FFF4DC; color: #A36F00; }
.bp-state.lista     { background: #E3FBEE; color: #12814F; }
</style>
