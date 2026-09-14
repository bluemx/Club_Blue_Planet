<template>
  <!--
    Replaces a <q-select> of children: a dropdown hides the choice behind a tap
    and shows one name at a time. Here every kid is visible, by face.
  -->
  <div class="bp-kidpick" role="radiogroup" :aria-label="label">
    <button
      v-if="allowAll"
      type="button"
      role="radio"
      class="bp-kidpick-btn"
      :class="{ 'is-on': !modelValue }"
      :aria-checked="!modelValue"
      @click="pick('')"
    >
      <span class="bp-kidpick-all"><q-icon name="groups" size="28px" /></span>
      <span class="bp-kidpick-name">Todos</span>
      <span v-if="!modelValue" class="bp-kidpick-check"><q-icon name="check" size="14px" /></span>
    </button>

    <button
      v-for="k in children"
      :key="k.id"
      type="button"
      role="radio"
      class="bp-kidpick-btn"
      :class="{ 'is-on': modelValue === k.id }"
      :aria-checked="modelValue === k.id"
      @click="pick(k.id)"
    >
      <KidAvatar :avatar="k.avatar" :seed="k.id" :size="54" />
      <span class="bp-kidpick-name">{{ k.name }}</span>
      <span v-if="modelValue === k.id" class="bp-kidpick-check"><q-icon name="check" size="14px" /></span>
    </button>
  </div>
</template>

<script setup>
import KidAvatar from '@/components/KidAvatar.vue'

const props = defineProps({
  // [{ id, name, avatar }]
  children: { type: Array, default: () => [] },
  // the picked child's id; '' = "Todos" when allowAll
  modelValue: { type: String, default: '' },
  allowAll: { type: Boolean, default: false },
  label: { type: String, default: 'Elige un hijo' },
})
const emit = defineEmits(['update:modelValue', 'change'])

function pick (id) {
  if (id === props.modelValue) return
  emit('update:modelValue', id)
  emit('change', id)
}
</script>

<style scoped>
.bp-kidpick {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 2px 10px;
  scrollbar-width: none;
}

.bp-kidpick::-webkit-scrollbar { display: none; }

.bp-kidpick-btn {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 86px;
  padding: 12px 10px 10px;
  border: 2px solid transparent;
  border-radius: 20px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F2F7FF 100%);
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -2px 0 rgba(20, 103, 228, .10),
    0 2px 4px rgba(11, 43, 107, .08),
    0 10px 18px -10px rgba(20, 103, 228, .35);
  color: #0B2A5B;
  font: inherit;
  cursor: pointer;
  transition: transform .18s cubic-bezier(.16, 1, .3, 1), box-shadow .18s, border-color .18s;
}

.bp-kidpick-btn:hover { transform: translateY(-2px); }
.bp-kidpick-btn:active { transform: translateY(1px); }

.bp-kidpick-btn.is-on {
  border-color: #1467E4;
  background: linear-gradient(180deg, #FFFFFF 0%, #EAF2FF 100%);
  box-shadow:
    inset 0 1px 0 #fff,
    0 2px 4px rgba(11, 43, 107, .10),
    0 14px 24px -10px rgba(20, 103, 228, .55);
}

.bp-kidpick-name {
  max-width: 96px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bp-kidpick-btn.is-on .bp-kidpick-name { color: #1467E4; }

.bp-kidpick-all {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(160deg, #EAF3FF, #D8E9FF);
  color: #1467E4;
  box-shadow: 0 0 0 2px #fff, 0 3px 8px -2px rgba(11, 43, 107, .25);
}

.bp-kidpick-check {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1467E4;
  color: #fff;
  box-shadow: 0 0 0 2px #fff;
}

@media (prefers-reduced-motion: reduce) {
  .bp-kidpick-btn:hover,
  .bp-kidpick-btn:active { transform: none; }
}
</style>
