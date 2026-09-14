<!--
  Brand icon set: duotone blue + accent colours + leaf, drawn inline so they can
  be animated part-by-part with CSS (and stay CSP-safe / offline).
-->
<template>
  <svg
    class="bp-icon"
    :class="[`bp-icon--${name}`, { 'bp-icon--active': active }]"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
  >
    <!-- Inicio -->
    <g v-if="name === 'home'" class="bp-ico-g">
      <path
        d="M7 22.5 24 8.5l17 14"
        stroke="var(--bp-ink)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
      />
      <path
        d="M11 21.5v16.5a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2V21.5"
        fill="var(--bp-pale)" stroke="var(--bp-ink)" stroke-width="3.2" stroke-linejoin="round"
      />
      <path
        d="M19.5 40V30a4.5 4.5 0 0 1 9 0v10"
        fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="3.2" stroke-linejoin="round"
      />
      <g class="bp-ico-leaf">
        <path d="M38 15c4.5-.6 7 1.4 7 5-3.6 2.6-7 1.6-8.2-1.2" fill="var(--bp-leaf)" />
      </g>
    </g>

    <!-- Misiones -->
    <g v-else-if="name === 'missions'" class="bp-ico-g">
      <rect
        x="9.5" y="10" width="29" height="31" rx="4.5"
        fill="var(--bp-pale)" stroke="var(--bp-ink)" stroke-width="3.2"
      />
      <rect
        x="17.5" y="5.5" width="13" height="9" rx="3"
        fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="3.2"
      />
      <g class="bp-ico-check">
        <path d="m15.5 23 2.6 2.6 4.4-4.6" stroke="var(--bp-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M27 23.5h6.5" stroke="var(--bp-ink)" stroke-width="3" stroke-linecap="round" />
      </g>
      <g class="bp-ico-check bp-ico-check--2">
        <path d="m15.5 32 2.6 2.6 4.4-4.6" stroke="var(--bp-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M27 32.5h6.5" stroke="var(--bp-ink)" stroke-width="3" stroke-linecap="round" />
      </g>
      <g class="bp-ico-leaf">
        <path d="M36.5 33c4.5-.6 7 1.4 7 5-3.6 2.6-7 1.6-8.2-1.2" fill="var(--bp-leaf)" />
      </g>
    </g>

    <!-- Recompensas -->
    <g v-else-if="name === 'rewards'" class="bp-ico-g">
      <rect
        x="8.5" y="21" width="31" height="19" rx="3.5"
        fill="var(--bp-pale)" stroke="var(--bp-ink)" stroke-width="3.2"
      />
      <rect
        x="6" y="14" width="36" height="9.5" rx="3.5"
        fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="3.2"
      />
      <path d="M24 14v26" stroke="var(--bp-ink)" stroke-width="3.2" />
      <g class="bp-ico-bow">
        <path d="M24 14c-3.5-1-6-2.5-6-5.2 0-2 1.6-3.3 3.4-3.3 2.4 0 4 2.4 4.6 8.5Z" fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="2.6" stroke-linejoin="round" />
        <path d="M24 14c3.5-1 6-2.5 6-5.2 0-2-1.6-3.3-3.4-3.3-2.4 0-4 2.4-4.6 8.5Z" fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="2.6" stroke-linejoin="round" />
      </g>
      <g class="bp-ico-star">
        <path d="m24 26.5 1.7 3.4 3.8.5-2.7 2.7.6 3.7-3.4-1.8-3.4 1.8.6-3.7-2.7-2.7 3.8-.5Z" fill="var(--bp-accent)" />
      </g>
    </g>

    <!-- Estadísticas -->
    <g v-else-if="name === 'stats'" class="bp-ico-g">
      <path d="M8 40h32" stroke="var(--bp-ink)" stroke-width="3.2" stroke-linecap="round" />
      <rect class="bp-ico-bar bp-ico-bar--1" x="10.5" y="27" width="7.5" height="11" rx="2.5" fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="2.8" />
      <rect class="bp-ico-bar bp-ico-bar--2" x="20.5" y="21" width="7.5" height="17" rx="2.5" fill="var(--bp-pale)" stroke="var(--bp-ink)" stroke-width="2.8" />
      <rect class="bp-ico-bar bp-ico-bar--3" x="30.5" y="15" width="7.5" height="23" rx="2.5" fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="2.8" />
      <g class="bp-ico-arrow">
        <path d="M12 19.5 22 12l6 4.5L38 7" stroke="var(--bp-warm)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M31.5 6.5H39v7.5" stroke="var(--bp-warm)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>

    <!-- Perfil -->
    <g v-else-if="name === 'profile'" class="bp-ico-g">
      <circle cx="24" cy="17" r="8.5" fill="var(--bp-fill)" stroke="var(--bp-ink)" stroke-width="3.2" />
      <path
        d="M10 40.5c0-7.5 6.3-12 14-12s14 4.5 14 12"
        fill="var(--bp-pale)" stroke="var(--bp-ink)" stroke-width="3.2" stroke-linecap="round"
      />
      <g class="bp-ico-leaf">
        <path d="M37 27c4.5-.6 7 1.4 7 5-3.6 2.6-7 1.6-8.2-1.2" fill="var(--bp-leaf)" />
      </g>
    </g>

    <!-- Más -->
    <g v-else-if="name === 'plus'" class="bp-ico-g">
      <path
        d="M24 12v24M12 24h24"
        stroke="currentColor" stroke-width="5.5" stroke-linecap="round"
      />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  name: { type: String, required: true },
  active: { type: Boolean, default: false },
})
</script>
