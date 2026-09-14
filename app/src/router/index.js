import { defineRouter } from '#q-app'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router'

import routes from './routes.js'
import { fetchSession } from '@/lib/session'

// Screens reachable without a session.
const PUBLIC = ['/login', '/registro', '/recuperar', '/cuenta-infantil']

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter((/* { store, ssrContext } */) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : (import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })

  Router.beforeEach(async (to) => {
    if (PUBLIC.includes(to.path)) return true

    const user = await fetchSession()
    if (!user) return { path: '/login' }

    // Keep each role inside its own area.
    const wantsKidArea = to.path.startsWith('/kid')
    if (user.role === 'kid' && !wantsKidArea) return { path: '/kid' }
    if (user.role !== 'kid' && wantsKidArea) return { path: '/' }

    // A parent with no children can't do anything useful yet — the whole app
    // is built around assigning missions to someone. Send them to onboarding.
    // /tutores is exempt: an invited guardian has no children of their own yet
    // and would otherwise be bounced away from the screen that lets them join.
    const onboardingExempt = ['/hijos', '/tutores']
    if (user.role !== 'kid' && user.childrenCount === 0 && !onboardingExempt.includes(to.path)) {
      return { path: '/hijos' }
    }

    return true
  })

  return Router
})
