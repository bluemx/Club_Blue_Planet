<!-- Shared frame for the out-of-app screens: login, registro, recuperar, cuenta infantil. -->
<template>
  <div class="bp-auth bp-gradient-bg">
    <span class="bp-blob bp-blob--1" />
    <span class="bp-blob bp-blob--2" />
    <span class="bp-blob bp-blob--3" />
    <span class="bp-auth-dots" />

    <div class="bp-auth-inner">
      <router-link v-if="back" :to="back" class="bp-auth-back">
        <q-icon name="arrow_back" size="18px" />
        {{ backLabel }}
      </router-link>

      <img src="@/assets/brand/Logo-Menu.svg" class="bp-auth-logo" :class="{ 'bp-auth-logo--sm': compact }" />

      <div class="bp-auth-card">
        <h1 class="bp-auth-title">{{ title }}</h1>
        <p v-if="subtitle" class="bp-auth-sub">{{ subtitle }}</p>
        <slot />
      </div>

      <p v-if="$slots.footer" class="bp-auth-foot">
        <slot name="footer" />
      </p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  back: { type: String, default: '' },
  backLabel: { type: String, default: 'Volver' },
  compact: { type: Boolean, default: false },
})
</script>
