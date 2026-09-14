<template>
  <Teleport to="body">
    <Transition name="bp-cele">
      <div
        v-if="current"
        :key="current.id"
        class="bp-cele"
        :class="{ 'bp-cele--still': still }"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="`${current.id}-title`"
        @click="onTap"
      >
        <!--
          One authored sequence, ~1.8s: the gift drops in and shakes, the lid
          flies off in a flash of light, the prize rises out of it on a burst of
          confetti, and only then the words arrive.
        -->
        <div class="bp-cele-stage" aria-hidden="true">
          <div class="bp-cele-rays" />
          <div class="bp-cele-glow" />
          <div class="bp-gift" :class="current.color">
            <div class="bp-gift-shake">
              <div class="bp-gift-body" />
              <div class="bp-gift-lid"><span class="bp-gift-bow" /></div>
            </div>
          </div>
          <div class="bp-cele-prize bp-row-badge" :class="[current.color, { 'bp-cele-prize--pic': current.image }]">
            <img v-if="current.image" :src="current.image" alt="" draggable="false" />
            <q-icon v-else :name="current.icon" />
          </div>
          <div ref="burst" class="bp-cele-burst" />
        </div>

        <div class="bp-cele-copy">
          <div v-if="current.points" class="bp-cele-points"><q-icon name="star" /> +{{ current.points }} puntos</div>
          <h2 :id="`${current.id}-title`" class="bp-cele-title">{{ current.title }}</h2>
          <p v-if="current.detail" class="bp-cele-detail">{{ current.detail }}</p>
          <button ref="closeBtn" type="button" class="bp-cele-btn">¡Genial!</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { celebrations } from '@/lib/celebrate'

const current = ref(null)
const burst = ref(null)
const closeBtn = ref(null)

// Reduced motion gets the finished frame: prize, words, button. No drop, no confetti.
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const CONFETTI = ['#1467E4', '#34C77B', '#FFC531', '#E8438E', '#7C4DEF', '#C6E44B', '#FFFFFF']
const AUTO_CLOSE_MS = 7000
// An excited tap on the way in shouldn't skip the reveal it's excited about.
const TAP_GUARD_MS = 1500

let timers = []
let openedAt = 0
const later = (ms, fn) => { timers.push(setTimeout(fn, ms)) }
const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }

function next () {
  if (current.value || !celebrations.value.length) return
  current.value = celebrations.value.shift()
  openedAt = Date.now()

  nextTick(() => {
    closeBtn.value?.focus({ preventScroll: true })
    if (still) return
    // Timed to the lid coming off (see .bp-gift-lid's delay).
    later(950, spawnConfetti)
    // Only fires where the browser allows it (after a tap); silent otherwise.
    later(1000, () => navigator.vibrate?.([18, 40, 30]))
  })

  later(AUTO_CLOSE_MS, close)
}

function spawnConfetti () {
  const host = burst.value
  if (!host) return
  const frag = document.createDocumentFragment()
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i')
    const round = Math.random() < 0.3
    const size = 6 + Math.random() * 7
    piece.className = 'bp-confetti'
    piece.style.cssText = [
      `--c:${CONFETTI[i % CONFETTI.length]}`,
      `--w:${round ? size : size * 0.6}px`,
      `--h:${round ? size : size * 1.6}px`,
      `--r:${round ? '50%' : '2px'}`,
      `--dx:${Math.round((Math.random() * 2 - 1) * 190)}px`,
      `--up:${Math.round(120 + Math.random() * 170)}px`,
      `--fall:${Math.round(220 + Math.random() * 260)}px`,
      `--rot:${Math.round((Math.random() * 2 - 1) * 720)}deg`,
      `--dur:${Math.round(1300 + Math.random() * 900)}ms`,
      `--delay:${Math.round(Math.random() * 140)}ms`,
    ].join(';')
    frag.appendChild(piece)
  }
  host.appendChild(frag)
}

function close () {
  if (!current.value) return
  clearTimers()
  current.value.resolve?.()
  current.value = null
  // Let the leave transition finish before the next moment takes the stage.
  setTimeout(next, 380)
}

function onTap () {
  if (still || Date.now() - openedAt >= TAP_GUARD_MS) close()
}

function onKey (e) {
  if (e.key === 'Escape' || e.key === 'Enter') close()
}

watch(() => celebrations.value.length, next)
watch(current, (moment) => {
  if (moment) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  clearTimers()
  document.removeEventListener('keydown', onKey)
})
</script>

<style>
/* Unscoped on purpose: the confetti pieces are created from script. */
.bp-cele {
  position: fixed;
  inset: 0;
  z-index: 8000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  overflow: hidden;
  cursor: pointer;
  background: radial-gradient(110% 80% at 50% 36%, rgba(34, 92, 196, .92) 0%, rgba(9, 31, 82, .96) 55%, rgba(4, 14, 40, .98) 100%);
}

