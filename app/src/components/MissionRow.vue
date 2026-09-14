<template>
  <div class="bp-row" :class="{ 'bp-row--tappable': tappable }">
    <!-- kid: the row is about this child, so their face is the badge.
         by: the row is a mission/reward, and this is whose it is. -->
    <div v-if="kid" class="bp-row-avatar">
      <KidAvatar :avatar="kid.avatar" :seed="kid.id" :size="44" />
    </div>
    <div v-else class="bp-row-badge" :class="color">
      <q-icon :name="icon" />
      <KidAvatar v-if="by" :avatar="by.avatar" :seed="by.id" :size="22" class="bp-row-by" />
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
import KidAvatar from '@/components/KidAvatar.vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: 'eco' },
  points: { type: [String, Number], default: 50 },
  color: { type: String, default: 'blue' },
  // '+50' for earning, plain '350' for a cost
  sign: { type: Boolean, default: true },
  tappable: { type: Boolean, default: false },
  // { id, avatar } of a child — see the template
  kid: { type: Object, default: null },
  by: { type: Object, default: null },
})

const signed = computed(() => (props.sign ? `+${props.points}` : props.points))
</script>
