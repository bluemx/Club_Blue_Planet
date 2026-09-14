<template>
  <div class="bp-row" :class="{ 'bp-row--tappable': tappable }">
    <div class="bp-row-badge" :class="color">
      <q-icon :name="icon" />
    </div>
    <div class="col">
      <div class="bp-row-title">{{ title }}</div>
      <div v-if="subtitle" class="bp-row-subtitle">{{ subtitle }}</div>
    </div>

    <slot name="trailing">
      <div class="bp-points-pill">
        <q-icon name="star" size="14px" />
        {{ signed }}
      </div>
    </slot>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: 'eco' },
  points: { type: [String, Number], default: 50 },
  color: { type: String, default: 'blue' },
  // '+50' for earning, plain '350' for a cost
  sign: { type: Boolean, default: true },
  tappable: { type: Boolean, default: false },
})

const signed = computed(() => (props.sign ? `+${props.points}` : props.points))
</script>
