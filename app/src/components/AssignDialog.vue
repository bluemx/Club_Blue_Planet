<template>
  <q-dialog v-model="open" @before-show="preselect">
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

        <!-- Habits are built by repetition: a mission can come back on its own. -->
        <div class="bp-field-label q-mt-md">¿Cada cuándo?</div>
        <div class="bp-repeat" role="radiogroup" aria-label="Repetición">
          <button
            v-for="o in REPEATS"
            :key="o.key"
            type="button"
            role="radio"
            class="bp-repeat-opt"
            :class="{ 'is-on': repeat === o.key }"
            :aria-checked="repeat === o.key"
            @click="repeat = o.key"
          >
            {{ o.label }}
          </button>
        </div>
        <div v-if="repeat === 'dias'" class="bp-days" aria-label="Días">
          <button
            v-for="(d, i) in DAY_LETTERS"
            :key="i"
            type="button"
            class="bp-day"
            :class="{ 'is-on': days.includes(i) }"
            :aria-pressed="days.includes(i)"
            :aria-label="DAY_NAMES[i]"
            @click="toggleDay(i)"
          >
            {{ d }}
          </button>
        </div>
        <p v-if="repeat !== 'una'" class="bp-repeat-hint">
          Aparecerá sola en sus misiones {{ repeatHint }}. Puedes pararla en Misiones.
        </p>

        <p v-if="error" class="bp-auth-error">{{ error }}</p>
      </div>

      <footer class="bp-assign-foot">
        <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
        <button
          type="button"
          class="bp-submit col"
          :disabled="!picked.length || saving || (repeat === 'dias' && !days.length)"
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

const REPEATS = [
  { key: 'una', label: 'Una vez' },
  { key: 'diario', label: 'Diario' },
  { key: 'semana', label: 'Entre semana' },
  { key: 'dias', label: 'Elegir días' },
]
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const repeat = ref('una')
const days = ref([1, 3, 5])
const toggleDay = (i) => { days.value = days.value.includes(i) ? days.value.filter(d => d !== i) : [...days.value, i].sort() }
const repeatDays = computed(() => ({
  una: null,
  diario: [0, 1, 2, 3, 4, 5, 6],
  semana: [1, 2, 3, 4, 5],
  dias: days.value,
}[repeat.value]))
const repeatHint = computed(() => ({
  diario: 'todos los días',
  semana: 'de lunes a viernes',
  dias: days.value.length ? `cada ${days.value.map(i => DAY_NAMES[i]).join(', ')}` : '',
}[repeat.value] ?? ''))
const saving = ref(false)
const error = ref('')

const label = computed(() =>
  picked.value.length > 1 ? `Asignar a ${picked.value.length}` : 'Asignar'
)

/** With a single child there is nothing to choose — tick them by default. */
function preselect () {
  error.value = ''
  picked.value = props.children.length === 1 ? [props.children[0].id] : []
  repeat.value = 'una'
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
    await assignMission(props.mission.id, picked.value, repeatDays.value)
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
.bp-repeat {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.bp-repeat-opt,
.bp-day {
  padding: 9px 6px;
  border: 1.5px solid #E1ECFA;
  border-radius: 14px;
  background: #fff;
  color: #55708F;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.bp-repeat-opt.is-on,
.bp-day.is-on { border-color: #1467E4; background: #EAF2FF; color: #1467E4; }

.bp-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-top: 8px;
}

.bp-day { padding: 8px 0; border-radius: 50%; aspect-ratio: auto; }

.bp-repeat-hint {
  margin: 8px 2px 0;
  color: #6F86A8;
  font-size: 12px;
  font-weight: 600;
}

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
