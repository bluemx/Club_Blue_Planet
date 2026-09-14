<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Canjea tus puntos"
      :subtitle="['Junta puntos completando misiones', 'y elige tu recompensa favorita.']"
    />

    <div class="bp-sheet">
      <div class="bp-wallet">
        <span class="bp-wallet-label">Tienes</span>
        <span class="bp-wallet-value">
          <q-icon name="star" size="22px" />
          {{ points }}
        </span>
        <span class="bp-wallet-label">puntos</span>
      </div>

      <div class="bp-sheet-note">
        <q-icon name="redeem" color="primary" size="26px" />
        Pídele a tus papás que te ayuden a canjear.
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>
      <p v-if="message" class="bp-note-ok">{{ message }}</p>

      <template v-if="!loading && !error">
        <div
          v-for="r in list"
          :key="r.id"
          class="bp-row"
          :class="{ 'bp-row--locked': r.points > points || usedUp(r) }"
        >
          <div class="bp-row-badge" :class="r.color">
            <q-icon :name="r.icon" />
          </div>
          <div class="col">
            <div class="bp-row-title">{{ r.title }}</div>
            <div class="bp-row-subtitle">
              <template v-if="usedUp(r)">Ya la canjeaste. Pídele a tus papás una nueva.</template>
              <template v-else>
                {{ r.points > points ? `Te faltan ${r.points - points} puntos` : '¡Ya puedes canjearla!' }}
                <template v-if="left(r) > 1 && left(r) < Infinity"> · Te quedan {{ left(r) }}</template>
              </template>
            </div>
            <q-linear-progress
              v-if="!usedUp(r)"
              rounded size="6px" class="q-mt-xs"
              :value="Math.min(points / r.points, 1)"
              :color="r.points > points ? 'blue-3' : 'secondary'"
              track-color="blue-1"
            />
          </div>
          <span v-if="usedUp(r)" class="bp-used"><q-icon name="check_circle" size="14px" /> Canjeada</span>
          <q-btn
            v-else-if="r.points <= points"
            unelevated rounded no-caps size="sm"
            color="primary" label="Canjear"
            :loading="busyId === r.id"
            @click="redeem(r)"
          />
          <div v-else class="bp-points-pill">
            <q-icon name="star" size="14px" />
            {{ r.points }}
          </div>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { rewards, summary, redeemReward, useResource } from '@/lib/api'
import { onNotification } from '@/lib/notifications'

const busyId = ref(null)
const message = ref('')

const { data: rewardData, loading, error, reload: reloadRewards } = useResource(rewards)
const { data: summaryData, reload: reloadSummary } = useResource(summary)

const list = computed(() => rewardData.value?.rewards ?? [])
const points = computed(() => summaryData.value?.totals?.points ?? 0)

// Times left under the parent's limit; no limit = Infinity.
const left = (r) => (r.maxPerChild == null ? Infinity : r.maxPerChild - (r.used ?? 0))
const usedUp = (r) => left(r) <= 0

// A delivery, a rejection or a revert all move the balance on screen.
const off = onNotification((n) => {
  if (n.kind === 'premio' || n.kind === 'devuelto') reloadSummary({ quiet: true })
})
onBeforeUnmount(off)

async function redeem (r) {
  busyId.value = r.id
  message.value = ''
  try {
    await redeemReward(r.id)
    message.value = `¡Pediste "${r.title}"! Tus papás te la entregarán.`
    await Promise.all([reloadSummary(), reloadRewards({ quiet: true })])
  } catch (err) {
    message.value = err.data?.error || 'No se pudo canjear.'
  } finally {
    busyId.value = null
  }
}
</script>

<style scoped>
.bp-wallet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 10px 16px;
  margin-bottom: 12px;
  border-radius: 20px;
  background: linear-gradient(180deg, #EAF3FF, #D5E8FF);
  border: 1px solid #C9E1FF;
}

.bp-wallet-label {
  font-size: 11.5px;
  font-weight: 700;
  color: #55708F;
}

.bp-wallet-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
  color: #0B2A5B;
}

.bp-wallet-value .q-icon {
  color: #FFC531;
}

.bp-row--locked {
  opacity: .7;
}

.bp-used {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: #E3FBEE;
  color: #16A66A;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.bp-note-ok {
  font-size: 11.5px;
  font-weight: 700;
  color: #16A66A;
  text-align: center;
  margin: 0 0 10px;
}
</style>
