<!-- 6-box numeric code entry with auto-advance, backspace and paste. -->
<template>
  <div class="bp-code" @paste.prevent="onPaste">
    <input
      v-for="(digit, i) in digits"
      :key="i"
      :ref="el => (boxes[i] = el)"
      class="bp-code-box"
      :class="{ 'bp-code-box--filled': digit !== '' }"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="1"
      :aria-label="`Dígito ${i + 1}`"
      :value="digit"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @focus="$event.target.select()"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  length: { type: Number, default: 6 },
})
const emit = defineEmits(['update:modelValue', 'complete'])

const boxes = ref([])
const digits = ref(toDigits(props.modelValue, props.length))

function toDigits (value, length) {
  const clean = (value || '').replace(/\D/g, '').slice(0, length).split('')
  return Array.from({ length }, (_, i) => clean[i] ?? '')
}

// keep in sync when the parent resets the value
watch(() => props.modelValue, (value) => {
  if (value !== digits.value.join('')) {
    digits.value = toDigits(value, props.length)
  }
})

function push () {
  const code = digits.value.join('')
  emit('update:modelValue', code)
  if (code.length === props.length && !digits.value.includes('')) {
    emit('complete', code)
  }
}

// synchronous on purpose: the boxes are already in the DOM, and waiting a tick
// drops characters when someone types (or autofills) faster than a render
function focusBox (i) {
  boxes.value[i]?.focus()
}

function onInput (i, event) {
  // take the last typed character so overwriting a filled box works
  const typed = event.target.value.replace(/\D/g, '').slice(-1)
  digits.value[i] = typed
  event.target.value = typed

  if (typed && i < props.length - 1) focusBox(i + 1)
  push()
}

function onKeydown (i, event) {
  if (event.key === 'Backspace' && digits.value[i] === '' && i > 0) {
    event.preventDefault()
    digits.value[i - 1] = ''
    focusBox(i - 1)
    push()
  } else if (event.key === 'ArrowLeft' && i > 0) {
    event.preventDefault()
    focusBox(i - 1)
  } else if (event.key === 'ArrowRight' && i < props.length - 1) {
    event.preventDefault()
    focusBox(i + 1)
  }
}

function onPaste (event) {
  const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '')
  if (!pasted) return

  digits.value = toDigits(pasted, props.length)
  const next = Math.min(pasted.length, props.length - 1)
  focusBox(next)
  push()
}
</script>
