<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      :title="onboarding ? '¡Bienvenido!' : 'Mis hijos'"
      :subtitle="onboarding
        ? ['¿Alguien de tu familia ya usa la app,', 'o eres el primero?']
        : ['Administra los perfiles de tu familia.']"
    />

    <!--
      Join comes first on purpose. A second guardian who lands here will
      instinctively add their kids again, ending up with duplicate children in
      two separate families that never merge.
    -->
    <div v-if="onboarding" class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="group_add" color="primary" size="26px" />
        Si tu pareja u otro familiar ya registró a los niños, únete a su familia
        en vez de volver a crearlos. Si tú ya agregaste alguno, se va contigo.
      </div>

      <CodeInput v-model="joinCode" @complete="start" />

      <p v-if="joinError" class="bp-auth-error">{{ joinError }}</p>

      <button
        type="button"
        class="bp-submit q-mt-md"
        :disabled="joinCode.length < 6 || checking || joining"
        @click="start"
      >
        <OrnIcon /> {{ checking ? 'Revisando…' : 'Unirme a su familia' }} <OrnIcon />
      </button>

      <p class="bp-hint">
        El código se genera desde<br />
        <strong>Perfil → Tutores</strong> en la cuenta de quien ya la usa.
      </p>
    </div>

    <div v-if="onboarding" class="bp-divider-or">
      <span>o empieza tu propia familia</span>
    </div>

    <div class="bp-sheet">
      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <template v-if="!loading">
        <MissionRow
          v-for="child in children"
          :key="child.id"
          :title="child.name"
          :subtitle="[ageOf(child) ? `${ageOf(child)} años` : '', `${child.points} puntos`].filter(Boolean).join(' · ')"
          :kid="child"
        >
          <template #trailing>
            <q-btn
              flat round dense icon="cake" :color="child.birthYear ? 'primary' : 'grey-5'"
              :aria-label="`Edad de ${child.name}`"
              @click="openAge(child)"
            >
              <q-tooltip>{{ child.birthYear ? 'Cambiar edad' : 'Agregar edad' }}</q-tooltip>
            </q-btn>
            <q-btn
              flat round dense icon="pin" color="primary"
              :to="`/perfil/codigo-infantil?hijo=${child.id}`"
            >
              <q-tooltip>Ver su código</q-tooltip>
            </q-btn>
            <q-btn
              flat round dense icon="delete_outline" color="grey-6"
              :loading="removingId === child.id"
              @click="confirmRemove(child)"
            >
              <q-tooltip>Eliminar</q-tooltip>
            </q-btn>
          </template>
        </MissionRow>

        <q-form :class="children.length ? 'q-mt-md' : ''" @submit.prevent="add">
          <div class="bp-field-label">
            {{ children.length ? 'Agregar otro hijo' : '¿Cómo se llama tu hijo?' }}
          </div>

          <q-input
            v-model="name"
            outlined dense rounded hide-bottom-space
            placeholder="Nombre o apodo"
            class="bp-field q-mb-sm"
            maxlength="60"
          />

          <!-- Asked once per adult, before the family holds any child's data. -->
          <label v-if="needsConsent" class="bp-consent">
            <q-checkbox v-model="consent" dense color="primary" />
            <span>
              Soy su madre, padre o tutor y doy mi consentimiento para que Club Blue Planet
              guarde su nombre, avatar, misiones y fotos, como explica el
              <a href="#" @click.prevent="privacyOpen = true">aviso de privacidad</a>.
            </span>
          </label>

          <p v-if="addError" class="bp-auth-error q-mb-sm">{{ addError }}</p>

          <button type="submit" class="bp-submit" :disabled="!name.trim() || saving || (needsConsent && !consent)">
            <OrnIcon /> {{ saving ? 'Guardando…' : 'Agregar hijo' }} <OrnIcon />
          </button>
        </q-form>

        <!-- Someone who already built a family can still switch to another one. -->
        <q-btn
          v-if="children.length"
          to="/tutores"
          flat rounded no-caps
          color="primary"
          label="Unirme a otra familia"
          class="full-width q-mt-sm"
        />
      </template>
    </div>

    <JoinFamilyDialog v-model="confirmOpen" :plan="plan" :loading="joining" @confirm="confirm" />

    <!-- Age: the AI mission ideas are pitched at it. -->
    <q-dialog v-model="ageOpen">
      <div class="bp-confirm">
        <h2 class="bp-confirm-title">¿Cuántos años tiene {{ ageChild?.name }}?</h2>
        <p class="bp-confirm-text">Así las ideas de misiones van de acuerdo a su edad.</p>
        <div class="bp-ages">
          <button
            v-for="a in AGES"
            :key="a"
            type="button"
            class="bp-age"
            :class="{ 'is-on': ageOf(ageChild) === a }"
            :disabled="savingAge"
            @click="saveAge(a)"
          >
            {{ a }}
          </button>
        </div>
        <p v-if="ageError" class="bp-auth-error q-mt-sm">{{ ageError }}</p>
      </div>
    </q-dialog>

    <LegalDialog v-model="privacyOpen" kind="privacy" @accept="consent = true" />

    <q-dialog v-model="removeOpen">
      <div class="bp-confirm">
        <h2 class="bp-confirm-title">¿Eliminar a {{ removing?.name }}?</h2>
        <p class="bp-confirm-text">
          Se borran también sus misiones, sus puntos y las fotos que subió.
          Esto no se puede deshacer.
        </p>
        <div class="bp-confirm-foot">
          <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
          <q-btn
            unelevated rounded no-caps
            color="negative" label="Eliminar" class="col"
            :loading="removingId === removing?.id"
            @click="remove"
          />
        </div>
      </div>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import CodeInput from '@/components/CodeInput.vue'
