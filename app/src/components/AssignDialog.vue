<template>
  <q-dialog v-model="open" @show="preselect">
    <div class="bp-assign">
      <header class="bp-assign-head">
        <div>
          <h2 class="bp-assign-title">Asignar misión</h2>
          <p class="bp-assign-sub">{{ mission?.title }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" color="grey-7" aria-label="Cerrar" />
      </header>

      <div class="bp-assign-body">
        <div class="bp-field-label">¿A quién se la asignas?</div>

        <button
          v-for="child in children"
          :key="child.id"
          type="button"
          class="bp-pick"
          :class="{ 'is-on': picked.includes(child.id) }"
          @click="toggle(child.id)"
        >
          <KidAvatar :avatar="child.avatar" :seed="child.id" :size="44" />
          <span class="col text-left">
            <span class="bp-row-title">{{ child.name }}</span>
            <span class="bp-row-subtitle">{{ child.points }} puntos</span>
          </span>
          <q-icon
            :name="picked.includes(child.id) ? 'check_circle' : 'radio_button_unchecked'"
            :color="picked.includes(child.id) ? 'primary' : 'grey-5'"
            size="22px"
          />
        </button>

        <p v-if="!children.length" class="bp-hint">
          Primero agrega a un hijo.
        </p>

        <p v-if="error" class="bp-auth-error">{{ error }}</p>
      </div>

      <footer class="bp-assign-foot">
        <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
        <button
          type="button"
          class="bp-submit col"
          :disabled="!picked.length || saving"
          @click="confirm"
        >
          {{ saving ? 'Asignando…' : label }}
        </button>
      </footer>
    </div>
  </q-dialog>
</template>

<script setup>
import KidAvatar from '@/components/KidAvatar.vue'
import { ref, computed } from 'vue'
import { assignMission } from '@/lib/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mission: { type: Object, default: null },
  children: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'assigned'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const picked = ref([])
const saving = ref(false)
const error = ref('')

const label = computed(() =>
  picked.value.length > 1 ? `Asignar a ${picked.value.length}` : 'Asignar'
)

/** With a single child there is nothing to choose — tick them by default. */
function preselect () {
  error.value = ''
  picked.value = props.children.length === 1 ? [props.children[0].id] : []
}

function toggle (id) {
  picked.value = picked.value.includes(id)
    ? picked.value.filter(x => x !== id)
    : [...picked.value, id]
}

async function confirm () {
  saving.value = true
  error.value = ''

  try {
    await assignMission(props.mission.id, picked.value)
    const names = props.children
      .filter(c => picked.value.includes(c.id))
      .map(c => c.name)
      .join(' y ')
    emit('assigned', { mission: props.mission, names })
    open.value = false
  } catch (err) {
    error.value = err.data?.error || 'No se pudo asignar.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bp-assign {
  display: flex;
  flex-direction: column;
  background: #fff;
  width: 100%;
  max-width: 420px;
  max-height: 100%;
  border-radius: 24px;
}

.bp-assign-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 14px 12px 18px;
  border-bottom: 1px solid #E8F0FB;
}

.bp-assign-title {
  font-size: 17px;
  line-height: 1.25;
  font-weight: 800;
  color: #0B2A5B;
  margin: 0;
}

.bp-assign-sub {
  font-size: 12px;
  font-weight: 600;
  color: #7C93B5;
  margin: 3px 0 0;
}

.bp-assign-body {
  flex: 0 1 auto;
  overflow-y: auto;
  padding: 14px 18px 6px;
}

.bp-pick {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 10px;
  margin-bottom: 8px;
  border: 1.5px solid #EEF3FB;
  border-radius: 18px;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  transition: border-color .18s, background .18s;
}

.bp-pick.is-on {
  border-color: #1467E4;
  background: #F2F7FF;
}

.bp-pick .bp-row-title,
.bp-pick .bp-row-subtitle {
  display: block;
}

.bp-assign-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #E8F0FB;
}

.bp-assign-foot .bp-submit {
  padding: 11px 16px;
  font-size: 13.5px;
}
</style>
