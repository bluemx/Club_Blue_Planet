// Small inline SVGs shared by the auth screens. Functional components keep the
// markup out of every page without pulling in an icon dependency.
import { h } from 'vue'

const svg = (children, extra = {}) =>
  h('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true', ...extra }, children)

const stroke = (d, width = 2) =>
  h('path', { d, stroke: '#fff', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })

export const MailIcon = () => svg([
  h('rect', { x: 2.5, y: 5, width: 19, height: 14, rx: 3, stroke: '#fff', 'stroke-width': 2 }),
  stroke('m3.5 7.5 8.5 6 8.5-6'),
])

export const LockIcon = () => svg([
  h('rect', { x: 4, y: 10.5, width: 16, height: 10.5, rx: 3, stroke: '#fff', 'stroke-width': 2 }),
  stroke('M7.75 10.5V7.75a4.25 4.25 0 0 1 8.5 0v2.75'),
])

export const UserIcon = () => svg([
  h('circle', { cx: 12, cy: 8.5, r: 3.75, stroke: '#fff', 'stroke-width': 2 }),
  stroke('M5 19.5c0-3.6 3.1-5.75 7-5.75s7 2.15 7 5.75'),
])

export const ShieldIcon = () => svg([
  stroke('M12 3l7 3v5.5c0 4.2-2.9 7.6-7 8.5-4.1-.9-7-4.3-7-8.5V6l7-3Z'),
  stroke('m9 12 2.2 2.2L15.5 10'),
])

// decorative marks either side of the primary button label
export const OrnIcon = () => svg([
  h('path', {
    d: 'M12 3v18M3 12h18',
    stroke: 'currentColor',
    'stroke-width': 3,
    'stroke-linecap': 'round',
  }),
], { class: 'bp-submit-orn' })

export const KidIcon = () => svg([
  h('circle', { cx: 12, cy: 12, r: 9, fill: '#BBDBFF', stroke: '#1467E4', 'stroke-width': 1.8 }),
  h('circle', { cx: 9, cy: 10.5, r: 1.2, fill: '#1467E4' }),
  h('circle', { cx: 15, cy: 10.5, r: 1.2, fill: '#1467E4' }),
  h('path', { d: 'M8.75 14.75a4 4 0 0 0 6.5 0', stroke: '#1467E4', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
  h('path', { d: 'M18.5 5.5c2.2-.3 3.4.7 3.4 2.4-1.8 1.3-3.4.8-4-.6', fill: '#3FBF6F' }),
], { class: 'bp-btn-icon' })
