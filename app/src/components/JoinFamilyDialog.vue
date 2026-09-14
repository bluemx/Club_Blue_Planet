<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <div v-if="plan" class="bp-confirm bp-join">
      <h2 class="bp-confirm-title">¿Unirte a esta familia?</h2>

      <!-- Names, so a mistyped code can't land someone in a stranger's family. -->
      <div class="bp-join-facts">
        <div class="bp-join-fact">
          <span class="bp-row-badge blue"><q-icon name="family_restroom" /></span>
          <span><strong>Tutores:</strong> {{ list(plan.guardians) }}</span>
        </div>
        <div class="bp-join-fact">
          <span class="bp-row-badge green"><q-icon name="face" /></span>
          <span v-if="plan.theirKids.length"><strong>Hijos:</strong> {{ list(plan.theirKids) }}</span>
          <span v-else>Todavía no tienen hijos registrados.</span>
        </div>
      </div>

      <!-- What happens to the family this adult is in now — the irreversible part. -->
      <div v-if="plan.merging && plan.movingKids.length" class="bp-join-warn">
        <q-icon name="swap_horiz" size="22px" />
        <!-- Names only: "tu hijo Sofía" reads wrong, and the names are what matter. -->
        <p>
          <strong>{{ list(plan.movingKids) }}</strong>
          {{ plan.movingKids.length === 1 ? 'se muda' : 'se mudan' }} contigo, con sus misiones,
          puntos y fotos. Tu familia actual deja de existir.
        </p>
      </div>
      <div v-else-if="!plan.merging" class="bp-join-warn">
        <q-icon name="logout" size="22px" />
        <p>
          Dejas la familia que compartes con <strong>{{ list(plan.stayingBehind) }}</strong>.
          <template v-if="plan.yourKids.length">
            {{ list(plan.yourKids) }} {{ plan.yourKids.length === 1 ? 'se queda' : 'se quedan' }} ahí.
          </template>
        </p>
      </div>

      <p class="bp-confirm-text">Esto no se puede deshacer desde la app.</p>

      <div class="bp-confirm-foot">
        <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" :disable="loading" />
        <q-btn
          unelevated rounded no-caps
          color="primary" label="Sí, unirme" class="col"
          :loading="loading"
          @click="$emit('confirm')"
        />
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  // { guardians, theirKids, movingKids, yourKids, stayingBehind, merging } from /guardians/join/preview
  plan: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})
defineEmits(['update:modelValue', 'confirm'])

const fmt = new Intl.ListFormat('es', { type: 'conjunction' })
const list = (names = []) => fmt.format(names)
</script>

<style scoped>
.bp-join {
  max-width: 420px;
}

.bp-join-facts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 0 14px;
}

.bp-join-fact {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.35;
  color: #0B2A5B;
}

.bp-join-fact .bp-row-badge {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  font-size: 19px;
}

.bp-join-warn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #FFF6E0;
  color: #7A5400;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.bp-join-warn p {
  margin: 0;
}

.bp-join-warn .q-icon {
  flex: none;
  color: #C98A0B;
}
</style>
