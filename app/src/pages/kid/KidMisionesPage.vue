<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Mis misiones"
      :subtitle="['Aquí ves tus misiones', 'y todo lo que ya lograste.']"
    />

    <div class="bp-sheet">
      <q-tabs
        v-model="filter"
        dense no-caps
        active-color="primary"
        indicator-color="primary"
        class="bp-kid-tabs text-grey-7"
      >
        <q-tab name="todas" label="Todas" />
        <q-tab name="pendiente" label="Por hacer" />
        <q-tab name="revision" label="En revisión" />
        <q-tab name="lista" label="Listas" />
      </q-tabs>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <template v-if="!loading && !error">
        <MissionRow
          v-for="a in visible"
          :key="a.id"
          :title="a.title"
          :subtitle="a.subtitle"
          :icon="a.icon"
          :color="a.color"
          :points="a.points"
        >
          <template #trailing>
            <q-btn
              v-if="a.status === 'pendiente'"
              unelevated rounded no-caps size="sm"
              color="primary"
              icon="photo_camera"
              label="Subir foto"
              :loading="busyId === a.id"
              @click="pick(a)"
            />
            <span v-else class="bp-state" :class="a.status">
              <q-icon :name="STATE[a.status].icon" size="14px" />
              {{ STATE[a.status].label }}
            </span>
          </template>
        </MissionRow>

        <!-- capture opens the camera straight away on a phone -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="upload"
        />

        <p v-if="uploadError" class="bp-auth-error">{{ uploadError }}</p>

        <p v-if="!visible.length" class="bp-hint">
          Nada por aquí todavía. ¡Pídele misiones a tus papás!
        </p>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import { assignments, uploadEvidence, useResource } from '@/lib/api'
import { onNotification } from '@/lib/notifications'

const STATE = {
  pendiente: { label: 'Por hacer', icon: 'radio_button_unchecked' },
  revision: { label: 'En revisión', icon: 'hourglass_top' },
  lista: { label: 'Lista', icon: 'check_circle' },
}

const filter = ref('todas')
const busyId = ref(null)

const { data, loading, error, reload } = useResource(assignments)
const list = computed(() => data.value?.assignments ?? [])

// A new mission or an approval changes this list; refresh it in place.
const off = onNotification((n) => {
  if (n.kind === 'asignada' || n.kind === 'aprobada') reload({ quiet: true })
})
onBeforeUnmount(off)

const visible = computed(() =>
  filter.value === 'todas' ? list.value : list.value.filter(a => a.status === filter.value)
)

const fileInput = ref(null)
const target = ref(null)
const uploadError = ref('')

function pick (a) {
  target.value = a
  uploadError.value = ''
  fileInput.value.value = ''   // re-picking the same file must still fire change
  fileInput.value.click()
}

async function upload (event) {
  const file = event.target.files?.[0]
  if (!file || !target.value) return

  busyId.value = target.value.id
  uploadError.value = ''

  try {
    await uploadEvidence(target.value.id, file)
    await reload()
  } catch (err) {
    uploadError.value = err.data?.error || 'No se pudo subir la foto.'
  } finally {
    busyId.value = null
    target.value = null
  }
}
</script>

<style scoped>
.bp-kid-tabs {
  margin-bottom: 10px;
}

.bp-kid-tabs :deep(.q-tab) {
  min-height: 34px;
  min-width: 0;
  padding: 0 8px;
}

.bp-kid-tabs :deep(.q-tab__label) {
  font-size: 11.5px;
  font-weight: 700;
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

.bp-state.pendiente { background: #EEF3FB; color: #7C93B5; }
.bp-state.revision  { background: #FFF4DC; color: #C98A0B; }
.bp-state.lista     { background: #E3FBEE; color: #16A66A; }
</style>