.bp-cele-enter-active { transition: opacity .3s ease; }
.bp-cele-leave-active { transition: opacity .35s ease, transform .35s ease; }
.bp-cele-enter-from,
.bp-cele-leave-to { opacity: 0; }
.bp-cele-leave-to { transform: scale(1.03); }

.bp-cele-stage {
  position: relative;
  width: 260px;
  height: 260px;
  flex: none;
}

/* Light rays: scale in with the reveal, then turn slowly behind the prize. */
.bp-cele-rays {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 520px;
  height: 520px;
  margin: -260px 0 0 -260px;
  opacity: 0;
  transform: scale(.25);
  animation: bp-cele-in .8s cubic-bezier(.16, 1, .3, 1) .95s forwards;
}

.bp-cele-rays::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255, 214, 110, .32) 0deg 8deg, rgba(255, 214, 110, 0) 8deg 22deg);
  -webkit-mask-image: radial-gradient(circle, #000 12%, transparent 66%);
  mask-image: radial-gradient(circle, #000 12%, transparent 66%);
  animation: bp-cele-spin 18s linear infinite;
}

.bp-cele-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 220px;
  height: 220px;
  margin: -110px 0 0 -110px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 190, .95) 0%, rgba(255, 204, 92, .45) 38%, rgba(255, 204, 92, 0) 70%);
  opacity: 0;
  transform: scale(.2);
  animation: bp-cele-flash 1s ease-out .9s forwards;
}

/* The gift: drops in, shakes, loses its lid. */
.bp-gift {
  --g1: #5CA3FF;
  --g2: #1467E4;
  position: absolute;
  left: 50%;
  bottom: 14px;
  width: 136px;
  height: 124px;
  margin-left: -68px;
  animation: bp-gift-drop .65s cubic-bezier(.34, 1.4, .64, 1) both;
}

.bp-gift.green  { --g1: #4FD68F; --g2: #12945E; }
.bp-gift.purple { --g1: #A07BFF; --g2: #6D3BE0; }
.bp-gift.pink   { --g1: #FF82B6; --g2: #D62F7E; }
/* Orange rather than yellow, so the gold ribbon still reads on it. */
.bp-gift.amber  { --g1: #FFB347; --g2: #E07B00; }

.bp-gift-shake {
  position: absolute;
  inset: 0;
  transform-origin: 50% 100%;
  animation: bp-gift-shake .42s ease-in-out .6s both;
}

.bp-gift-body,
.bp-gift-lid {
  position: absolute;
  background: linear-gradient(160deg, var(--g1), var(--g2));
}

.bp-gift-body {
  left: 8px;
  right: 8px;
  bottom: 0;
  height: 86px;
  border-radius: 12px 12px 18px 18px;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, .35),
    inset 0 -10px 16px rgba(0, 0, 0, .2),
    0 22px 34px -12px rgba(0, 0, 0, .6);
}

.bp-gift-body::before,
.bp-gift-lid::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 22px;
  margin-left: -11px;
  background: linear-gradient(180deg, #FFE58A, #F2B100);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .3);
}

.bp-gift-lid {
  left: 0;
  right: 0;
  bottom: 80px;
  height: 32px;
  border-radius: 10px;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, .45), 0 8px 12px -6px rgba(0, 0, 0, .45);
  transform-origin: 15% 100%;
  animation: bp-gift-lid .6s cubic-bezier(.2, .8, .3, 1) .95s forwards;
}

.bp-gift-bow {
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 60px;
  height: 28px;
  margin-left: -30px;
}

.bp-gift-bow::before,
.bp-gift-bow::after {
  content: '';
  position: absolute;
  bottom: -4px;
  width: 28px;
  height: 26px;
  border: 6px solid #F2B100;
  background: rgba(255, 229, 138, .5);
}

.bp-gift-bow::before { left: 0; border-radius: 60% 10% 60% 60%; transform: rotate(-12deg); }
.bp-gift-bow::after  { right: 0; border-radius: 10% 60% 60% 60%; transform: rotate(12deg); }

/* The prize rises out of the box, then hangs in the light. */
.bp-cele .bp-cele-prize {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 108px;
  height: 108px;
  margin: -54px 0 0 -54px;
  border-radius: 32px;
  font-size: 58px;
  opacity: 0;
  transform: translateY(70px) scale(.2);
  box-shadow:
    0 0 0 6px rgba(255, 255, 255, .75),
    0 26px 44px -10px rgba(0, 0, 0, .55),
    inset 0 3px 0 rgba(255, 255, 255, .9);
  animation:
    bp-prize-up .8s cubic-bezier(.34, 1.56, .64, 1) 1s forwards,
    bp-prize-float 3.2s ease-in-out 1.8s infinite;
}

/* A face, not a glyph: round, and the picture fills it. */
.bp-cele .bp-cele-prize--pic {
  width: 132px;
  height: 132px;
  margin: -66px 0 0 -66px;
  border-radius: 50%;
  overflow: hidden;
}

.bp-cele-prize--pic img {
  width: 100%;
  height: 100%;
}

.bp-cele-burst {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 0;
  height: 0;
}

.bp-confetti {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--w);
  height: var(--h);
  border-radius: var(--r);
  background: var(--c);
  opacity: 0;
  animation: bp-confetti var(--dur) cubic-bezier(.15, .7, .4, 1) var(--delay) forwards;
}

.bp-cele-copy {
  max-width: 360px;
  margin-top: 6px;
  text-align: center;
  color: #fff;
}

.bp-cele-title {
  margin: 0;
  font-size: 27px;
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -.01em;
  text-wrap: balance;
  opacity: 0;
  transform: translateY(16px);
  animation: bp-cele-rise .6s cubic-bezier(.16, 1, .3, 1) 1.35s forwards;
}

.bp-cele-detail {
  margin: 10px 0 0;
  color: rgba(226, 237, 255, .9);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  opacity: 0;
  transform: translateY(12px);
  animation: bp-cele-rise .6s cubic-bezier(.16, 1, .3, 1) 1.5s forwards;
}

.bp-cele-btn {
  margin-top: 22px;
  min-width: 190px;
  padding: 13px 26px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, #FFE27A, #F5B400);
  color: #3A2A00;
  font: inherit;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .7),
    inset 0 -2px 0 rgba(150, 100, 0, .3),
    0 14px 28px -8px rgba(245, 180, 0, .6);
  opacity: 0;
  transform: translateY(12px);
  animation: bp-cele-rise .5s cubic-bezier(.16, 1, .3, 1) 1.75s forwards;
}

