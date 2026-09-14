<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Tutores"
      :subtitle="['Comparte la cuenta con la otra persona', 'que cuida a tus hijos.']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="group" color="primary" size="26px" />
        Todos los tutores tienen los mismos permisos.
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <MissionRow
        v-for="g in guardians"
        :key="g.id"
        :title="g.name + (g.id === youId ? ' (tú)' : '')"
        :subtitle="g.email"
        icon="face"
        color="blue"
      >
        <template #trailing>
          <span class="bp-state" :class="g.role === 'owner' ? 'lista' : 'pendiente'">
            {{ g.role === 'owner' ? 'Creó la cuenta' : 'Tutor' }}
          </span>
        </template>
      </MissionRow>
    </div>

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="person_add" color="primary" size="26px" />
        Invitar a otro tutor
      </div>

      <template v-if="invite">
        <div class="bp-code-display">
          <span v-for="(char, i) in invite.code" :key="i" class="bp-code-char">{{ char }}</span>
        </div>
        <p class="bp-hint">
          Pídele que cree su cuenta y escriba este código en<br />
          <strong>Perfil → Tutores → Unirme a una familia</strong>.
        </p>
      </template>

      <q-btn
        unelevated rounded no-caps
        color="primary"
        :label="invite ? 'Generar otro código' : 'Generar código de invitación'"
        :loading="inviting"
        class="full-width q-mt-sm"
        @click="makeInvite"
      />
    </div>

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="login" color="primary" size="26px" />
        ¿Te invitaron? Únete a su familia
      </div>

      <CodeInput v-model="joinCode" @complete="start" />

      <p v-if="joinError" class="bp-auth-error">{{ joinError }}</p>

      <q-btn
        outline rounded no-caps
        color="primary"
        label="Unirme"
        :disable="joinCode.length < 6"
        :loading="checking"
        class="full-width q-mt-md"
        @click="start"
      />

      <p class="bp-hint">
        Antes de unirte te mostramos qué familia es
        y qué pasa con los hijos que ya registraste.
      </p>
    </div>

    <JoinFamilyDialog v-model="confirmOpen" :plan="plan" :loading="joining" @confirm="confirm" />
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import CodeInput from '@/components/CodeInput.vue'
import JoinFamilyDialog from '@/components/JoinFamilyDialog.vue'
import { apiFetch } from '@/lib/auth'
import { useResource } from '@/lib/api'
import { useJoinFamily } from '@/lib/joinFamily'

const router = useRouter()

const { data, loading, error, reload } = useResource(() => apiFetch('/api/guardians'))
const guardians = computed(() => data.value?.guardians ?? [])
const youId = computed(() => data.value?.you)

const invite = ref(null)
const inviting = ref(false)

async function makeInvite () {
  inviting.value = true
  try {
    invite.value = await apiFetch('/api/guardians/invite', { method: 'POST', body: '{}' })
  } finally {
    inviting.value = false
  }
}

// Preview → confirm → join. Landing on Hijos after a merge shows the moved
// children arrived safely.
const {
  joinCode, checking, joining, joinError, plan, confirmOpen, start, confirm,
} = useJoinFamily((res) => router.push(res.merged && res.movedChildren ? '/hijos' : '/'))
</script>