import JoinFamilyDialog from '@/components/JoinFamilyDialog.vue'
import { OrnIcon } from '@/components/authIcons'
import { apiFetch } from '@/lib/auth'
import { invalidateSession, currentUser } from '@/lib/session'
import LegalDialog from '@/components/LegalDialog.vue'
import { summary, useResource, setChildBirthYear } from '@/lib/api'
import { useJoinFamily } from '@/lib/joinFamily'

const router = useRouter()

const { data, loading, error, reload } = useResource(summary)
const children = computed(() => data.value?.children ?? [])

// First run: no children yet, so this doubles as the welcome step.
const onboarding = computed(() => !loading.value && !children.value.length)

const name = ref('')
const consent = ref(false)
const privacyOpen = ref(false)
const needsConsent = computed(() => !currentUser.value?.parentConsentAt)
const saving = ref(false)
const addError = ref('')

// Preview → confirm → join. If their own kids came along, stay and show them here.
const {
  joinCode, checking, joining, joinError, plan, confirmOpen, start, confirm,
} = useJoinFamily((res) => (res.merged && res.movedChildren ? reload() : router.push('/')))

// ------------------------------------------------------------------ age
const AGES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const thisYear = new Date().getFullYear()
const ageOf = (child) => (child?.birthYear ? thisYear - child.birthYear : null)
const ageOpen = ref(false)
const ageChild = ref(null)
const savingAge = ref(false)
const ageError = ref('')

function openAge (child) {
  ageChild.value = child
  ageError.value = ''
  ageOpen.value = true
}

async function saveAge (age) {
  savingAge.value = true
  ageError.value = ''
  try {
    await setChildBirthYear(ageChild.value.id, thisYear - age)
    ageOpen.value = false
    await reload({ quiet: true })
  } catch (err) {
    ageError.value = err.data?.error || 'No se pudo guardar.'
  } finally {
    savingAge.value = false
  }
}

const removeOpen = ref(false)
const removing = ref(null)
const removingId = ref(null)

function confirmRemove (child) {
  removing.value = child
  removeOpen.value = true
}

async function remove () {
  const child = removing.value
  removingId.value = child.id

  try {
    await apiFetch(`/api/children/${child.id}`, { method: 'DELETE' })
    removeOpen.value = false
    invalidateSession()   // childrenCount drives the onboarding gate
    await reload()
  } catch (err) {
    addError.value = err.data?.error || 'No se pudo eliminar.'
  } finally {
    removingId.value = null
    removing.value = null
  }
}

async function add () {
  const value = name.value.trim()
  if (!value) return

  saving.value = true
  addError.value = ''

  try {
    await apiFetch('/api/auth/kid-code/children', {
      method: 'POST',
      body: JSON.stringify({ name: value, ...(needsConsent.value && { consent: true }) }),
    })
    name.value = ''
    invalidateSession()
    await reload()
  } catch (err) {
    addError.value = err.data?.message || err.data?.error || 'No se pudo agregar.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bp-consent {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 0 10px;
  color: #55708F;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  cursor: pointer;
}

.bp-consent a { color: #1467E4; font-weight: 800; }

.bp-ages { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.bp-age { padding: 12px 0; border: 1.5px solid #E1ECFA; border-radius: 14px; background: linear-gradient(180deg, #fff, #F2F7FF); color: #0B2A5B; font: inherit; font-size: 17px; font-weight: 800; cursor: pointer; }
.bp-age.is-on { border-color: #1467E4; background: #EAF2FF; color: #1467E4; }
</style>
