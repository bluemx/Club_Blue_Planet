<template>
  <q-dialog v-model="open" @show="reset">
    <div class="bp-confirm bp-grant">
      <h2 class="bp-confirm-title">Entregar “{{ reward?.title }}”</h2>
      <p class="bp-confirm-text">
        Cuesta {{ reward?.points }} puntos. ¿A quién se la entregas?
      </p>

      <div class="bp-grant-list">
        <button
          v-for="child in children"
          :key="child.id"
          type="button"
          class="bp-grant-child"
          :class="{ 'is-on': picked === child.id, 'is-short': !canAfford(child) }"
          :disabled="!canAfford(child)"
          @click="picked = child.id"
        >
          <KidAvatar :avatar="child.avatar" :seed="child.id" :size="38" />
          <span class="col text-left">
            <span class="bp-row-title">{{ child.name }}</span>
            <span class="bp-row-subtitle">
              {{ canAfford(child)
                ? `${child.points} pts · le quedarían ${child.points - reward.points}`
                : `${child.points} pts · le faltan ${reward.points - child.points}` }}
            </span>
          </span>
          <q-icon v-if="picked === child.id" name="check_circle" color="secondary" size="20px" />
        </button>
      </div>

      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <div class="bp-confirm-foot">
        <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
        <q-btn
          unelevated rounded no-caps
          color="primary" label="Entregar" class="col"
          :disable="!picked"
          :loading="saving"
          @click="grant"
        />
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import KidAvatar from '@/components/KidAvatar.vue'
import { redeemRewardFor } from '@/lib/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reward: { type: Object, default: null },
  children: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'granted'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const picked = ref(null)
const saving = ref(false)
const error = ref('')

const canAfford = (child) => child.points >= (props.reward?.points ?? 0)

function reset () {
  error.value = ''
  // With a single child there is nothing to choose; preselect if they can pay.
  const affordable = props.children.filter(canAfford)
  picked.value = affordable.length === 1 ? affordable[0].id : null
}

async function grant () {
  if (!picked.value) return
  saving.value = true
  error.value = ''

  try {
    await redeemRewardFor(props.reward.id, picked.value)
    const child = props.children.find(c => c.id === picked.value)
    emit('granted', { reward: props.reward, child })
    open.value = false
  } catch (err) {
    error.value = err.data?.error || 'No se pudo entregar.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bp-grant {
  max-width: 400px;
}

.bp-grant-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.bp-grant-child {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid #E8F0FB;
  border-radius: 16px;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.bp-grant-child .col { display: flex; flex-direction: column; }

.bp-grant-child.is-on {
  border-color: #1467E4;
  background: #F2F7FF;
}

.bp-grant-child.is-short {
  opacity: .55;
  cursor: not-allowed;
}
</style>
