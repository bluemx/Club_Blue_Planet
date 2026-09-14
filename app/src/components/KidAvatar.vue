<template>
  <img
    :src="uri"
    :width="size"
    :height="size"
    :alt="alt"
    class="bp-kid-avatar"
    :style="{ width: `${size}px`, height: `${size}px` }"
    draggable="false"
  />
</template>

<script setup>
import { computed } from 'vue'
import { avatarUri } from '@/lib/avatar'

const props = defineProps({
  // The kid's stored avatar (JSON string or object); empty = their default face.
  avatar: { type: [String, Object], default: null },
  // The kid's id: keeps the default face stable for that kid.
  seed: { type: String, default: '' },
  size: { type: Number, default: 40 },
  alt: { type: String, default: '' },
})

const uri = computed(() => avatarUri(props.avatar, props.seed))
</script>
