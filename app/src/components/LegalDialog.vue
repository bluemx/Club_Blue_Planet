<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm">
    <div class="bp-legal">
      <header class="bp-legal-head">
        <div>
          <h2 class="bp-legal-title">{{ doc.title }}</h2>
          <p class="bp-legal-updated">{{ doc.updated }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" color="grey-7" aria-label="Cerrar" />
      </header>

      <div class="bp-legal-body">
        <section v-for="s in doc.sections" :key="s.h">
          <h3>{{ s.h }}</h3>
          <p>{{ s.p }}</p>
        </section>
      </div>

      <footer class="bp-legal-foot">
        <q-btn v-close-popup flat rounded no-caps label="Cerrar" color="grey-7" class="col" />
        <button type="button" class="bp-submit col" @click="accept">Acepto</button>
      </footer>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { legal } from '@/data/legal'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  kind: { type: String, default: 'terms' }, // 'terms' | 'privacy'
})
const emit = defineEmits(['update:modelValue', 'accept'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const doc = computed(() => legal[props.kind] ?? legal.terms)

function accept () {
  emit('accept')
  open.value = false
}
</script>

<style scoped>
.bp-legal {
  display: flex;
  flex-direction: column;
  background: #fff;
  width: 100%;
  max-width: 520px;
  max-height: 100%;
  border-radius: 24px;
}

.bp-legal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 14px 12px 18px;
  border-bottom: 1px solid #E8F0FB;
}

.bp-legal-title {
  font-size: 17px;
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: -.3px;
  color: #0B2A5B;
  margin: 0;
}

.bp-legal-updated {
  font-size: 11px;
  font-weight: 600;
  color: #90A3C0;
  margin: 3px 0 0;
}

/* 0 1 auto so the card hugs its content and only scrolls once it hits max-height */
.bp-legal-body {
  flex: 0 1 auto;
  overflow-y: auto;
  padding: 4px 18px 8px;
  -webkit-overflow-scrolling: touch;
}

.bp-legal-body h3 {
  font-size: 13px;
  line-height: 1.3;
  font-weight: 800;
  color: #1467E4;
  margin: 16px 0 4px;
}

.bp-legal-body p {
  font-size: 12.5px;
  line-height: 1.5;
  font-weight: 600;
  color: #55708F;
  margin: 0;
}

.bp-legal-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #E8F0FB;
}

.bp-legal-foot .bp-submit {
  padding: 11px 16px;
  font-size: 13.5px;
}
</style>