.bp-cele-btn:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

@keyframes bp-cele-in    { to { opacity: 1; transform: scale(1); } }
@keyframes bp-cele-spin  { to { transform: rotate(360deg); } }
@keyframes bp-cele-rise  { to { opacity: 1; transform: none; } }
@keyframes bp-cele-flash {
  0%   { opacity: 0; transform: scale(.2); }
  30%  { opacity: 1; transform: scale(1.35); }
  100% { opacity: .6; transform: scale(1); }
}
@keyframes bp-gift-drop  { from { transform: translateY(-120vh); } to { transform: translateY(0); } }
@keyframes bp-gift-shake {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-8deg); }
  40% { transform: rotate(7deg); }
  60% { transform: rotate(-5deg); }
  80% { transform: rotate(3deg); }
}
@keyframes bp-gift-lid   { to { transform: translate(-80px, -170px) rotate(-40deg); opacity: 0; } }
@keyframes bp-prize-up   { to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes bp-prize-float {
  0%, 100% { opacity: 1; transform: translateY(0) scale(1); }
  50%      { opacity: 1; transform: translateY(-10px) scale(1); }
}
@keyframes bp-confetti {
  0%   { opacity: 1; transform: translate(-50%, -50%) rotate(0); }
  30%  { opacity: 1; transform: translate(calc(var(--dx) * .7), calc(var(--up) * -1)) rotate(calc(var(--rot) * .35)); }
  100% { opacity: 0; transform: translate(var(--dx), var(--fall)) rotate(var(--rot)); }
}

.bp-cele--still *,
.bp-cele--still *::before,
.bp-cele--still *::after { animation: none !important; }
.bp-cele--still .bp-gift { display: none; }
.bp-cele--still .bp-cele-rays,
.bp-cele--still .bp-cele-prize,
.bp-cele--still .bp-cele-title,
.bp-cele--still .bp-cele-detail,
.bp-cele--still .bp-cele-btn { opacity: 1; transform: none; }
.bp-cele--still .bp-cele-glow { opacity: .6; transform: none; }

/* Points earned: a gold pill that lands with the words. */
.bp-cele-points {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px 20px;
  border-radius: 999px;
  background: linear-gradient(180deg, #FFE27A, #F5B400);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .7), inset 0 -2px 0 rgba(150, 100, 0, .3), 0 12px 24px -10px rgba(245, 180, 0, .8);
  color: #3A2A00;
  font-size: 26px;
  font-weight: 900;
  animation: bp-cele-points .55s cubic-bezier(.34, 1.56, .64, 1) 1.5s both;
}

.bp-cele-points .q-icon { color: #fff; filter: drop-shadow(0 1px 1px rgba(150, 100, 0, .5)); }

@keyframes bp-cele-points {
  0%   { opacity: 0; transform: scale(.3) rotate(-8deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}

.bp-cele--still .bp-cele-points { animation: none; }

</style>
