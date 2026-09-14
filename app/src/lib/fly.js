/**
 * Flies a copy of `fromEl` into `toEl` along an arc and resolves when it lands.
 *
 * A clone does the flying so the real element is free to leave its list at the
 * same moment — waiting for the flight first is what made the list feel slow.
 * Resolves immediately (no clone) when either end is missing or the user asked
 * for reduced motion.
 */
export function flyTo (fromEl, toEl, { duration = 720 } = {}) {
  if (!fromEl || !toEl) return Promise.resolve()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()

  const a = fromEl.getBoundingClientRect()
  const b = toEl.getBoundingClientRect()

  const ghost = fromEl.cloneNode(true)
  ghost.classList.add('bp-ghost')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    margin: '0',
    zIndex: '6000',
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
  })
  document.body.appendChild(ghost)

  const dx = (b.left + b.width / 2) - (a.left + a.width / 2)
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2)
  // Taller arc for a longer trip, capped so it never leaves the screen.
  const lift = Math.min(90, Math.abs(dy) * 0.3 + 28)

  const flight = ghost.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
    // Picked up: a small lift first, so it reads as taken rather than teleported.
    { transform: `translate(${dx * 0.06}px, -14px) scale(1.03)`, opacity: 1, offset: 0.16 },
    { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - lift}px) scale(.42)`, opacity: 0.95, offset: 0.62 },
    { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0.15, offset: 1 },
  ], { duration, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' })

  return flight.finished
    .catch(() => {})
    .finally(() => ghost.remove())
}
