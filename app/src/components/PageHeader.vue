<template>
  <div v-if="$q.screen.lt.sm" class="bp-hero">
    <div class="bp-hero-dots" />
    <img src="@/assets/brand/Logo-Menu.svg" class="bp-hero-logo" />
    <div class="bp-hero-title">{{ title }}</div>
    <div v-if="lines.length" class="bp-hero-subtitle">
      <div v-for="line in lines" :key="line">{{ line }}</div>
    </div>
  </div>

  <div v-else class="q-px-md q-pt-lg q-pb-md">
    <div class="bp-page-title">{{ title }}</div>
    <div v-if="lines.length" class="bp-page-subtitle">{{ lines.join(' ') }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  // string, or array of lines (each line breaks only on mobile)
  subtitle: { type: [String, Array], default: '' },
})

const lines = computed(() => {
  if (Array.isArray(props.subtitle)) return props.subtitle
  return props.subtitle ? [props.subtitle] : []
})
</script>
